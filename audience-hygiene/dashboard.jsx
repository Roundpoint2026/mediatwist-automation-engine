import { useState, useMemo, useCallback } from "react";

// ─── Analysis Engine (inline for self-contained dashboard) ──────

const RISK_WEIGHTS = { noPosts: 2, highFollowing: 2, lowFollowers: 2, randomUsername: 1, noProfilePic: 1, extremeRatio: 2, genericBio: 1 };
const THRESHOLDS = { highFollowing: 1000, lowFollowers: 50, inactiveFollowing: 1000, inactiveFollowers: 100, extremeRatio: 20, removeScore: 5, reviewScore: 3 };

function hasRandomUsername(u) {
  return /\d{4,}/.test(u) || /^[a-z]{2,6}\d{5,}$/.test(u) || /^[a-z]+[._]\d{4,}$/.test(u);
}

function calcRisk(user) {
  let score = 0; const reasons = [];
  if (user.posts === 0) { score += 2; reasons.push("no posts"); }
  if (user.following > 1000) { score += 2; reasons.push(`following ${user.following.toLocaleString()}`); }
  if (user.followers < 50) { score += 2; reasons.push(`${user.followers} followers`); }
  if (hasRandomUsername(user.username)) { score += 1; reasons.push("suspicious username"); }
  if (!user.hasProfilePic) { score += 1; reasons.push("no profile pic"); }
  if (user.followers > 0 && user.following / user.followers > 20) { score += 2; reasons.push("extreme ratio"); }
  if (!user.bio || user.bio.trim().length < 3) { score += 1; reasons.push("no bio"); }
  return { score, reasons };
}

function isInactive(u) {
  if (u.posts === 0) return true;
  if (u.following > 1000 && u.followers < 100) return true;
  return false;
}

function classify(user, score, followsYou) {
  if (user.isVerified) return { action: "KEEP", tag: "real_audience" };
  const inactive = isInactive(user);
  if (score >= 5 && !followsYou) return { action: "REMOVE", tag: "spam" };
  if (score >= 5) return { action: "REVIEW", tag: "spam" };
  if (score >= 3) return { action: "REVIEW", tag: inactive ? "inactive" : "review" };
  if (!followsYou && inactive) return { action: "REVIEW", tag: "inactive" };
  return { action: "KEEP", tag: inactive ? "inactive" : "real_audience" };
}

function parseBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes";
}

function normalizeRow(r) {
  return {
    username: (r.username || r.Username || r.handle || "").toLowerCase().trim(),
    fullName: r.full_name || r.fullName || r.name || r.Name || "",
    followers: parseInt(r.followers || r.follower_count || r.Followers || 0) || 0,
    following: parseInt(r.following || r.following_count || r.Following || 0) || 0,
    posts: parseInt(r.posts || r.media_count || r.Posts || 0) || 0,
    hasProfilePic: parseBool(r.has_profile_pic || r.hasProfilePic || r.profile_pic || "true"),
    bio: r.bio || r.biography || "",
    isVerified: parseBool(r.is_verified || r.isVerified || "false"),
  };
}

function parseCSVText(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || "").trim(); });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { result.push(cur); cur = ""; } else cur += c; }
  }
  result.push(cur);
  return result;
}

