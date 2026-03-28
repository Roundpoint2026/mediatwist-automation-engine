const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getLeastUsedCategories, getUnusedHooks, isDuplicate, getRecentPosts, recordPost } = require('../memory/store.js');
const config = require('../config/engine.js');

/**
 * Background photo URLs per category — curated from Unsplash (royalty-free).
 * Each category has multiple options; one is picked at random per post.
 * Users can also add their own photos to public/backgrounds/ and they'll be
 * detected and mixed in automatically.
 */
const BACKGROUND_PHOTOS = {
  'Industry Insight': [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&q=80',  // Earth from space — tech/global
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&q=80',  // Matrix code rain
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&q=80',  // Circuit board macro
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1080&q=80',     // Cybersecurity/network
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1080&q=80',  // Abstract tech lines
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1080&q=80',  // Blockchain/digital
  ],
  'Contrarian Marketing Take': [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80',  // Person thinking
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1080&q=80',     // Conference room
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1080&q=80',     // Team brainstorming
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1080&q=80',  // Heated discussion
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1080&q=80',  // Whiteboard session
    'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1080&q=80',  // Debate/strategy
  ],
  'Case Study Breakdown': [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&q=80',  // Dashboard/analytics
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&q=80',     // Data charts
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1080&q=80',     // Business meeting
    'https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=1080&q=80',  // Data visualization
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1080&q=80',     // Business charts on screen
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1080&q=80',     // Startup war room
  ],
  'Founder/Operator Mindset': [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1080&q=80',  // Laptop workspace
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1080&q=80',  // Office desk
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&q=80',  // Modern office
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1080&q=80',  // Team in action
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1080&q=80',  // Open office vibe
    'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=1080&q=80',     // Entrepreneur hustle
  ],
  'Social Media Myth Busting': [
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1080&q=80',  // Social media apps
    'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1080&q=80',  // Phone with social
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1080&q=80',  // Neon social icons
    'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=1080&q=80',  // Social media on phone
    'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=1080&q=80',     // Like/share icons
    'https://images.unsplash.com/photo-1585247226801-bc613c441316?w=1080&q=80',  // Digital marketing
  ],
  'AI & Marketing Strategy': [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1080&q=80',  // AI abstract
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&q=80',  // Robot/AI
    'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=1080&q=80',     // Neural network
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1080&q=80',  // Robot face
    'https://images.unsplash.com/photo-1676299081847-824916de030a?w=1080&q=80',  // AI hologram
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=1080&q=80',  // Futuristic tech
  ],
  'Growth Hacking': [
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1080&q=80',     // Rocket launch
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1080&q=80',  // Growth chart
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1080&q=80',     // Team collaboration
    'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1080&q=80',  // Speed/motion blur
    'https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=1080&q=80',  // Climbing/summit
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1080&q=80',  // Code on laptop
  ],
  'Brand Authority': [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1080&q=80',  // Skyscraper/corporate
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1080&q=80',  // Luxury office
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&q=80',  // Business suit
    'https://images.unsplash.com/photo-1464938050520-ef2571b0b89c?w=1080&q=80',  // City skyline night
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1080&q=80',  // City aerial view
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=1080&q=80',     // Corporate building
  ],
  'Paid Media Intelligence': [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&q=80',     // Analytics dashboard
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&q=80',  // Data screen
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1080&q=80',  // Multiple screens
    'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=1080&q=80',     // Financial charts
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&q=80',  // Trading screens
    'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=1080&q=80',  // Data center
  ],
  'Content Strategy': [
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080&q=80',  // Laptop with coffee
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1080&q=80',  // Writing/notebook
    'https://images.unsplash.com/photo-1542435503-956c469947f6?w=1080&q=80',     // Creative workspace
    'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1080&q=80',  // Content creation desk
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1080&q=80',  // Laptop overhead
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1080&q=80',  // Pen and paper
  ],
};

/**
 * MASTER fallback backgrounds — high-impact, visually diverse photos.
 * Used when category-specific URLs AND local photos are unavailable.
 * CRITICAL: A background photo must ALWAYS be returned. Never allow plain black.
 */
const FALLBACK_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&q=80',  // Earth from space
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&q=80',  // Matrix code rain
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1080&q=80',  // Skyscraper
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1080&q=80',     // Rocket launch
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1080&q=80',     // Conference room
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1080&q=80',  // AI abstract
  'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1080&q=80',  // Multiple screens
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&q=80',  // Modern office
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1080&q=80',  // Laptop workspace
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&q=80',  // Business suit
  'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1080&q=80',  // Neon social icons
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&q=80',  // Robot/AI
];

