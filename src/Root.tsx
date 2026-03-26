import React from 'react';
import { Composition } from 'remotion';
import { FeedPost, FeedPostProps } from './compositions/FeedPost';
import { ReelsPost, ReelsPostProps } from './compositions/ReelsPost';
import { BrandedCaption, BrandedCaptionProps } from './compositions/BrandedCaption';
import { MEDIATWIST_COLORS } from './lib/colors';

/**
 * Root — registers all Mediatwist Remotion compositions
 *
 * Composition IDs:
 *   FeedPost        — 1080×1080, 10s — Facebook/Instagram feed
 *   ReelsPost       — 1080×1920, 15s — Facebook/Instagram Reels & Stories
 *   BrandedCaption  — 1080×1080, 8s  — Quote/caption-forward posts
 *
 * All compositions accept `captionText: string` as a required prop,
 * so the render script can generate 3 variations automatically.
 *
 * Render commands:
 *   npx remotion render src/index.ts FeedPost out/feed.mp4 --props='{"captionText":"..."}'
 *   npx remotion render src/index.ts ReelsPost out/reels.mp4 --props='{"captionText":"..."}'
 *   npx remotion render src/index.ts BrandedCaption out/caption.mp4 --props='{"captionText":"..."}'
 *   node scripts/renderVariations.js   ← renders 3 variations + uploads to Cloudinary
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>

      {/* ─── Feed Post — 1080×1080, 10 seconds ─────────────────────────────── */}
      <Composition<FeedPostProps>
        id="FeedPost"
        component={FeedPost}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'Your caption goes here. Keep it punchy and clear.',
          headline: 'Mediatwist',
          subText: '',
          brandColor: MEDIATWIST_COLORS.primary,
        }}
      />

      {/* ─── Reels Post — 1080×1920, 15 seconds ────────────────────────────── */}
      <Composition<ReelsPostProps>
        id="ReelsPost"
        component={ReelsPost}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          captionText: 'Your caption goes here. Keep it punchy and clear.',
          headline: 'Did you know?',
          ctaText: 'Follow for more → @mediatwist',
          brandColor: MEDIATWIST_COLORS.primary,
        }}
      />

      {/* ─── Branded Caption — 1080×1080, 8 seconds ────────────────────────── */}
      <Composition<BrandedCaptionProps>
        id="BrandedCaption"
        component={BrandedCaption}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'Your bold statement or quote goes here.',
          attribution: '— Mediatwist',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

    </>
  );
};