function runAnalysis(followersRaw, followingRaw) {
  const followers = followersRaw.map(normalizeRow);
  const following = followingRaw.map(normalizeRow);
  const followerSet = new Set(followers.map(u => u.username));
  const followingSet = new Set(following.map(u => u.username));

  const allUsers = new Map();
  followers.forEach(u => allUsers.set(u.username, { ...u }));
  following.forEach(u => { if (allUsers.has(u.username)) { allUsers.set(u.username, { ...u, ...allUsers.get(u.username) }); } else { allUsers.set(u.username, { ...u }); } });

  const results = [];
  for (const [username, user] of allUsers) {
    const followsYou = followerSet.has(username);
    const youFollow = followingSet.has(username);
    const { score, reasons } = calcRisk(user);
    const { action, tag } = classify(user, score, followsYou);
    results.push({ username, fullName: user.fullName, followsYou, youFollow, followers: user.followers, following: user.following, posts: user.posts, hasProfilePic: user.hasProfilePic, isVerified: user.isVerified, riskScore: score, riskReasons: reasons, inactive: isInactive(user), tag, recommendedAction: action });
  }
  results.sort((a, b) => b.riskScore - a.riskScore);

  const totalF = results.filter(r => r.followsYou).length;
  const realF = results.filter(r => r.followsYou && r.tag === "real_audience").length;
  const removalQueue = results.filter(r => r.recommendedAction === "REMOVE").sort((a, b) => { if (a.followsYou !== b.followsYou) return a.followsYou ? 1 : -1; return b.riskScore - a.riskScore; });
  const batches = [];
  for (let i = 0; i < removalQueue.length; i += 50) batches.push({ day: Math.floor(i / 50) + 1, accounts: removalQueue.slice(i, i + 50) });

  return {
    results,
    removalQueue,
    dailyBatches: batches,
    stats: {
      totalAccounts: results.length, totalFollowers: followerSet.size, totalFollowing: followingSet.size,
      mutualFollows: results.filter(r => r.followsYou && r.youFollow).length,
      notFollowingBack: results.filter(r => r.youFollow && !r.followsYou).length,
      dontFollowBack: results.filter(r => r.followsYou && !r.youFollow).length,
      keepCount: results.filter(r => r.recommendedAction === "KEEP").length,
      reviewCount: results.filter(r => r.recommendedAction === "REVIEW").length,
      removeCount: results.filter(r => r.recommendedAction === "REMOVE").length,
      spamCount: results.filter(r => r.tag === "spam").length,
      inactiveCount: results.filter(r => r.inactive).length,
      audienceQualityScore: totalF > 0 ? Math.round((realF / totalF) * 100) : 0,
      totalDays: batches.length,
    }
  };
}

// ─── Sample Data ─────────────────────────────────────────────────

const SAMPLE_FOLLOWERS = [
  { username: "sarah.marketing", full_name: "Sarah Chen", followers: "1240", following: "890", posts: "156", has_profile_pic: "true", bio: "Digital Marketing | NYC", is_verified: "false" },
  { username: "jakedesigns", full_name: "Jake Rivera", followers: "3400", following: "1100", posts: "234", has_profile_pic: "true", bio: "UI/UX Designer", is_verified: "false" },
  { username: "ceo_mindset", full_name: "Alex Thompson", followers: "8900", following: "2100", posts: "412", has_profile_pic: "true", bio: "CEO | Speaker | Author", is_verified: "true" },
  { username: "brand.builder.co", full_name: "BrandBuilder Co", followers: "5600", following: "3200", posts: "890", has_profile_pic: "true", bio: "We build brands that last", is_verified: "false" },
  { username: "emma.writes", full_name: "Emma Collins", followers: "780", following: "430", posts: "89", has_profile_pic: "true", bio: "Content writer & coffee lover", is_verified: "false" },
  { username: "digitaldan", full_name: "Dan Marks", followers: "2100", following: "1500", posts: "312", has_profile_pic: "true", bio: "Growth hacker", is_verified: "false" },
  { username: "thefoodnetworkchef", full_name: "Maria Lopez", followers: "45000", following: "800", posts: "1200", has_profile_pic: "true", bio: "Chef | Cookbook Author", is_verified: "true" },
  { username: "startup.daily", full_name: "Startup Daily", followers: "12000", following: "900", posts: "2300", has_profile_pic: "true", bio: "Your daily dose of startup news", is_verified: "false" },
  { username: "kate.social", full_name: "Kate Brown", followers: "670", following: "380", posts: "67", has_profile_pic: "true", bio: "Social media manager", is_verified: "false" },
  { username: "techreviewer_mike", full_name: "Mike Walsh", followers: "9800", following: "1200", posts: "567", has_profile_pic: "true", bio: "Tech reviews & more", is_verified: "false" },
  { username: "user928374829", full_name: "", followers: "12", following: "4500", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "follow4follow_2024", full_name: "Follow Me", followers: "34", following: "7500", posts: "1", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "maria.92847", full_name: "Maria", followers: "8", following: "3200", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "get_rich_now_99", full_name: "Money Guru", followers: "45", following: "6000", posts: "3", has_profile_pic: "true", bio: "DM me for $$$", is_verified: "false" },
  { username: "beauty_deals_4u", full_name: "", followers: "23", following: "5100", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "xxyyzz12345", full_name: "", followers: "5", following: "2800", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "free.followers.now", full_name: "Free Followers", followers: "67", following: "7800", posts: "2", has_profile_pic: "false", bio: "Get 10k followers FREE", is_verified: "false" },
  { username: "bot.account.38291", full_name: "", followers: "0", following: "4200", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "old.account.2019", full_name: "Tom", followers: "120", following: "340", posts: "0", has_profile_pic: "true", bio: "", is_verified: "false" },
  { username: "jenny_old", full_name: "Jennifer", followers: "89", following: "1200", posts: "0", has_profile_pic: "true", bio: "hey", is_verified: "false" },
  { username: "mark.abandoned", full_name: "Mark", followers: "45", following: "1800", posts: "2", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "ghostaccount.99", full_name: "", followers: "12", following: "900", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "unused_profile", full_name: "Alex", followers: "67", following: "1100", posts: "0", has_profile_pic: "true", bio: "hi", is_verified: "false" },
];