/**
 * Pick a background photo URL for a given category.
 * Priority: local photos (public/backgrounds/) → category Unsplash URLs → master fallback pool.
 * GUARANTEED: Always returns a valid URL. NEVER returns null.
 */
function pickBackgroundPhoto(category) {
  const urls = BACKGROUND_PHOTOS[category] || [];

  // Check for local photos in public/backgrounds/
  const bgDir = path.resolve(__dirname, '../public/backgrounds');
  let localPhotos = [];
  try {
    if (fs.existsSync(bgDir)) {
      localPhotos = fs.readdirSync(bgDir)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => `backgrounds/${f}`); // staticFile path format
    }
  } catch (_) {}

  // Priority 1: Local photos if any exist (user's own photos get top billing)
  if (localPhotos.length > 0) {
    return localPhotos[Math.floor(Math.random() * localPhotos.length)];
  }

  // Priority 2: Category-specific Unsplash URLs
  if (urls.length > 0) {
    return urls[Math.floor(Math.random() * urls.length)];
  }

  // Priority 3: MASTER FALLBACK — never return null, always a real photo
  return FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];
}

/**
 * Content categories with executive-level, bold, authoritative copy
 * Targeting CEOs, Marketing Directors, and Business Operators
 */
const CONTENT_LIBRARY = {
  'Industry Insight': {
    hooks: [
      'Your competitors are already using this—and you don\'t even know it yet.',
      'The marketing metric everyone\'s chasing is completely broken. Here\'s what actually matters.',
      'This industry shift will obsolete 40% of current marketing stacks by 2027.',
      '87% of marketing leaders are measuring the wrong thing. The winners? They switched.',
      'The inflection point for your category just happened. You might have missed it.'
    ],
    bodies: [
      'The narrative around marketing ROI has been backwards. While competitors chase vanity metrics, the real power lies in second-order effects—customer lifetime value correlation, retention velocity, and how fast you can compress your sales cycle. Companies obsessed with last-touch attribution are leaving 3-5x revenue on the table. The winners operate from a different playbook: they map influence chains instead of touch points.',
      'Industry consolidation accelerates in downturns, but it creates a peculiar advantage for well-positioned players. The best time to build market share isn\'t during growth cycles—it\'s when competitors are resource-constrained. Your tech stack, creative velocity, and ability to ship fast become 10x more valuable. The next 18 months will separate the operators from the pretenders.',
      'The cost structure of customer acquisition is inverting. Paid media CPMs are climbing, organic reach is shrinking, but referral economics have never been better. The playbook that worked in 2023 doesn\'t scale in 2026. Your competitive advantage now comes from how effectively you can turn customers into your distribution channel.',
      'Market saturation is creating a strange new advantage: the ability to stand out through actual substance. Brands that invested in real differentiation while others chased trends are seeing exponential returns. Generic positioning is becoming commodity. Conviction and clear perspective are the new moats.',
      'The technical bar for execution has dropped, but the creative bar has risen dramatically. Your ability to compete is no longer about budget—it\'s about creativity, speed, and the quality of your thinking. Smart capital is flowing to founders and operators who can think in systems.'
    ],
    hashtags: ['#MarketingStrategy', '#IndustryInsight', '#MarketingLeadership', '#B2BMarketing', '#OperatorLife'],
    compositionHint: 'kinetic-typography'
  },
  'Contrarian Marketing Take': {
    hooks: [
      'Everyone in your industry is wrong about this.',
      'The trending marketing advice will cost you millions. Here\'s why.',
      'Your biggest competitor is making this exact mistake right now.',
      'The playbook that built successful brands 5 years ago is now a liability.',
      'Stop doing what "best practices" say. Here\'s what actually converts.'
    ],
    bodies: [
      'Attribution modeling has become religion, not science. Brands spend millions on platforms that promise precision but deliver theatre. The inconvenient truth: most B2B conversions happen because of repeated exposure to consistent positioning, not flashy campaigns. Yet marketing budgets still flow to tactics that look impressive in pitch decks. The contrarian move? Build for retention and referral velocity instead of customer acquisition cost.',
      'ABM failed because it treated accounts like they were homogeneous. Decision-makers within the same company have completely different motivations, timelines, and information needs. Broadcast + precision targeting beats micro-segmentation. The companies winning at enterprise sales aren\'t the ones with the most sophisticated CRM—they\'re the ones with the clearest message.',
      'Personalization at scale became an obsession that killed brand distinctiveness. Generic copy tailored with someone\'s first name isn\'t personalization—it\'s insult. The brands building real loyalty are the ones with a clear voice, a perspective, and the confidence to be polarizing. Bland and broad beats creepy and tailored.',
      'Social media strategy documents are written like fiction. "Increase engagement" and "build community" are not strategies—they\'re wishes. Real strategies involve tradeoffs: faster growth or deeper relationships, volume or authority, entertainment or education. Choose. The ambiguity costs you everything.',
      'Marketing automation promised efficiency but delivered mediocrity at scale. The best conversion sequences aren\'t the most elegant—they\'re the ones with human judgment, willingness to offend irrelevant audiences, and conviction about who you serve. Automation should amplify your thinking, not replace it.'
    ],
    hashtags: ['#MarketingTruth', '#Contrarian', '#MarketingMindset', '#GrowthStrategy', '#FakeNews'],
    compositionHint: 'bold-text-motion'
  },
  'Case Study Breakdown': {
    hooks: [
      'This company 10x\'d their marketing efficiency. Here\'s exactly how.',
      'A $2M marketing budget was completely redesigned. The results are absurd.',
      'They ignored industry playbooks and built something unprecedented.',
      'Most companies make this move at 100M ARR. They did it at 2M.',
      'The metrics are staggering. The strategy is simpler than you\'d expect.'
    ],
    bodies: [
      'Case: A B2B SaaS company hitting a plateau at $40M ARR realized their customer acquisition narrative was product-focused when their buyers actually cared about operational outcomes. They restructured their entire marketing around customer success stories—not testimonials, but detailed walkthroughs of how specific companies changed their business model using the product. Result: CAC dropped 38%, conversion rates tripled, and sales cycles compressed by 45%. The insight? Show the outcome, not the features.',
      'Case: An agency generating $15M annually was competing on credentials and expertise like everyone else in their space. They began publishing transparent case studies with actual numbers—revenue impact, timeline, investment. They showed failures alongside wins. Within 18 months, inbound pipeline 5x\'d and they could finally charge what they were worth. The insight? Transparency is the new competitive advantage.',
      'Case: A fintech startup at $8M ARR broke the mold by building a weekly newsletter that was genuinely useful—not marketing, not thought leadership, just genuinely smart analysis of industry moves and what they meant. No CTAs. Pure value. Their newsletter became more widely read than industry publications. Pipeline shifted from paid channels to newsletter-driven inbound. The insight? Build first for helpfulness, distribution comes naturally.',
      'Case: A vertical SaaS company repositioned from "software" to "business transformation platform" and completely restructured their marketing around operator personas. Instead of feature-based content, they published playbooks: "How to Reduce Churn by 20%" and "How to Build a Revenue Operations Function." Their content became required reading for their buyer category. The insight? Become essential, not just visible.',
      'Case: An enterprise software company was stuck in a procurement-dominated sales process. They created an education program targeting the technical users who would actually implement the system—not the procurement team. By the time procurement got involved, technical consensus was already formed. Sales cycles dropped from 8 months to 3. The insight? Sell to different stakeholders differently.'
    ],
    hashtags: ['#CaseStudy', '#MarketingResults', '#Strategy', '#Tactics', '#WhatWorks'],
    compositionHint: 'data-dashboard'
  },
  'Founder/Operator Mindset': {
    hooks: [
      'Your marketing strategy is backwards because your business strategy is backwards.',
      'Most scaling problems are actually positioning problems.',
      'The best marketing isn\'t marketing—it\'s how you\'ve designed your business.',
      'You can\'t market your way out of a product-market fit problem.',
      'Your growth ceiling is set by your positioning clarity. Period.'
    ],
    bodies: [
      'Founders obsess over marketing channels when they should obsess over competitive positioning. You can\'t optimize a machine that\'s fundamentally misaligned. The operating leverage in business comes from getting the positioning right, then building everything—product, pricing, go-to-market—in service of that positioning. Marketing becomes a lever that amplifies what\'s already working, not a band-aid for unclear strategy.',
      'The operator\'s competitive advantage is systems thinking. While competitors chase trends, operators see interconnections: how pricing affects positioning affects customer type affects retention. Marketing doesn\'t exist in isolation—it\'s part of a larger system. The best marketing operators think like business architects, not campaign managers.',
      'Scaling doesn\'t happen through better marketing tactics. It happens through clarity. The clearer your positioning, the easier your marketing job. The clearer your customer outcome, the easier your product job. Clarity is the moat. Everything else is execution against clarity.',
      'The companies building real moats aren\'t doing anything secret in marketing. They\'re just brutally honest about who they serve and who they don\'t serve. They\'re willing to be irrelevant to most of the market to be irreplaceable to the segment that matters. This conviction shows in everything—messaging, pricing, product decisions, hiring.',
      'Your growth is bottlenecked by belief. Not market size, not budget, not channels. Belief. If you don\'t deeply believe your positioning is true and valuable, it will never land with conviction. Spend less time optimizing funnels and more time getting unshakably clear on the fundamental truth of your business.'
    ],
    hashtags: ['#FounderMindset', '#Strategy', '#OperatorLife', '#Scaling', '#Business'],
    compositionHint: 'philosophical-typography'
  },
  'Social Media Myth Busting': {
    hooks: [
      'That viral strategy everyone copies? It doesn\'t work the way you think.',
      'LinkedIn\'s algorithm isn\'t complicated. The advice about it is just wrong.',
      'Stop doing what Instagram gurus tell you. Here\'s what actually works.',
      'The social media playbook that worked for creators won\'t work for B2B brands.',
      'You\'re measuring the wrong thing, so you\'re optimizing for the wrong thing.'
    ],
    bodies: [
      'Viral doesn\'t equal valuable. A post with 100K impressions and 5 qualified leads loses to a post with 2K impressions and 50 leads. The entire creator economy is built on optimizing metrics that don\'t matter for business. If you\'re following creator playbooks for B2B marketing, you\'re competing in the wrong game. Optimize for quality of audience, not size of audience.',
      'LinkedIn\'s algorithm rewards consistency and native content, not clicks. The advice to post multiple times daily, use controversial takes, or chase engagement metrics is backwards. LinkedIn rewards profiles that build a genuine audience around specific expertise. It\'s a reputation platform masquerading as a social network. Build authority, not virality.',
      'Short-form content (reels, shorts, TikToks) is excellent for brands targeting Gen Z consumers. For B2B? It\'s mostly theatre. Your decision-makers aren\'t scrolling TikTok for B2B solutions. They\'re on LinkedIn, reading newsletters, or asking peers. Spend your energy where your buyers actually spend their attention.',
      'The engagement-rate obsession has destroyed meaningful content. Brands post low-effort content because it gets engagement, then wonder why it doesn\'t drive business results. Engagement that doesn\'t correlate with business outcome is a vanity metric. Stop playing the algorithm game and start building a real audience.',
      'Community building on social media is a long-term play that doesn\'t have short-term metrics attached. Most brands give up after 3 months because they don\'t see ROI. Real community is built over years and worth millions in customer lifetime value. Stop optimizing for month-to-month and start building generational assets.'
    ],
    hashtags: ['#SocialMediaStrategy', '#LinkedIn', '#MarketingMyth', '#TruthBomb', '#Digital'],
    compositionHint: 'animated-stat-reveal'
  },
  'AI & Marketing Strategy': {
    hooks: [
      'AI won\'t replace marketing—but marketing teams that don\'t use AI will be replaced.',
      'The actual opportunity with AI in marketing isn\'t what everyone\'s talking about.',
      'Your competitors are already using this. You\'re not.',
      'AI changes the competitive economics of content. Here\'s how.',
      'This shift in marketing will happen faster than you expect.'
    ],
    bodies: [
      'AI isn\'t transforming marketing through writing tools and chatbots—it\'s transforming marketing through speed and iteration. The company that can test 100 message angles in a week beats the company that can test 5. The competitive advantage isn\'t having AI write your copy—it\'s having the systems and discipline to rapidly test, learn, and refine. AI is a multiplication operator on your existing process.',
      'The real AI opportunity is in personalization at scale. Not creepy micro-segmentation, but genuine understanding of buyer psychology at each stage. AI can analyze your buyer conversations and distill the actual motivations, objections, and language patterns that drive decisions. Then you use that intelligence to shape your messaging. This is a 10x advantage over broad-brush messaging.',
      'Content production velocity is becoming a moat. Teams using AI to augment their content processes are shipping at 3-5x the speed of traditional teams. But quantity without quality is noise. The winners use AI to handle mechanical work (first drafts, variations, formatting) so their humans can focus on strategy, insight, and actual thinking.',
      'AI changes what customers believe. The brands using AI to understand market sentiment, track positioning shifts, and respond faster than competitors are building real advantages. You can now have real-time market intelligence that used to require quarterly studies. Acting on this speed advantage is where the real competitive edge lives.',
      'The biggest risk isn\'t being behind on AI—it\'s using AI without strategy. AI amplifies bad thinking faster than good thinking. Invest in clarity on positioning first, then use AI to accelerate execution. The opposite approach—using AI to figure out positioning—will lead you astray.'
    ],
    hashtags: ['#AI', '#Marketing', '#Strategy', '#Innovation', '#Future'],
    compositionHint: 'futuristic-glitch'
  },
  'Growth Hacking': {
    hooks: [
      'This growth lever works at any stage. Most teams ignore it completely.',
      'The fastest way to grow isn\'t paid media. It\'s this.',
      'Your existing customers are your biggest untapped channel.',
      'This growth tactic works because it\'s not actually marketing.',
      'One small positioning shift unlocks 10x the inbound.'
    ],
    bodies: [
      'Referral loops are underutilized because they require discipline and forethought. Instead of chasing new customers through expensive channels, structure your product, pricing, and positioning to make it obvious why existing customers would refer you. Build an incentive structure that rewards referrers and makes referral effortless. The best growth isn\'t acquired—it\'s built into the business model.',
      'Product-led growth beats marketing-led growth when your product is genuinely superior and easy to evaluate. Instead of convincing prospects to buy, give them access to experience the value directly. Freemium models, free trials, and low-friction onboarding are more powerful growth engines than any marketing campaign. Get out of the way and let the product do the work.',
      'Strategic partnerships accelerate growth because they tap into adjacent audiences that already trust the partner. Instead of acquiring customers one at a time, find complementary products serving your target buyer and build win-win partnerships. Co-marketing, revenue sharing, and integration partnerships move the needle faster than traditional channels.',
      'Content marketing that actually converts is strategic and targeted, not broad and generic. Pick the specific moment in the buyer journey where you can intercept with exactly what they need. Create content so specific to that moment that it becomes impossible to ignore. Then distribute through channels where that buyer is actively looking.',
      'Positioning clarity creates organic growth because prospects naturally talk about you if you\'re genuinely different. Ambiguous positioning requires aggressive marketing to achieve awareness. Clear positioning makes you a default choice for a specific buyer type, and they become your marketing team.'
    ],
    hashtags: ['#GrowthHacking', '#Startups', '#Growth', '#Marketing', '#Tactics'],
    compositionHint: 'exponential-curve'
  },
  'Brand Authority': {
    hooks: [
      'Your brand is the premium option or it\'s a commodity. There\'s no middle ground.',
      'Authority is built through consistency, not cleverness.',
      'The companies charging 3x more aren\'t better—they\'re just clearer.',
      'Your positioning is either defensible or it\'s worthless.',
      'This is how premium brands think about marketing.'
    ],
    bodies: [
      'Authority isn\'t earned through advertising—it\'s earned through visibility in moments that matter. When prospects research solutions in your category, do they encounter your thinking? Do influential people in the space cite your work? Are you a default reference point in conversations? That\'s authority. It\'s built through strategic content placement and relentless focus on being useful to your buyer.',
      'Pricing power flows from perceived authority. You can charge more when prospects have no doubt about your expertise and positioning. The brands commanding premiums aren\'t necessarily better—they\'ve just invested heavily in signaling expertise through content, partnerships, and consistent messaging. Authority is an economic moat.',
      'Personal brands amplify company brands. When founders and executives build recognizable perspectives and visibility, it transfers to their company. Your team becomes an asset. Competitors can\'t easily replicate what you\'ve built because it\'s tied to real people with real reputations. Invest in your people becoming authorities.',
      'Authority requires a clear position you\'re willing to defend. It means saying no to opportunities that don\'t fit your positioning. It means turning away prospects who aren\'t a good fit. It means being polarizing. Brands trying to appeal to everyone have no authority with anyone.',
      'Authority compounds over time. Each piece of content, partnership, and customer success builds on the previous ones. The investment in brand building looks wasteful for the first 6-12 months, then becomes exponentially valuable. Most brands quit before they see returns. The ones that persist win.'
    ],
    hashtags: ['#BrandAuthority', '#Positioning', '#Leadership', '#Brand', '#Premium'],
    compositionHint: 'elegant-minimal'
  },
  'Paid Media Intelligence': {
    hooks: [
      'Your paid media spend is leaking money. Here\'s where.',
      'The CPM game is over. Smart teams have already moved on.',
      'Most marketing teams are optimizing for the wrong metric.',
      'Your competitors\' paid strategy is probably built on data from 2 years ago.',
      'This shift in paid media happened quietly. You might have missed it.'
    ],
    bodies: [
      'Paid media ROI is deteriorating across the board, but the decline isn\'t uniform. Brands bidding on commoditized keywords get crushed. Brands bidding on their brand terms get amazing returns. The opportunity is shifting from broad prospecting to narrow, high-intent targeting. Instead of building awareness through paid, use paid to dominate where intent is already high.',
      'Platform consolidation means your paid budget is competing in an increasingly rigged game. CPMs climb while conversion rates decline. The answer isn\'t to optimize creative harder—it\'s to shift budgets toward channels with lower saturation and higher intent. LinkedIn and industry-specific platforms are expensive but more efficient than commodity platforms.',
      'First-party data is the new currency of paid media effectiveness. Brands with rich first-party data—email lists, customer behavior data, website analytics—can create audiences that convert at 3-5x the rate of cold prospecting. If you\'re still mostly cold prospecting with paid, you\'re playing a losing game. Build your first-party data asset.',
      'Attribution in paid media is still broken, which means most teams are optimizing for the wrong things. Last-click attribution inflates the value of bottom-funnel paid while undervaluing top-funnel activities. The best paid teams use multi-touch models or view-through data to understand the actual contribution of each channel.',
      'Testing velocity in paid media separates winners from everyone else. The teams that can rapidly test messaging, creative, and targeting combinations get a compounding advantage. Technology enables this—modern ad platforms can test 20+ variations simultaneously. The question is whether your team has the discipline to learn from tests.'
    ],
    hashtags: ['#PaidMedia', '#Performance', '#Advertising', '#MarketingData', '#ROI'],
    compositionHint: 'dynamic-dashboard'
  },
  'Content Strategy': {
    hooks: [
      'Your content strategy is costing you millions because it\'s not actually a strategy.',
      'Most content is noise. Here\'s what signal looks like.',
      'Content marketing is dead. Strategic content is alive.',
      'You\'re creating content about the wrong thing.',
      'This is how companies build content that actually converts.'
    ],
    bodies: [
      'Content strategy isn\'t a content calendar—it\'s a business strategy. It starts with clarity: What is the specific moment in the buyer journey where you have an unfair advantage in changing minds? That moment determines everything: what content you create, what format, where you distribute, and how you measure success. Random content creation is just noise.',
      'Content authority flows from depth, not breadth. Instead of 20 mediocre pieces about your category, create 5 comprehensive guides that become the definitive resource. Be willing to spend 3-6 months on a single content asset if it\'s going to be unmissable. Depth and usefulness beat frequency and mediocrity.',
      'Distribution strategy matters as much as content quality. The best content you don\'t distribute is worthless. Develop distribution channels where your buyers already spend time. Build partnerships. Create formats that earn amplification. The content-to-distribution ratio should probably be 20/80, not 80/20.',
      'Repurposing content is a multiplier if done strategically. One core insight can become a blog post, a LinkedIn carousel, a case study, a webinar, and an email sequence. But repurposing without strategic adaptation is just noise multiplication. Each format has different requirements and audiences.',
      'Content strategy ROI is measured in positioning clarity and business results, not vanity metrics. If your content isn\'t making you easier to understand or your buyer journey shorter, it\'s not strategic. Audit your content: Does each piece reinforce your positioning? Does it move a specific buyer persona closer to decision? If not, delete it.'
    ],
    hashtags: ['#ContentStrategy', '#Content', '#Marketing', '#Thought Leadership', '#Positioning'],
    compositionHint: 'narrative-flow'
  }
};

