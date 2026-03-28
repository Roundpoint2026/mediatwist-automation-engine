import React from 'react';
import { Composition } from 'remotion';
import { FeedPost, FeedPostProps } from './compositions/FeedPost';
import { ReelsPost, ReelsPostProps } from './compositions/ReelsPost';
import { BrandedCaption, BrandedCaptionProps } from './compositions/BrandedCaption';
import { DataDashboard, DataDashboardProps } from './compositions/DataDashboard';
import { KineticType, KineticTypeProps } from './compositions/KineticType';
import { MEDIATWIST_COLORS } from './lib/colors';

/**
 * Root — registers all Mediatwist Remotion compositions
 *
 * Composition IDs:
 *   FeedPost        — 1080×1080, 10s — Facebook/Instagram feed posts
 *   ReelsPost       — 1080×1920, 15s — Facebook/Instagram Reels & Stories
 *   BrandedCaption  — 1080×1080, 8s  — Quote/caption-forward posts
 *   DataDashboard   — 1080×1080, 12s — Case studies, metrics, data viz
 *   KineticType     — 1080×1080, 10s — Kinetic typography, motion graphics
 *
 * All compositions accept `captionText: string` as a required prop,
 * so the render script can generate variations automatically.
 *
 * Render commands:
 *   npx remotion render src/index.ts FeedPost out/feed.mp4 --props='{"captionText":"..."}'
 *   npx remotion render src/index.ts ReelsPost out/reels.mp4 --props='{"captionText":"..."}'
 *   npx remotion render src/index.ts BrandedCaption out/caption.mp4 --props='{"captionText":"..."}'
 *   npx remotion render src/index.ts DataDashboard out/dashboard.mp4 --props='{"headline":"...","stats":[...]}'
 *   npx remotion render src/index.ts KineticType out/kinetic.mp4 --props='{"captionText":"..."}'
 *   node scripts/renderVariations.js   ← renders variations + uploads to Cloudinary
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
          brandColor: MEDIATWIST_COLORS.accent,
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
          brandColor: MEDIATWIST_COLORS.accent,
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
          attribution: '— The Mediatwist Group',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

      {/* ─── Data Dashboard — 1080×1080, 12 seconds ────────────────────────── */}
      <Composition<DataDashboardProps>
        id="DataDashboard"
        component={DataDashboard}
        durationInFrames={360}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          headline: 'Campaign Results',
          captionText: 'Measurable impact across all channels',
          stats: [
            { label: 'Growth', value: '+340%' },
            { label: 'Reach', value: '2.3M' },
            { label: 'Engagement', value: '8.7K' },
            { label: 'ROI', value: '+220%' },
          ],
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

      {/* ─── Kinetic Type — 1080×1080, 10 seconds ────────────────────────── */}
      <Composition<KineticTypeProps>
        id="KineticType"
        component={KineticType}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'Bold text with dynamic motion. Every word matters.',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

    </>
  );
};