const SAMPLE_FOLLOWING = [
  ...SAMPLE_FOLLOWERS.slice(0, 7),
  { username: "garyvee", full_name: "Gary Vaynerchuk", followers: "9800000", following: "2100", posts: "12000", has_profile_pic: "true", bio: "CEO of VaynerMedia", is_verified: "true" },
  { username: "hubspot", full_name: "HubSpot", followers: "560000", following: "890", posts: "5600", has_profile_pic: "true", bio: "Grow better.", is_verified: "true" },
  { username: "neilpatel", full_name: "Neil Patel", followers: "420000", following: "1200", posts: "3400", has_profile_pic: "true", bio: "Helping you succeed online", is_verified: "true" },
  { username: "buffer", full_name: "Buffer", followers: "340000", following: "670", posts: "4500", has_profile_pic: "true", bio: "Social media management", is_verified: "true" },
  { username: "dormant.agency", full_name: "Dead Agency", followers: "230", following: "890", posts: "12", has_profile_pic: "true", bio: "We do things", is_verified: "false" },
  { username: "spam_king_99887", full_name: "", followers: "3", following: "8200", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "buy.likes.cheap", full_name: "Buy Likes", followers: "18", following: "5500", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "insta.growth.42918", full_name: "", followers: "7", following: "6100", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  { username: "make_money_fast_1", full_name: "Money", followers: "22", following: "4800", posts: "1", has_profile_pic: "false", bio: "DM for $$", is_verified: "false" },
  { username: "follow.train.2025", full_name: "", followers: "41", following: "7900", posts: "0", has_profile_pic: "false", bio: "", is_verified: "false" },
  ...SAMPLE_FOLLOWERS.slice(10, 13),
];

// ─── Dashboard Component ─────────────────────────────────────────

const BRAND = { black: "#0A0A0A", yellow: "#FFD600", darkGray: "#1A1A1A", medGray: "#2A2A2A", lightGray: "#888" };

const Badge = ({ action }) => {
  const colors = { KEEP: { bg: "#064e3b", text: "#6ee7b7" }, REVIEW: { bg: "#78350f", text: "#fbbf24" }, REMOVE: { bg: "#7f1d1d", text: "#fca5a5" } };
  const c = colors[action] || colors.REVIEW;
  return <span style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, background: c.bg, color: c.text, letterSpacing: "0.5px" }}>{action}</span>;
};

const TagBadge = ({ tag }) => {
  const colors = { real_audience: { bg: "#064e3b", text: "#6ee7b7" }, spam: { bg: "#7f1d1d", text: "#fca5a5" }, inactive: { bg: "#78350f", text: "#fbbf24" }, review: { bg: "#3b3b00", text: "#fde68a" } };
  const c = colors[tag] || colors.review;
  return <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, background: c.bg, color: c.text }}>{tag.replace("_", " ")}</span>;
};