/**
 * Maps categories to visual composition hints for design teams
 */
const COMPOSITION_HINTS = {
  'Industry Insight': 'kinetic-typography',
  'Contrarian Marketing Take': 'bold-text-motion',
  'Case Study Breakdown': 'data-dashboard',
  'Founder/Operator Mindset': 'philosophical-typography',
  'Social Media Myth Busting': 'animated-stat-reveal',
  'AI & Marketing Strategy': 'futuristic-glitch',
  'Growth Hacking': 'exponential-curve',
  'Brand Authority': 'elegant-minimal',
  'Paid Media Intelligence': 'dynamic-dashboard',
  'Content Strategy': 'narrative-flow'
};

/**
 * Platform-specific CTAs
 */
const CTAs = {
  facebook: [
    'Share this with your leadership team.',
    'Save this. You\'ll need it.',
    'Tag someone who needs to read this.',
    'Drop a comment. Let\'s debate this.',
    'Read the full breakdown in comments.'
  ],
  instagram: [
    'Save this. Screenshot it.',
    'Share this with your team.',
    'DM us your thoughts.',
    'What\'s your take? Comment below.',
    'Swipe through the full breakdown.'
  ],
  linkedin: [
    'What\'s your perspective on this?',
    'Do you agree or disagree? Let\'s discuss.',
    'This is a conversation starter.',
    'I\'m curious: How does this apply to your business?',
    'Share your own framework or approach in the comments.'
  ]
};

