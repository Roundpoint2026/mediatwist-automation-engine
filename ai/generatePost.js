'use strict';

var CATEGORIES = [
  'Social Media Strategy',
  'Content Marketing',
  'Paid Advertising',
  'Email Marketing',
  'SEO and Organic Growth',
  'Brand Strategy',
  'Analytics and Data',
  'Agency Life',
  'Growth and Business',
  'AI and Marketing'
];

var HOOKS = {
  'Social Media Strategy': [
    'Hot take: Posting more often is NOT the answer.',
    'Most brands are wasting their best content.',
    'Stop chasing followers. Chase this instead:',
    '3 social media mistakes costing you reach right now:',
    'The algorithm rewards this one thing above everything else:'
  ],
  'Content Marketing': [
    'Your content is not the problem. Your strategy is.',
    'The secret to content that gets shared over and over:',
    'Hot take: 1 great post a week beats 7 mediocre ones.',
    'Why 90% of content gets zero engagement (and how to fix it):',
    'Bookmark this: the content framework we use for every client:'
  ],
  'Paid Advertising': [
    'Most Facebook ad budgets are set up wrong.',
    'Stop boosting posts. Do this instead:',
    '3 Meta ad mistakes we see every single week:',
    'Hot take: A $10 per day ad budget can outperform a $1,000 one.',
    'Your Facebook ads are not failing. Your targeting is.'
  ],
  'Email Marketing': [
    'Email is not dead. Your subject lines are.',
    'The email strategy that drives a 40% open rate:',
    '3 emails every business should be sending but is not:',
    'Hot take: Your email list is worth more than your social following.',
    'Stop sending newsletters. Send this instead:'
  ],
  'SEO and Organic Growth': [
    'Google is changing. Here is what still works in 2026:',
    'The organic growth strategy most agencies will not tell you about:',
    '3 SEO wins you can get this week without a single backlink:',
    'Hot take: You do not need to rank number 1 to win on Google.',
    'Why your website is not showing up and the fast fix:'
  ],
  'Brand Strategy': [
    'Your brand is not your logo. It is this:',
    'The brands growing fastest all have one thing in common:',
    'Hot take: Most businesses do not have a brand. They have a business card.',
    '3 brand positioning moves that actually move the needle:',
    'Why people buy from brands they trust and how to become one:'
  ],
  'Analytics and Data': [
    'The metric everyone tracks and the one that actually matters:',
    'Stop obsessing over likes. Track this instead:',
    '3 numbers every business owner should check every Monday:',
    'Hot take: Vanity metrics are killing your marketing decisions.',
    'Data does not lie. Here is what yours is probably telling you:'
  ],
  'Agency Life': [
    'Here is what working with a digital agency actually looks like:',
    'We have run campaigns for 50+ businesses. Here is the number 1 thing that separates winners:',
    'A client came to us stuck at 500 followers. Here is what we did:',
    'Hot take: Most businesses hire a marketing agency too late.',
    'Behind the scenes at Mediatwist this week:'
  ],
  'Growth and Business': [
    'The growth strategy that costs $0 and most businesses ignore:',
    '3 things holding your business back from the next level:',
    'Hot take: Your biggest competitor is your own inconsistency.',
    'Small businesses that grow fast all do this one thing:',
    'The compounding effect of showing up online every single day:'
  ],
  'AI and Marketing': [
    'AI will not replace marketers. Marketers who use AI will replace those who do not.',
    '3 ways we are using AI at Mediatwist to save 10+ hours a week:',
    'Hot take: Most businesses are using AI wrong.',
    'The AI tools actually worth your time in 2026:',
    'Brands using AI in their content strategy are outpacing the competition.'
  ]
};

