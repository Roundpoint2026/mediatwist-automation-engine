import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { MEDIATWIST_COLORS } from '../lib/colors';

export interface FeedPostProps {
  /** Main caption / body text */
  captionText: string;
  /** Bold headline above the caption */
  headline?: string;
  /** Smaller supporting line below caption */
  subText?: string;
  /** Override brand accent color */
  brandColor?: string;
}

/**
 * FeedPost — 1080×1080 square composition
 * Best for: Facebook & Instagram feed posts
 * Accepts captionText so 3 variations can be rendered from a single script
 */
export const FeedPost: React.FC<FeedPostProps> = ({
  captionText,
  headline = 'Mediatwist',
  subText,
  brandColor = MEDIATWIST_COLORS.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background fade-in
  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Accent bar grows down
  const barHeight = interpolate(frame, [5, 35], [0, 100], { extrapolateRight: 'clamp' });

  // Headline springs in from slightly small
  const headlineScale = spring({
    frame,
    fps,
    from: 0.88,
    to: 1,
    config: { damping: 200, stiffness: 120 },
  });
  const headlineOpacity = interpolate(frame, [5, 28], [0, 1], { extrapolateRight: 'clamp' });

  // Divider line sweeps right
  const dividerWidth = interpolate(frame, [30, 60], [0, 920], { extrapolateRight: 'clamp' });

  // Caption text rises up
  const captionOpacity = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' });
  const captionY = interpolate(frame, [40, 70], [30, 0], { extrapolateRight: 'clamp' });

  // Sub text follows
  const subOpacity = interpolate(frame, [65, 90], [0, 1], { extrapolateRight: 'clamp' });
  const subY = interpolate(frame, [65, 90], [20, 0], { extrapolateRight: 'clamp' });

  // Brand tag fades in last
  const brandOpacity = interpolate(frame, [80, 105], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 80,
        width: 6,
        height: barHeight,
        backgroundColor: brandColor,
        borderRadius: 3,
      }} />

      {/* Headline */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 114,
        right: 80,
        transform: `scale(${headlineScale})`,
        transformOrigin: 'left center',
        opacity: headlineOpacity,
      }}>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.15,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: -0.5,
        }}>
          {headline}
        </h1>
      </div>

      {/* Divider */}
      <div style={{
        position: 'absolute',
        top: 215,
        left: 80,
        width: dividerWidth,
        height: 2,
        backgroundColor: brandColor,
        opacity: 0.35,
      }} />

      {/* Caption */}
      <div style={{
        position: 'absolute',
        top: 250,
        left: 80,
        right: 80,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 44,
          fontWeight: 500,
          lineHeight: 1.5,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
        }}>
          {captionText}
        </p>
      </div>

      {/* Sub text */}
      {subText && (
        <div style={{
          position: 'absolute',
          bottom: 150,
          left: 80,
          right: 80,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
        }}>
          <p style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.55,
            margin: 0,
            fontFamily: 'Inter, sans-serif',
          }}>
            {subText}
          </p>
        </div>
      )}

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

      {/* Brand handle */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        left: 80,
        right: 80,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: brandOpacity,
      }}>
        <span style={{
          color: brandColor,
          fontSize: 26,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 0.5,
        }}>
          @mediatwist
        </span>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === 1 ? 10 : 6,
              height: i === 1 ? 10 : 6,
              borderRadius: '50%',
              backgroundColor: brandColor,
              opacity: i === 1 ? 1 : 0.5,
            }} />
          ))}
        </div>
      </div>

    </AbsoluteFill>
  );
};
