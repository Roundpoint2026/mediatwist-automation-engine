import React from 'react';
import { Composition } from 'remotion';
import { FeedPost, FeedPostProps } from './compositions/FeedPost';
import { ReelsPost, ReelsPostProps } from './compositions/ReelsPost';
import { BrandedCaption, BrandedCaptionProps } from './compositions/BrandedCaption';
import { DataDashboard, DataDashboardProps } from './compositions/DataDashboard';
import { KineticType, KineticTypeProps } from './compositions/KineticType';
import { BoldStatement, BoldStatementProps } from './compositions/BoldStatement';
import { SplitLayout, SplitLayoutProps } from './compositions/SplitLayout';
import { GlowCard, GlowCardProps } from './compositions/GlowCard';
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
 *   BoldStatement   — 1080×1080, 10s — Giant full-bleed typography, geometric accents
 *   SplitLayout     — 1080×1080, 10s — Split panel: yellow left + dark text right
 *   GlowCard        — 1080×1080, 10s — Neon glow card with particles & illustrations
 *
 * All compositions accept `captionText: string` as a required prop,
 * so the render script can generate variations automatically.
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

      {/* ─── Bold Statement — 1080×1080, 10 seconds ──────────────────────── */}
      <Composition<BoldStatementProps>
        id="BoldStatement"
        component={BoldStatement}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'Your audience doesn\'t need more content. They need better positioning.',
          tagline: 'THE MEDIATWIST GROUP',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

      {/* ─── Split Layout — 1080×1080, 10 seconds ────────────────────────── */}
      <Composition<SplitLayoutProps>
        id="SplitLayout"
        component={SplitLayout}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'The brands that win aren\'t the loudest. They\'re the most precise.',
          headline: 'INSIGHT',
          tagline: 'THE MEDIATWIST GROUP',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

      {/* ─── Glow Card — 1080×1080, 10 seconds ──────────────────────────── */}
      <Composition<GlowCardProps>
        id="GlowCard"
        component={GlowCard}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          captionText: 'AI won\'t replace your marketing team. But a team using AI will replace yours.',
          tagline: 'MEDIATWIST INSIGHT',
          brandColor: MEDIATWIST_COLORS.accent,
        }}
      />

    </>
  );
};