var BODIES = {
  'Social Media Strategy': [
    'Post consistency beats post frequency.\nEngagement in the first 30 min signals the algorithm.\nReplying to comments doubles your reach on most posts.\n\nOne tweak. One week. See what happens.',
    'Batch-create content in 2-hour blocks, not daily scrambles.\nRepurpose your top posts every 90 days for a new audience.\nReach down? Engage for 20 min before you post.\n\nSimple systems beat complicated strategies every time.',
    'Native video is rewarded on every platform over external links.\nAsk questions that invite a one-word answer.\nYour bio is your landing page. Optimize it.\n\nTry one of these today and watch your numbers shift.'
  ],
  'Content Marketing': [
    'Solve one specific problem per post.\nUse numbers. "5 ways" beats "some ways" every time.\nWrite for the person, not the algorithm.\n\nContent that helps gets shared. Content that sells gets scrolled past.',
    'Your best content repurposes your best conversations.\nA FAQ post takes 10 minutes and drives traffic for months.\n"Bookmark this" posts outperform "like this" posts 3 to 1.\n\nCreate content worth saving, not just liking.',
    'Hooks are 80% of your content success.\nThe first line either earns the scroll or loses it.\nRead your first sentence out loud. Would YOU keep reading?\n\nRewrite your last post first line. You will see the difference.'
  ],
  'Paid Advertising': [
    'Broad audiences plus strong creative beats hyper-targeting in 2026.\nLet the pixel learn for 7 days before making changes.\nTest 3 hooks, keep the winner, cut the rest after 72 hours.\n\nThe best ads do not look like ads. They look like content.',
    'Retargeting website visitors costs 10x less than cold audiences.\nVideo thumb-stops matter more than clicks.\n$5 per day on a warm audience beats $50 per day on cold.\n\nSmaller budget. Smarter targeting. That is the play.',
    'Your ad creative should match your landing page.\nFrequency above 4 means audience fatigue. Refresh the creative.\nTest copy with dark posts before putting spend behind it.\n\nThe ad did not fail. The strategy around it did.'
  ],
  'Email Marketing': [
    'Subject lines under 50 characters get opened more.\nOne email, one CTA. Always.\nSend Tuesday or Thursday mornings for highest open rates.\n\nEmail is still the highest-ROI channel in digital marketing. Use it.',
    'Welcome emails get 4x the open rate of regular campaigns.\nSegment your list. Even buyers vs non-buyers changes everything.\nRe-engagement campaigns recover 10 to 15% of cold subscribers.\n\nYour list is an asset. Treat it like one.',
    'Plain-text emails often outperform designed ones. Test it.\nTell a story first, pitch second.\nYour unsubscribe rate tells you more than your open rate.\n\nThe goal is not to email everyone. It is to reach the right people at the right time.'
  ],
  'SEO and Organic Growth': [
    'Answer questions your customers are actually searching.\nLong-form content of 1,500 plus words outranks thin pages consistently.\nInternal linking is free SEO most businesses ignore.\n\nGoogle rewards depth. Give it depth.',
    'Your Google Business Profile is free real estate. Optimize it.\nLocal SEO beats national for most small businesses.\nReviews are a ranking signal. Ask for them after every win.\n\nYou do not need a huge budget to rank. You need a consistent strategy.',
    'Update old blog posts. Google loves freshness.\nUse your top keywords in page titles and your first paragraph.\nPage speed affects rankings. Run a free Core Web Vitals check today.\n\nSmall tweaks compound into big organic wins over 90 days.'
  ],
  'Brand Strategy': [
    'Be specific about who you help. Everyone is no one.\nYour origin story is a brand asset most businesses never use.\nConsistent visuals increase brand recognition by up to 80%.\n\nClarity is a competitive advantage. Be the obvious choice.',
    'Brand voice is how you talk.\nBrand positioning is who you talk to and why they should care.\nBrand consistency is showing up the same way everywhere, every time.\n\nStrong brands do not just get noticed. They get remembered.',
    'What do clients say about you when you are not in the room?\nThat is your brand.\nBuild it intentionally, or it will be built for you.\n\nReputation is a brand strategy. Make yours on purpose.'
  ],
  'Analytics and Data': [
    'Reach equals how many people saw it.\nEngagement rate equals how many people cared.\nConversion equals how many people acted.\n\nTrack all three. Optimize for the one that matters most right now.',
    'Check your best-performing posts every Monday.\nFind the pattern: topic, format, time of day.\nDouble down on what worked. Stop guessing.\n\nYour analytics tell you exactly what to post next. Are you listening?',
    'A 2% engagement rate on Facebook is solid.\nAbove 5% is exceptional.\nBelow 1%? Your content or targeting needs a reset.\n\nKnow your benchmarks. Then beat them.'
  ],
  'Agency Life': [
    'We audit the account before we touch anything.\nWe set 90-day goals, not "see how it goes" timelines.\nWe report with actual numbers, not pretty chart screenshots.\n\nThat is the Mediatwist standard. Every client, every time.',
    'The best campaigns start with: What does success look like?\nMost businesses skip that step. We do not.\nStrategy first. Execution second. Results third.\n\nThis is how you build marketing that actually grows a business.',
    'We have seen $500 per month budgets outperform $5,000 per month ones.\nThe difference? Strategy, creative, and consistency.\nMediatwist helps you get all three.\n\nBig results do not require a big agency. They require the right one.'
  ],
  'Growth and Business': [
    'Show up online consistently for 90 days. Things shift.\nEngage with your audience daily. Even 10 minutes matters.\nOne piece of content repurposed equals 3x the reach for 1x the work.\n\nGrowth is not a hack. It is a habit.',
    'The businesses winning online in 2026 document everything.\nBehind-the-scenes content builds trust faster than polished ads.\nYour process IS your content. Start sharing it.\n\nAuthenticity is not a trend. It is a growth strategy.',
    'Referrals are still the highest-converting lead source.\nBuild a referral system before you need it.\nA thank-you message after a win can generate 2 to 3 new clients.\n\nThe best marketing makes your current clients want to talk about you.'
  ],
  'AI and Marketing': [
    'Use AI to draft, humans to refine. Never publish AI copy unedited.\nAI tools can cut content creation time by 60% when used right.\nThe competitive advantage is not AI. It is knowing how to use it.\n\nThe tool is only as smart as the strategy behind it.',
    'AI can generate ideas in seconds. Strategy still requires a human.\nUse it for: first drafts, repurposing, headline testing, caption variations.\nDo not use it for: your brand voice, client relationships, or strategy.\n\nAI is a multiplier. It amplifies what you already do well.',
    'Brands using AI for content are getting 3 to 5x more output.\nBrands using AI for analytics are catching trends 2 weeks earlier.\nBrands not using AI are falling behind every month.\n\n2026 is the year this gap becomes impossible to close. Start now.'
  ]
};

