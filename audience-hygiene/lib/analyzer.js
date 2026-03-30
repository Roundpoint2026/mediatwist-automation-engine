/**
 * Instagram Audience Hygiene — Analysis Engine
 *
 * Classifies followers into KEEP / REVIEW / REMOVE buckets
 * using heuristic scoring. No Instagram API calls — works
 * entirely from CSV exports.
 *
 * @module analyzer
 */

const RISK_WEIGHTS = {
  noPosts:           2,
  highFollowing:     2,   // following > 1000
  lowFollowers:      2,   // followers < 50
  randomUsername:    1,
  noProfilePic:      1,
  extremeRatio:      2,   // following/followers > 20
  genericBio:        1,   // no bio or very short bio
};

const THRESHOLDS = {
  highFollowing:  1000,
  lowFollowers:   50,
  inactiveFollowing: 1000,
  inactiveFollowers: 100,
  extremeRatio:  20,
  removeScore:   5,
  reviewScore:   3,
};

/**
 * Normalize a raw CSV row into a standard shape.
 */
function normalizeUser(raw) {
  return {
    username:       (raw.username || raw.Username || raw.handle || '').toLowerCase().trim(),
    fullName:       raw.full_name || raw.fullName || raw.name || raw.Name || '',
    followers:      parseInt(raw.followers || raw.follower_count || raw.Followers || 0, 10) || 0,
    following:      parseInt(raw.following || raw.following_count || raw.Following || 0, 10) || 0,
    posts:          parseInt(raw.posts || raw.media_count || raw.Posts || 0, 10) || 0,
    hasProfilePic:  parseBool(raw.has_profile_pic || raw.hasProfilePic || raw.profile_pic || 'true'),
    bio:            raw.bio || raw.biography || '',
    isPrivate:      parseBool(raw.is_private || raw.isPrivate || 'false'),
    isVerified:     parseBool(raw.is_verified || raw.isVerified || 'false'),
    engagementRate: parseFloat(raw.engagement_rate || raw.engagementRate || 0) || 0,
    lastActivity:   raw.last_activity || raw.lastActivity || '',
  };
}

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

/**
 * Detect random-looking usernames:
 *  - 4+ consecutive digits
 *  - pattern like user928374829
 */
function hasRandomUsername(username) {
  if (/\d{4,}/.test(username)) return true;
  if (/^[a-z]{2,6}\d{5,}$/.test(username)) return true;
  if (/^[a-z]+[._]\d{4,}$/.test(username)) return true;
  return false;
}

/**
 * Calculate risk score for a single user (0–10+).
 */
function calculateRiskScore(user) {
  let score = 0;
  const reasons = [];

  if (user.posts === 0) {
    score += RISK_WEIGHTS.noPosts;
    reasons.push('no posts');
  }

  if (user.following > THRESHOLDS.highFollowing) {
    score += RISK_WEIGHTS.highFollowing;
    reasons.push(`following ${user.following.toLocaleString()} accounts`);
  }

  if (user.followers < THRESHOLDS.lowFollowers) {
    score += RISK_WEIGHTS.lowFollowers;
    reasons.push(`only ${user.followers} followers`);
  }

  if (hasRandomUsername(user.username)) {
    score += RISK_WEIGHTS.randomUsername;
    reasons.push('suspicious username pattern');
  }

  if (!user.hasProfilePic) {
    score += RISK_WEIGHTS.noProfilePic;
    reasons.push('no profile picture');
  }

  if (user.followers > 0 && user.following / user.followers > THRESHOLDS.extremeRatio) {
    score += RISK_WEIGHTS.extremeRatio;
    reasons.push('extreme following/follower ratio');
  }

  if (!user.bio || user.bio.trim().length < 3) {
    score += RISK_WEIGHTS.genericBio;
    reasons.push('no bio');
  }

  return { score, reasons };
}

/**
 * Determine if a user looks inactive.
 */
function isInactive(user) {
  if (user.posts === 0) return true;
  if (user.following > THRESHOLDS.inactiveFollowing && user.followers < THRESHOLDS.inactiveFollowers) return true;
  if (user.lastActivity) {
    const last = new Date(user.lastActivity);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (last < sixMonthsAgo) return true;
  }
  return false;
}

/**
 * Classify user tag.
 */