/**
 * Enhance template content using Claude API
 * @param {Object} templateContent - {hook, body, cta}
 * @param {string} category - Content category
 * @returns {Promise<Object>} Enhanced content or original if API fails
 */
async function enhanceWithClaude(templateContent, category) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return templateContent;
  }

  try {
    const enhancementPrompt = `You are a world-class B2B marketing strategist writing for executive audiences (CEOs, CMOs, business operators).

Current content for category "${category}":
Hook: "${templateContent.hook}"
Body: "${templateContent.body}"

Your task: Enhance this content to be more compelling, insightful, and pattern-interrupting while maintaining the original theme. The content should be:
- More specific and less generic
- More contrarian or provocative
- Include one concrete insight or pattern
- Use active, bold language
- Target business leaders directly
- Be exactly 2-3 sentences for hook, 3-4 sentences for body

Return a JSON object with "hook" and "body" keys containing the enhanced versions.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: (config.claude && config.claude.model) || 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: enhancementPrompt
          }
        ]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Parse Claude's response
    const responseText = response.data.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const enhanced = JSON.parse(jsonMatch[0]);
      return {
        hook: enhanced.hook || templateContent.hook,
        body: enhanced.body || templateContent.body
      };
    }

    return templateContent;
  } catch (error) {
    console.warn('Claude API enhancement failed, falling back to template:', error.message);
    return templateContent;
  }
}

/**
 * Select random item from array
 * @param {Array} arr
 * @returns {*}
 */
function selectRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate platform-specific content
 * @param {Object} contentData - {category, hook, body, hashtags}
 * @param {string} platform - 'facebook', 'instagram', 'linkedin'
 * @returns {Object}
 */
function generatePlatformContent(contentData, platform) {
  const { category, hook, body, hashtags } = contentData;
  const cta = selectRandom(CTAs[platform]);

  let caption = '';

  // Platform-specific formatting — caption IS the full post text
  if (platform === 'facebook') {
    caption = `${hook}\n\n${body}\n\n${cta}`;
  } else if (platform === 'instagram') {
    caption = `${hook}\n\n${body}\n\n${cta}\n\n${hashtags.join(' ')}`;
  } else if (platform === 'linkedin') {
    caption = `${hook}\n\n${body}\n\n${cta}`;
  }

  return {
    hook,
    body,
    cta,
    caption,
    category,
    hashtags: platform === 'instagram' ? hashtags : [],
    compositionHint: COMPOSITION_HINTS[category],
    imageUrl: null, // Set by publisher if needed
  };
}

/**
 * Generate daily content across all platforms
 * Returns content for Facebook, Instagram, and LinkedIn with deduplication
 * @returns {Promise<Object>} {facebook, instagram, linkedin}
 */
async function generateDailyContent() {
  const categories = Object.keys(CONTENT_LIBRARY);
  const leastUsedCategories = getLeastUsedCategories(categories);
  const selectedCategory = leastUsedCategories[0] || selectRandom(categories);

  const categoryContent = CONTENT_LIBRARY[selectedCategory];
  const unusedHooks = getUnusedHooks(selectedCategory, categoryContent.hooks);

  const selectedHook = unusedHooks.length > 0
    ? selectRandom(unusedHooks)
    : selectRandom(categoryContent.hooks);

  const selectedBody = selectRandom(categoryContent.bodies);

  // Attempt to enhance with Claude if API key is available
  let contentToUse = {
    hook: selectedHook,
    body: selectedBody
  };

  try {
    contentToUse = await enhanceWithClaude(contentToUse, selectedCategory);
  } catch (error) {
    // Fall through to template content
    console.warn('Enhancement step failed, using template content');
  }

  // Deduplication check — isDuplicate takes a single caption string
  let attempts = 0;
  const maxAttempts = 3;
  let isDuplicated = true;

  while (isDuplicated && attempts < maxAttempts) {
    const captionToCheck = contentToUse.hook + '\n' + contentToUse.body;
    if (!isDuplicate(captionToCheck)) {
      isDuplicated = false;
      break;
    }

    // Pick different content
    const newHook = selectRandom(categoryContent.hooks);
    const newBody = selectRandom(categoryContent.bodies);
    contentToUse = { hook: newHook, body: newBody };
    attempts++;
  }

  if (isDuplicated) {
    console.warn(`Could not find fully unique content after ${maxAttempts} attempts, proceeding anyway`);
  }

  // Generate platform-specific versions
  const baseContent = {
    category: selectedCategory,
    hook: contentToUse.hook,
    body: contentToUse.body,
    hashtags: categoryContent.hashtags
  };

  const result = {
    facebook: generatePlatformContent(baseContent, 'facebook'),
    instagram: generatePlatformContent(baseContent, 'instagram'),
    linkedin: generatePlatformContent(baseContent, 'linkedin'),
    metadata: {
      category: selectedCategory,
      brand: 'The Mediatwist Group',
      handle: '@mediatwist',
      colors: ['Black', 'Yellow'],
      timestamp: new Date().toISOString()
    },
    visual_direction: {
      theme: `Bold executive-level ${selectedCategory.toLowerCase()} — black/yellow Mediatwist brand palette with photo background`,
      layout: {
        logo_position: 'bottom-left',
        logo_clearspace_percentage: '25%',
        content_zone: 'top 80% of frame + right 75% of bottom area — all text and graphics here',
        safe_zones_description: 'Bottom-left 250×200px is RESERVED for logo overlay. No text, handles, or decorations may enter this zone. @mediatwist handle goes bottom-right.',
      },
      background_style: 'Photo background with dark overlay for readability + yellow (#FFD600) geometric accents — accents must avoid bottom-left logo zone',
      backgroundImageUrl: pickBackgroundPhoto(selectedCategory),
      overlay_elements: 'Yellow accent lines, abstract shapes, progress bars — confined to content zone only, never overlapping bottom-left logo zone',
      text_style: 'Ultra-bold condensed uppercase font (Impact/Bebas Neue style) for headlines. White text with yellow highlights. @mediatwist handle at BOTTOM-RIGHT.',
      motion_style: categoryContent.compositionHint || 'kinetic-typography',
    }
  };

  return result;
}

/**
 * Generate content for a specific category (utility function)
 * @param {string} category - Content category
 * @returns {Promise<Object>} Platform-specific content
 */
async function generateContentByCategory(category) {
  if (!CONTENT_LIBRARY[category]) {
    throw new Error(`Unknown category: ${category}`);
  }

  const categoryContent = CONTENT_LIBRARY[category];
  const selectedHook = selectRandom(categoryContent.hooks);
  const selectedBody = selectRandom(categoryContent.bodies);

  let contentToUse = {
    hook: selectedHook,
    body: selectedBody
  };

  try {
    contentToUse = await enhanceWithClaude(contentToUse, category);
  } catch (error) {
    console.warn('Enhancement step failed, using template content');
  }

  // Note: recording happens in the scheduler/orchestrator after successful publish

  const baseContent = {
    category,
    hook: contentToUse.hook,
    body: contentToUse.body,
    hashtags: categoryContent.hashtags
  };

  return {
    facebook: generatePlatformContent(baseContent, 'facebook'),
    instagram: generatePlatformContent(baseContent, 'instagram'),
    linkedin: generatePlatformContent(baseContent, 'linkedin'),
    metadata: {
      category,
      brand: 'The Mediatwist Group',
      handle: '@mediatwist',
      colors: ['Black', 'Yellow'],
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get all available categories
 * @returns {Array<string>}
 */
function getAvailableCategories() {
  return Object.keys(CONTENT_LIBRARY);
}

module.exports = {
  generateDailyContent,
  generateContentByCategory,
  getAvailableCategories,
  CONTENT_LIBRARY,
  COMPOSITION_HINTS
};