var CTAS = [
  'Drop a comment below if this hit home.',
  'What would you add? Comment below.',
  'Tag a business owner who needs to hear this.',
  'Save this post. You will want it later.',
  'Comment YES if this resonates with you.',
  'Which of these are you already doing? Tell us below.',
  'Share this with someone building their brand right now.',
  'What is your biggest challenge with this? Comment below.',
  'Send us a message if you want help applying this to your business.',
  'Follow The Mediatwist Group for more strategy like this every week.'
];

var HASHTAGS = {
  'Social Media Strategy':    '#Mediatwist #SocialMediaMarketing #SocialMediaTips #FacebookMarketing #DigitalMarketing',
  'Content Marketing':        '#Mediatwist #ContentMarketing #ContentStrategy #DigitalMarketing #MarketingTips',
  'Paid Advertising':         '#Mediatwist #FacebookAds #PaidMedia #MetaAds #DigitalMarketing',
  'Email Marketing':          '#Mediatwist #EmailMarketing #DigitalMarketing #MarketingStrategy #GrowYourBusiness',
  'SEO and Organic Growth':   '#Mediatwist #SEO #OrganicGrowth #DigitalMarketing #MarketingTips',
  'Brand Strategy':           '#Mediatwist #BrandStrategy #BrandBuilding #DigitalMarketing #MarketingStrategy',
  'Analytics and Data':       '#Mediatwist #MarketingAnalytics #DataDriven #DigitalMarketing #MarketingStrategy',
  'Agency Life':              '#Mediatwist #AgencyLife #DigitalAgency #DigitalMarketing #MarketingStrategy',
  'Growth and Business':      '#Mediatwist #GrowYourBusiness #SmallBusinessMarketing #DigitalMarketing #MarketingTips',
  'AI and Marketing':         '#Mediatwist #AIMarketing #FutureOfMarketing #DigitalMarketing #MarketingStrategy'
};

var IMAGES = {
  'Social Media Strategy':    'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1080',
  'Content Marketing':        'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080',
  'Paid Advertising':         'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1080',
  'Email Marketing':          'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=1080',
  'SEO and Organic Growth':   'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=1080',
  'Brand Strategy':           'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1080',
  'Analytics and Data':       'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080',
  'Agency Life':              'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1080',
  'Growth and Business':      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1080',
  'AI and Marketing':         'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080'
};

function pick(arr, seed) {
  var x = Math.sin(seed + 1) * 10000;
  return arr[Math.floor((x - Math.floor(x)) * arr.length)];
}

function generatePosts() {
  var seed = Date.now();
  var cats = CATEGORIES.slice().sort(function(a, b) {
    var x = Math.sin(seed + a.length) * 10000;
    var y = Math.sin(seed + b.length) * 10000;
    return (x - Math.floor(x)) - (y - Math.floor(y));
  });
  return cats.slice(0, 3).map(function(cat, i) {
    var s      = seed + (i + 1) * 7919;
    var hook   = pick(HOOKS[cat], s);
    var body   = pick(BODIES[cat], s + 1);
    var cta    = pick(CTAS, s + 2);
    var caption = hook + '\n\n' + body + '\n\n' + cta + '\n\n' + HASHTAGS[cat];
    return {
      caption:  caption,
      category: cat,
      imageUrl: IMAGES[cat],
      headline: hook,
      ctaText:  cta
    };
  });
}

module.exports = { generatePosts: generatePosts };
