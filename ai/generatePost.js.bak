/**
 * ai/generatePost.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI post generator for the Mediatwist content engine.
 *
 * Currently returns mock data — to go live, replace the MOCK_POSTS array
 * with a real API call (OpenAI GPT-4, Claude, etc.) inside generatePosts().
 *
 * Each post returns:
 *   caption  — full social media caption (used for Facebook post text)
 *   scenes   — array of { text, style } objects (used by Remotion compositions)
 *
 * Exported:
 *   generatePosts() → Promise<Post[]>
 */

'use strict';

// ─── Mock posts ───────────────────────────────────────────────────────────────
// Bold, marketing-driven, Mediatwist-style content.
// Swap this out with a real AI call when ready.

const MOCK_POSTS = [
  {
    caption: [
      'Stop scrolling. Start growing. 🚀',
      '',
      'Most businesses waste 80% of their social budget on content that never converts.',
      'We build systems that actually move the needle.',
      '',
      '📲 Book your free strategy call → link in bio',
      '',
      '#SocialMediaMarketing #ContentStrategy #Mediatwist #GrowthHacking',
    ].join('\n'),
    scenes: [
      { text: 'Stop scrolling.\nStart growing.', style: 'bold-headline' },
      { text: '80% of businesses waste\ntheir social media budget.', style: 'stat' },
      { text: 'We build systems that\nactually move the needle.', style: 'body' },
      { text: 'Book your free strategy call →', style: 'cta' },
    ],
  },
  {
    caption: [
      'Your content calendar shouldn\'t be a guessing game. 📅',
      '',
      'We build automated systems that post for you —',
      'every day, on time, perfectly on brand.',
      '',
      '💡 DM us the word SYSTEM and we\'ll show you how.',
      '',
      '#ContentMarketing #MarketingAutomation #Mediatwist #SocialMediaStrategy',
    ].join('\n'),
    scenes: [
      { text: 'Your content calendar\nshouldn\'t be a guessing game.', style: 'question' },
      { text: 'Automated systems that post\nevery day, on time, on brand.', style: 'body' },
      { text: 'DM us "SYSTEM" to learn how.', style: 'cta' },
    ],
  },
  {
    caption: [
      '3 posts. 3 platforms. 0 extra work. ⚡',
      '',
      'That\'s what a real automated content engine looks like.',
      'Built custom for your business — not a template.',
      '',
      '👉 Free consultation → link in bio',
      '',
      '#MarketingAutomation #AIContent #Mediatwist #ScaleYourBusiness',
    ].join('\n'),
    scenes: [
      { text: '3 posts. 3 platforms.\n0 extra work.', style: 'bold-headline' },
      { text: 'A real automated content engine —\nbuilt for your business.', style: 'body' },
      { text: 'Not a template. Custom.', style: 'emphasis' },
      { text: 'Free consultation → link in bio', style: 'cta' },
    ],
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates an array of 3 social media posts.
 * Each post contains a caption and scene breakdown for Remotion.
 *
 * @returns {Promise<Array<{caption: string, scenes: Array<{text: string, style: string}>}>>}
 */
async function generatePosts() {
  // TODO: Replace mock with real AI call, e.g.:
  //
  // const { OpenAI } = require('openai');
  // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await client.chat.completions.create({ ... });
  // return parseAIResponse(response);

  console.log('   [generatePosts] Using mock AI output (3 posts)');
  return MOCK_POSTS;
}

module.exports = { generatePosts };