function classifyTag(user, riskScore) {
  if (user.isVerified) return 'real_audience';
  if (riskScore >= THRESHOLDS.removeScore) return 'spam';
  if (isInactive(user)) return 'inactive';
  if (riskScore >= THRESHOLDS.reviewScore) return 'review';
  return 'real_audience';
}

/**
 * Determine recommended action.
 */
function recommendAction(user, riskScore, followsYou) {
  if (user.isVerified) return 'KEEP';
  if (riskScore >= THRESHOLDS.removeScore && !followsYou) return 'REMOVE';
  if (riskScore >= THRESHOLDS.removeScore) return 'REVIEW';
  if (riskScore >= THRESHOLDS.reviewScore) return 'REVIEW';
  if (!followsYou && isInactive(user)) return 'REVIEW';
  return 'KEEP';
}

/**
 * Main analysis function.
 *
 * @param {Object[]} followers  — normalized follower list
 * @param {Object[]} following  — normalized following list
 * @returns {Object} Full analysis result
 */
function analyzeAudience(followers, following) {
  const followerSet = new Set(followers.map(u => u.username));
  const followingSet = new Set(following.map(u => u.username));

  // Merge into a single map of all known users
  const allUsers = new Map();
  followers.forEach(u => allUsers.set(u.username, { ...u }));
  following.forEach(u => {
    if (allUsers.has(u.username)) {
      // Merge data — prefer follower data but fill gaps
      const existing = allUsers.get(u.username);
      allUsers.set(u.username, { ...u, ...existing });
    } else {
      allUsers.set(u.username, { ...u });
    }
  });

  const results = [];

  for (const [username, user] of allUsers) {
    const followsYou = followerSet.has(username);
    const youFollow = followingSet.has(username);
    const { score: riskScore, reasons } = calculateRiskScore(user);
    const inactive = isInactive(user);
    const action = recommendAction(user, riskScore, followsYou);
    const tag = classifyTag(user, riskScore);

    results.push({
      username,
      fullName: user.fullName,
      followsYou,
      youFollow,
      followers: user.followers,
      following: user.following,
      posts: user.posts,
      hasProfilePic: user.hasProfilePic,
      isVerified: user.isVerified,
      riskScore,
      riskReasons: reasons,
      inactive,
      tag,
      recommendedAction: action,
    });
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore);

  // Compute audience quality score
  const totalFollowers = results.filter(r => r.followsYou).length;
  const realFollowers = results.filter(r => r.followsYou && r.tag === 'real_audience').length;
  const audienceQualityScore = totalFollowers > 0
    ? Math.round((realFollowers / totalFollowers) * 100)
    : 0;

  // Build removal queue (highest risk + not following back first)
  const removalQueue = results
    .filter(r => r.recommendedAction === 'REMOVE')
    .sort((a, b) => {
      // Not following back takes priority
      if (a.followsYou !== b.followsYou) return a.followsYou ? 1 : -1;
      return b.riskScore - a.riskScore;
    });

  // Build daily batches (50 per day)
  const BATCH_SIZE = 50;
  const dailyBatches = [];
  for (let i = 0; i < removalQueue.length; i += BATCH_SIZE) {
    dailyBatches.push({
      day: Math.floor(i / BATCH_SIZE) + 1,
      accounts: removalQueue.slice(i, i + BATCH_SIZE),
    });
  }

  // Summary stats
  const stats = {
    totalAccounts: results.length,
    totalFollowers: followerSet.size,
    totalFollowing: followingSet.size,
    mutualFollows: results.filter(r => r.followsYou && r.youFollow).length,
    notFollowingBack: results.filter(r => r.youFollow && !r.followsYou).length,
    dontFollowBack: results.filter(r => r.followsYou && !r.youFollow).length,
    keepCount: results.filter(r => r.recommendedAction === 'KEEP').length,
    reviewCount: results.filter(r => r.recommendedAction === 'REVIEW').length,
    removeCount: results.filter(r => r.recommendedAction === 'REMOVE').length,
    spamCount: results.filter(r => r.tag === 'spam').length,
    inactiveCount: results.filter(r => r.inactive).length,
    audienceQualityScore,
    totalDays: dailyBatches.length,
  };

  return { results, removalQueue, dailyBatches, stats };
}

module.exports = {
  normalizeUser,
  calculateRiskScore,
  isInactive,
  classifyTag,
  recommendAction,
  analyzeAudience,
  hasRandomUsername,
  THRESHOLDS,
  RISK_WEIGHTS,
};