const RiskBar = ({ score }) => {
  const max = 11;
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 5 ? "#ef4444" : score >= 3 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "60px", height: "6px", background: "#333", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "13px", fontWeight: 700, color, minWidth: "16px" }}>{score}</span>
    </div>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: BRAND.medGray, borderRadius: "12px", padding: "20px", flex: "1 1 140px", minWidth: "140px", border: accent ? `1px solid ${BRAND.yellow}` : "1px solid #333" }}>
    <div style={{ fontSize: "28px", fontWeight: 800, color: accent ? BRAND.yellow : "#fff", fontFamily: "system-ui" }}>{value}</div>
    <div style={{ fontSize: "13px", color: BRAND.lightGray, marginTop: "4px" }}>{label}</div>
    {sub && <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{sub}</div>}
  </div>
);

const QualityGauge = ({ score }) => {
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Healthy" : score >= 50 ? "Needs Work" : "Poor";
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#333" strokeWidth="10" />
        <circle cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 65 65)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="28" fontWeight="800" fontFamily="system-ui">{score}</text>
        <text x="65" y="80" textAnchor="middle" fill="#888" fontSize="11" fontFamily="system-ui">{label}</text>
      </svg>
    </div>
  );
};

export default function AudienceHygieneDashboard() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterTag, setFilterTag] = useState("ALL");
  const [sortCol, setSortCol] = useState("riskScore");
  const [sortDir, setSortDir] = useState("desc");
  const [uploading, setUploading] = useState(false);
  const [followersText, setFollowersText] = useState("");
  const [followingText, setFollowingText] = useState("");

  const loadSample = useCallback(() => {
    const result = runAnalysis(SAMPLE_FOLLOWERS, SAMPLE_FOLLOWING);
    setData(result);
    setTab("overview");
  }, []);

  const handleUpload = useCallback(() => {
    if (!followersText.trim() || !followingText.trim()) return;
    const fRows = parseCSVText(followersText);
    const gRows = parseCSVText(followingText);
    if (fRows.length === 0 || gRows.length === 0) return;
    const result = runAnalysis(fRows, gRows);
    setData(result);
    setUploading(false);
    setTab("overview");
  }, [followersText, followingText]);

  const filteredResults = useMemo(() => {
    if (!data) return [];
    let rows = data.results;
    if (search) rows = rows.filter(r => r.username.includes(search.toLowerCase()) || (r.fullName || "").toLowerCase().includes(search.toLowerCase()));
    if (filterAction !== "ALL") rows = rows.filter(r => r.recommendedAction === filterAction);
    if (filterTag !== "ALL") rows = rows.filter(r => r.tag === filterTag);
    rows = [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv || "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, search, filterAction, filterTag, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = ["username","full_name","follows_you","you_follow","followers","following","posts","risk_score","risk_reasons","inactive","tag","recommended_action"];
    const lines = [headers.join(",")];
    for (const r of filteredResults) {
      lines.push([r.username, `"${r.fullName}"`, r.followsYou?"yes":"no", r.youFollow?"yes":"no", r.followers, r.following, r.posts, r.riskScore, `"${r.riskReasons.join("; ")}"`, r.inactive?"yes":"no", r.tag, r.recommendedAction].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audience_audit_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─── Styles ──────────────────────────────────────────

  const page = { background: BRAND.black, color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh", padding: "24px" };
  const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" };
  const tabBar = { display: "flex", gap: "4px", background: BRAND.darkGray, borderRadius: "10px", padding: "4px", marginBottom: "24px" };
  const tabBtn = (active) => ({ padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: active ? BRAND.yellow : "transparent", color: active ? BRAND.black : "#888", transition: "all 0.2s" });
  const btn = (primary) => ({ padding: "10px 20px", borderRadius: "8px", border: primary ? "none" : `1px solid ${BRAND.yellow}`, cursor: "pointer", fontSize: "13px", fontWeight: 700, background: primary ? BRAND.yellow : "transparent", color: primary ? BRAND.black : BRAND.yellow, transition: "all 0.2s" });
  const input = { padding: "8px 14px", borderRadius: "8px", border: "1px solid #444", background: BRAND.darkGray, color: "#fff", fontSize: "13px", outline: "none", minWidth: "200px" };
  const select = { ...input, minWidth: "120px", cursor: "pointer" };
  const table = { width: "100%", borderCollapse: "separate", borderSpacing: "0" };
  const th = (col) => ({ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: BRAND.lightGray, cursor: "pointer", borderBottom: `1px solid #333`, background: sortCol === col ? "#222" : "transparent", userSelect: "none", whiteSpace: "nowrap" });
  const td = { padding: "10px 12px", borderBottom: "1px solid #1a1a1a", fontSize: "13px", whiteSpace: "nowrap" };

  // ─── Landing (no data yet) ─────────────────────────

  if (!data && !uploading) {
    return (
      <div style={page}>
        <div style={{ maxWidth: "600px", margin: "80px auto", textAlign: "center" }}>
          <div style={{ fontSize: "48px", fontWeight: 900, color: BRAND.yellow, letterSpacing: "-1px", textTransform: "uppercase", fontFamily: "Impact, system-ui" }}>Audience Hygiene</div>
          <div style={{ color: BRAND.lightGray, margin: "12px 0 36px", fontSize: "15px" }}>Identify spam, inactive accounts, and non-followers. Generate safe cleanup batches.</div>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={btn(true)} onClick={loadSample}>Load Sample Data</button>
            <button style={btn(false)} onClick={() => setUploading(true)}>Upload Your CSVs</button>
          </div>
          <div style={{ marginTop: "48px", textAlign: "left", background: BRAND.darkGray, borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontWeight: 700, marginBottom: "12px", color: BRAND.yellow }}>How to get your data</div>
            <div style={{ color: "#ccc", fontSize: "13px", lineHeight: "1.8" }}>
              <strong>Option A — Instagram Data Download</strong><br />
              Settings &rarr; Your Activity &rarr; Download Your Information &rarr; Request Download (JSON or HTML). Extract <code>followers.json</code> and <code>following.json</code>, then convert to CSV with the CLI tool.<br /><br />
              <strong>Option B — Third-party export tools</strong><br />
              Services like <em>IGExport</em>, <em>Phantombuster</em>, or <em>Inflact</em> can export follower/following lists as CSV. Ensure the CSV has at minimum a <code>username</code> column. Additional columns (followers, following, posts, has_profile_pic, bio) improve accuracy.<br /><br />
              <strong>Expected CSV format:</strong><br />
              <code style={{ display: "block", background: "#111", padding: "12px", borderRadius: "6px", marginTop: "6px", fontSize: "12px", overflowX: "auto" }}>
                username,full_name,followers,following,posts,has_profile_pic,bio,is_verified<br />
                sarah.marketing,"Sarah Chen",1240,890,156,true,"Digital Marketing",false
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Upload Modal ──────────────────────────────────

  if (uploading) {
    return (
      <div style={page}>
        <div style={{ maxWidth: "700px", margin: "40px auto" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: BRAND.yellow, marginBottom: "24px" }}>Upload CSV Data</div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "8px", color: "#ccc" }}>Followers CSV</label>
            <textarea style={{ ...input, width: "100%", minHeight: "120px", fontFamily: "monospace", fontSize: "12px", boxSizing: "border-box" }} placeholder="Paste your followers CSV content here..." value={followersText} onChange={e => setFollowersText(e.target.value)} />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "8px", color: "#ccc" }}>Following CSV</label>
            <textarea style={{ ...input, width: "100%", minHeight: "120px", fontFamily: "monospace", fontSize: "12px", boxSizing: "border-box" }} placeholder="Paste your following CSV content here..." value={followingText} onChange={e => setFollowingText(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={btn(true)} onClick={handleUpload}>Analyze</button>
            <button style={btn(false)} onClick={() => setUploading(false)}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────

  const { stats, dailyBatches } = data;

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div>
          <span style={{ fontSize: "24px", fontWeight: 900, color: BRAND.yellow, letterSpacing: "-0.5px", textTransform: "uppercase", fontFamily: "Impact, system-ui" }}>Audience Hygiene</span>
          <span style={{ color: BRAND.lightGray, fontSize: "13px", marginLeft: "12px" }}>The Mediatwist Group</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={btn(false)} onClick={exportCSV}>Export CSV</button>
          <button style={btn(false)} onClick={() => { setData(null); setUploading(false); }}>New Analysis</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabBar}>
        {["overview", "accounts", "removal", "batches"].map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* ─── Overview Tab ─── */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
            <StatCard label="Total Accounts" value={stats.totalAccounts} />
            <StatCard label="Your Followers" value={stats.totalFollowers.toLocaleString()} />
            <StatCard label="You Follow" value={stats.totalFollowing.toLocaleString()} />
            <StatCard label="Mutual Follows" value={stats.mutualFollows} />
            <StatCard label="Not Following Back" value={stats.notFollowingBack} sub="accounts you follow" />
          </div>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
            <div style={{ background: BRAND.medGray, borderRadius: "12px", padding: "24px", flex: "1 1 300px" }}>
              <div style={{ fontWeight: 700, marginBottom: "16px", color: BRAND.yellow }}>Audience Quality</div>
              <QualityGauge score={stats.audienceQualityScore} />
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: "16px" }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "20px", fontWeight: 800, color: "#22c55e" }}>{stats.keepCount}</div><div style={{ fontSize: "11px", color: "#888" }}>Keep</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "20px", fontWeight: 800, color: "#f59e0b" }}>{stats.reviewCount}</div><div style={{ fontSize: "11px", color: "#888" }}>Review</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "20px", fontWeight: 800, color: "#ef4444" }}>{stats.removeCount}</div><div style={{ fontSize: "11px", color: "#888" }}>Remove</div></div>
              </div>
            </div>
            <div style={{ background: BRAND.medGray, borderRadius: "12px", padding: "24px", flex: "1 1 300px" }}>
              <div style={{ fontWeight: 700, marginBottom: "16px", color: BRAND.yellow }}>Cleanup Plan</div>
              <div style={{ fontSize: "14px", color: "#ccc", lineHeight: "2" }}>
                <span style={{ color: "#ef4444", fontWeight: 700 }}>{stats.removeCount}</span> accounts flagged for removal<br />
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{stats.spamCount}</span> suspected spam / bot accounts<br />
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{stats.inactiveCount}</span> inactive accounts<br />
                <span style={{ fontWeight: 700, color: BRAND.yellow }}>{stats.totalDays}</span> {stats.totalDays === 1 ? "day" : "days"} to complete (50/day limit)
              </div>
              <div style={{ marginTop: "16px", padding: "10px 14px", background: "#1a1a1a", borderRadius: "8px", fontSize: "12px", color: "#888" }}>
                Safe rate: 50 unfollows/day max to avoid Instagram rate limits
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Accounts Tab ─── */}
      {tab === "accounts" && (
        <div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <input style={input} placeholder="Search username or name..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={select} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              <option value="ALL">All Actions</option>
              <option value="KEEP">Keep</option>
              <option value="REVIEW">Review</option>
              <option value="REMOVE">Remove</option>
            </select>
            <select style={select} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
              <option value="ALL">All Tags</option>
              <option value="real_audience">Real Audience</option>
              <option value="spam">Spam</option>
              <option value="inactive">Inactive</option>
            </select>
            <span style={{ color: BRAND.lightGray, fontSize: "12px" }}>{filteredResults.length} accounts</span>
          </div>
          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #333" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th("username")} onClick={() => handleSort("username")}>Username {sortCol === "username" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                  <th style={th("followsYou")} onClick={() => handleSort("followsYou")}>Follows You</th>
                  <th style={th("youFollow")} onClick={() => handleSort("youFollow")}>You Follow</th>
                  <th style={th("riskScore")} onClick={() => handleSort("riskScore")}>Risk {sortCol === "riskScore" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                  <th style={th("followers")} onClick={() => handleSort("followers")}>Followers</th>
                  <th style={th("following")} onClick={() => handleSort("following")}>Following</th>
                  <th style={th("posts")} onClick={() => handleSort("posts")}>Posts</th>
                  <th style={th("tag")}>Tag</th>
                  <th style={th("recommendedAction")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(0, 200).map((r, i) => (
                  <tr key={r.username} style={{ background: i % 2 === 0 ? "transparent" : "#111" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.username}</div>
                      {r.fullName && <div style={{ fontSize: "11px", color: "#666" }}>{r.fullName}</div>}
                    </td>
                    <td style={td}>{r.followsYou ? <span style={{ color: "#22c55e" }}>Yes</span> : <span style={{ color: "#ef4444" }}>No</span>}</td>
                    <td style={td}>{r.youFollow ? <span style={{ color: "#22c55e" }}>Yes</span> : <span style={{ color: "#666" }}>No</span>}</td>
                    <td style={td}><RiskBar score={r.riskScore} /></td>
                    <td style={td}>{r.followers.toLocaleString()}</td>
                    <td style={td}>{r.following.toLocaleString()}</td>
                    <td style={td}>{r.posts.toLocaleString()}</td>
                    <td style={td}><TagBadge tag={r.tag} /></td>
                    <td style={td}><Badge action={r.recommendedAction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Removal Queue Tab ─── */}
      {tab === "removal" && (
        <div>
          <div style={{ background: BRAND.medGray, borderRadius: "12px", padding: "16px", marginBottom: "16px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>{data.removalQueue.length} accounts</span>
            <span style={{ color: BRAND.lightGray, fontSize: "13px" }}>sorted by risk score (highest first, non-followers prioritized)</span>
          </div>
          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #333" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th("")}>#</th>
                  <th style={th("")}>Username</th>
                  <th style={th("")}>Risk Score</th>
                  <th style={th("")}>Reasons</th>
                  <th style={th("")}>Follows You</th>
                </tr>
              </thead>
              <tbody>
                {data.removalQueue.map((r, i) => (
                  <tr key={r.username} style={{ background: i % 2 === 0 ? "transparent" : "#111" }}>
                    <td style={{ ...td, color: "#666" }}>{i + 1}</td>
                    <td style={td}><span style={{ fontWeight: 600 }}>{r.username}</span></td>
                    <td style={td}><RiskBar score={r.riskScore} /></td>
                    <td style={{ ...td, fontSize: "12px", color: "#999", whiteSpace: "normal", maxWidth: "300px" }}>{r.riskReasons.join(" · ")}</td>
                    <td style={td}>{r.followsYou ? <span style={{ color: "#22c55e" }}>Yes</span> : <span style={{ color: "#ef4444" }}>No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Daily Batches Tab ─── */}
      {tab === "batches" && (
        <div>
          <div style={{ background: BRAND.medGray, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
            <span style={{ color: BRAND.yellow, fontWeight: 700 }}>{dailyBatches.length} {dailyBatches.length === 1 ? "day" : "days"}</span>
            <span style={{ color: BRAND.lightGray, fontSize: "13px", marginLeft: "8px" }}>at 50 accounts/day (safe rate limit)</span>
          </div>
          {dailyBatches.map(batch => (
            <div key={batch.day} style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: BRAND.yellow, marginBottom: "8px", padding: "8px 16px", background: BRAND.darkGray, borderRadius: "8px", display: "inline-block" }}>
                Day {batch.day} — {batch.accounts.length} accounts
              </div>
              <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #333" }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th("")}>#</th>
                      <th style={th("")}>Username</th>
                      <th style={th("")}>Risk</th>
                      <th style={th("")}>Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.accounts.map((r, i) => (
                      <tr key={r.username} style={{ background: i % 2 === 0 ? "transparent" : "#111" }}>
                        <td style={{ ...td, color: "#666" }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.username}</td>
                        <td style={td}><RiskBar score={r.riskScore} /></td>
                        <td style={{ ...td, fontSize: "12px", color: "#999", whiteSpace: "normal" }}>{r.riskReasons.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "32px", padding: "16px", textAlign: "center", color: "#444", fontSize: "11px", borderTop: "1px solid #222" }}>
        The Mediatwist Group — Audience Hygiene Tool — Always manually review before taking action — No automated removals
      </div>
    </div>
  );
}
