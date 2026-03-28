import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion';
import { MEDIATWIST_COLORS } from '../lib/colors';
import { BackgroundImage } from '../lib/BackgroundImage';

export interface SplitLayoutProps {
  /** Main caption text */
  captionText: string;
  /** Bold headline */
  headline?: string;
  /** Category or topic tag */
  tagline?: string;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL */
  backgroundImageUrl?: string;
}

/**
 * SplitLayout — 1080×1080 square composition
 * Left half: bold yellow panel with headline. Right half: dark with body text.
 * Abstract geometric illustration built from SVG shapes.
 * Modern, editorial magazine feel.
 */
export const SplitLayout: React.FC<SplitLayoutProps> = ({
  captionText,
  headline = 'INSIGHT',
  tagline = 'THE MEDIATWIST GROUP',
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Panel slide in ────────────────────────────────────────
  const panelX = interpolate(frame, [0, 25], [-540, 0], { extrapolateRight: 'clamp' });
  const panelOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── Headline on yellow panel ──────────────────────────────
  const headlineOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' });
  const headlineY = interpolate(frame, [20, 45], [30, 0], { extrapolateRight: 'clamp' });

  // ── Right panel content ───────────────────────────────────
  const rightOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });

  // ── Body text ─────────────────────────────────────────────
  const bodyOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp' });
  const bodyY = interpolate(frame, [40, 65], [25, 0], { extrapolateRight: 'clamp' });

  // ── Geometric shapes animation ────────────────────────────
  const shape1 = spring({ frame: frame - 15, fps, from: 0, to: 1, config: { damping: 80, stiffness: 50 } });
  const shape2 = spring({ frame: frame - 25, fps, from: 0, to: 1, config: { damping: 80, stiffness: 50 } });
  const shape3 = spring({ frame: frame - 35, fps, from: 0, to: 1, config: { damping: 80, stiffness: 50 } });
  const shape4Rotate = interpolate(frame, [0, durationInFrames], [0, 90], { extrapolateRight: 'clamp' });

  // ── Logo + brand ──────────────────────────────────────────
  const brandOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: 'clamp' });

  // ── Tagline ───────────────────────────────────────────────
  const tagOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: 'clamp' });

  // Font sizing for caption
  const len = captionText.length;
  const fontSize = len > 140 ? 38 : len > 100 ? 44 : len > 60 ? 50 : 56;

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark }}>

      {/* Photo background (when provided) — shows through the dark right panel */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.5} blur={2} />

      {/* LEFT PANEL — Yellow accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 380,
        height: 1080,
        backgroundColor: brandColor,
        transform: `translateX(${panelX}px)`,
        opacity: panelOpacity,
        overflow: 'hidden',
      }}>
        {/* Abstract geometric illustration on yellow panel */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%' }} viewBox="0 0 380 1080">
          {/* Large circle */}
          <circle
            cx="190" cy="400" r={150}
            fill="none" stroke={MEDIATWIST_COLORS.dark}
            strokeWidth="3" opacity={0.15 * Math.max(shape1, 0)}
          />
          {/* Triangle */}
          <polygon
            points="100,650 280,650 190,520"
            fill="none" stroke={MEDIATWIST_COLORS.dark}
            strokeWidth="2" opacity={0.12 * Math.max(shape2, 0)}
          />
          {/* Rotating square — moved up away from logo zone */}
          <rect
            x="130" y="650" width="100" height="100"
            fill="none" stroke={MEDIATWIST_COLORS.dark}
            strokeWidth="2" opacity={0.1 * Math.max(shape3, 0)}
            transform={`rotate(${shape4Rotate}, 180, 700)`}
          />
          {/* Small dots grid */}
          {[0, 1, 2, 3, 4, 5].map(row =>
            [0, 1, 2, 3].map(col => (
              <circle
                key={`d-${row}-${col}`}
                cx={60 + col * 80} cy={180 + row * 30}
                r={3}
                fill={MEDIATWIST_COLORS.dark}
                opacity={0.15}
              />
            ))
          )}
          {/* Horizontal lines — pushed up to avoid logo zone */}
          {[750, 780, 810].map(y => (
            <line key={y} x1="40" y1={y} x2="340" y2={y}
              stroke={MEDIATWIST_COLORS.dark} strokeWidth="1" opacity="0.1" />
          ))}
        </svg>

        {/* Vertical headline on yellow panel */}
        <div style={{
          position: 'absolute',
          top: 80,
          left: 40,
          right: 30,
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
        }}>
          <h1 style={{
            color: MEDIATWIST_COLORS.dark,
            fontSize: headline.length > 15 ? 52 : 72,
            fontWeight: 900,
            lineHeight: 1.05,
            margin: 0,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: -1,
            textTransform: 'uppercase',
          }}>
            {headline}
          </h1>
        </div>

        {/* Logo at bottom of yellow panel — ISOLATED, no text near it */}
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: 30,
          width: 140,
          height: 140,
          opacity: brandOpacity,
        }}>
          <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>

      {/* RIGHT PANEL — Dark with text content */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 380,
        right: 0,
        bottom: 0,
        opacity: rightOpacity,
      }}>
        {/* Subtle grid dots on dark side */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.05 }} viewBox="0 0 700 1080">
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <circle
                key={`g-${row}-${col}`}
                cx={50 + col * 110} cy={50 + row * 140}
                r={2}
                fill={brandColor}
              />
            ))
          )}
        </svg>

        {/* Tagline */}
        <div style={{
          position: 'absolute',
          top: 80,
          left: 60,
          right: 40,
          opacity: tagOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ width: 30, height: 3, backgroundColor: brandColor }} />
          <span style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            {tagline}
          </span>
        </div>

        {/* Body text — uses full available space */}
        <div style={{
          position: 'absolute',
          top: 160,
          left: 60,
          right: 50,
          bottom: 140,
          display: 'flex',
          alignItems: 'center',
          opacity: bodyOpacity,
          transform: `translateY(${bodyY}px)`,
        }}>
          <p style={{
            color: MEDIATWIST_COLORS.text,
            fontSize,
            fontWeight: 600,
            lineHeight: 1.35,
            margin: 0,
            fontFamily: 'Inter, sans-serif',
          }}>
            {captionText}
          </p>
        </div>

        {/* Bottom handle */}
        <div style={{
          position: 'absolute',
          bottom: 50,
          right: 50,
          opacity: brandOpacity,
        }}>
          <span style={{
            color: brandColor,
            fontSize: 24,
            fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: 1,
          }}>
            @mediatwist
          </span>
        </div>
      </div>

      {/* Vertical divider line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 380,
        width: 2,
        height: 1080,
        backgroundColor: brandColor,
        opacity: 0.3 * panelOpacity,
      }} />

    </AbsoluteFill>
  );
};
