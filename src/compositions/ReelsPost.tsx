import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import { MEDIATWIST_COLORS } from '../lib/colors';

export interface ReelsPostProps {
  /** Main caption / body text */
  captionText: string;
  /** Bold hook at the top */
  headline?: string;
  /** Call-to-action at the bottom */
  ctaText?: string;
  /** Override brand accent color */
  brandColor?: string;
}

/**
 * ReelsPost — 1080×1920 vertical composition
 * Best for: Facebook & Instagram Reels / Stories
 * Accepts captionText so 3 variations can be rendered from a single script
 */
export const ReelsPost: React.FC<ReelsPostProps> = ({
  captionText,
  headline = 'Did you know?',
  ctaText = 'Follow for more → @mediatwist',
  brandColor = MEDIATWIST_COLORS.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background
  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // Gradient overlay pulse (subtle life)
  const gradientOpacity = interpolate(
    frame,
    [0, 60, 120, 180, 240],
    [0.4, 0.6, 0.4, 0.6, 0.4],
    { extrapolateRight: 'clamp' }
  );

  // Headline springs from top
  const headlineY = interpolate(frame, [5, 35], [-60, 0], { extrapolateRight: 'clamp' });
  const headlineOpacity = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp' });

  // Caption body
  const captionScale = spring({
    frame: frame - 30,
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 180, stiffness: 100 },
  });
  const captionOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' });

  // CTA slides up from bottom
  const ctaY = interpolate(frame, [70, 100], [40, 0], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' });

  // Brand tag
  const brandOpacity = interpolate(frame, [90, 115], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Background gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 600,
        background: `radial-gradient(ellipse at 50% 0%, ${brandColor}22 0%, transparent 70%)`,
        opacity: gradientOpacity,
      }} />

      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: `linear-gradient(90deg, ${brandColor}, ${MEDIATWIST_COLORS.accent})`,
      }} />

      {/* Headline — top zone */}
      <div style={{
        position: 'absolute',
        top: 120,
        left: 80,
        right: 80,
        opacity: headlineOpacity,
        transform: `translateY(${headlineY}px)`,
      }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: brandColor,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 10,
          paddingBottom: 10,
          borderRadius: 8,
          marginBottom: 24,
        }}>
          <span style={{
            color: '#fff',
            fontSize: 32,
            fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}>
            Mediatwist
          </span>
        </div>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 72,
          fontWeight: 900,
          lineHeight: 1.1,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: -1,
        }}>
          {headline}
        </h1>
      </div>

      {/* Caption — center zone */}
      <div style={{
        position: 'absolute',
        top: 520,
        left: 80,
        right: 80,
        opacity: captionOpacity,
        transform: `scale(${Math.max(captionScale, 0)})`,
        transformOrigin: 'left top',
      }}>
        {/* Accent bar */}
        <div style={{
          width: 5,
          height: '100%',
          position: 'absolute',
          left: -24,
          top: 0,
          backgroundColor: brandColor,
          borderRadius: 3,
          opacity: 0.7,
        }} />
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 56,
          fontWeight: 600,
          lineHeight: 1.45,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
        }}>
          {captionText}
        </p>
      </div>

      {/* CTA */}
      <div style={{
        position: 'absolute',
        bottom: 160,
        left: 80,
        right: 80,
        opacity: ctaOpacity,
        transform: `translateY(${ctaY}px)`,
        borderTop: `1px solid ${brandColor}44`,
        paddingTop: 30,
      }}>
        <p style={{
          color: brandColor,
          fontSize: 36,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          margin: 0,
          letterSpacing: 0.5,
        }}>
          {ctaText}
        </p>
      </div>

      {/* Bottom brand bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 8,
        background: `linear-gradient(90deg, ${brandColor}, ${MEDIATWIST_COLORS.accent})`,
        opacity: brandOpacity,
      }} />

    </AbsoluteFill>
  );
};
