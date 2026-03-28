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

export interface DataDashboardProps {
  /** Main title/headline */
  headline: string;
  /** Caption or context text */
  captionText?: string;
  /** Array of stat objects to display */
  stats: Array<{ label: string; value: string }>;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL */
  backgroundImageUrl?: string;
}

/**
 * DataDashboard — 1080×1080 square composition
 * Clean dark dashboard with animated stat cards and radar grid.
 * Cards fade in sequentially with smooth progress bars.
 */
export const DataDashboard: React.FC<DataDashboardProps> = ({
  headline,
  captionText,
  stats = [
    { label: 'Growth', value: '+340%' },
    { label: 'Reach', value: '2.3M' },
    { label: 'Engagement', value: '8.7K' },
    { label: 'ROI', value: '+220%' },
  ],
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ──────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // ── Radar pulse ─────────────────────────────────────────
  const radarPhase = frame % 90;
  const radarR = interpolate(radarPhase, [0, 90], [20, 450], { extrapolateRight: 'clamp' });
  const radarO = interpolate(radarPhase, [0, 90], [0.2, 0], { extrapolateRight: 'clamp' });

  // ── Scanning line ───────────────────────────────────────
  // Scan line stops at y=880, NEVER enters logo zone (y=915+)
  const scanY = interpolate(frame, [30, 180], [0, 880], { extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [30, 50, 150, 180], [0, 0.5, 0.3, 0], { extrapolateRight: 'clamp' });

  // ── Logo ────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 5, fps, from: 0.85, to: 1, config: { damping: 200, stiffness: 120 } });

  // ── Headline ────────────────────────────────────────────
  const headlineOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  const headlineY = interpolate(frame, [10, 35], [15, 0], { extrapolateRight: 'clamp' });

  // ── Caption ─────────────────────────────────────────────
  const captionOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  // ── Stat cards ──────────────────────────────────────────
  const getStatAnimation = (index: number) => {
    const startFrame = 60 + index * 30;
    const opacity = interpolate(frame, [startFrame, startFrame + 25], [0, 1], { extrapolateRight: 'clamp' });
    const translateY = interpolate(frame, [startFrame, startFrame + 25], [20, 0], { extrapolateRight: 'clamp' });
    const progressWidth = interpolate(frame, [startFrame + 10, startFrame + 50], [0, 100], { extrapolateRight: 'clamp' });
    return { opacity, translateY, progressWidth };
  };

  // ── Brand ───────────────────────────────────────────────
  const brandOpacity = interpolate(frame, [durationInFrames - 60, durationInFrames - 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Photo background (when provided) */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.6} blur={3} />

      {/* Radar grid background */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1080 1080"
      >
        {/* Grid lines */}
        {[120, 240, 360, 480, 600, 720, 840, 960].map(v => (
          <React.Fragment key={v}>
            <line x1="0" y1={v} x2="1080" y2={v} stroke={brandColor} strokeWidth="1" opacity="0.04" />
            <line x1={v} y1="0" x2={v} y2="1080" stroke={brandColor} strokeWidth="1" opacity="0.04" />
          </React.Fragment>
        ))}
        {/* Radar pulse */}
        <circle cx="540" cy="540" r={radarR} fill="none" stroke={brandColor} strokeWidth="1.5" opacity={radarO} />
      </svg>

      {/* Scanning line */}
      <div style={{
        position: 'absolute',
        top: scanY,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: brandColor,
        opacity: scanOpacity,
        boxShadow: `0 0 20px ${brandColor}66`,
      }} />

      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        background: `linear-gradient(90deg, ${brandColor}, transparent)`,
      }} />

      {/* Logo — bottom left, ISOLATED zone */}
      <div style={{
        position: 'absolute',
        bottom: 25,
        left: 30,
        width: 140,
        height: 140,
        opacity: logoOpacity,
        transform: `scale(${Math.max(logoScale, 0)})`,
        transformOrigin: 'bottom left',
      }}>
        <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* Headline — full width now, no logo overlap */}
      <div style={{
        position: 'absolute',
        top: 45,
        left: 40,
        right: 40,
        opacity: headlineOpacity,
        transform: `translateY(${headlineY}px)`,
      }}>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1.2,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: -0.5,
        }}>
          {headline}
        </h1>
      </div>

      {/* Caption */}
      {captionText && (
        <div style={{
          position: 'absolute',
          top: 130,
          left: 40,
          right: 40,
          opacity: captionOpacity,
        }}>
          <p style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: 'Inter, sans-serif',
          }}>
            {captionText}
          </p>
        </div>
      )}

      {/* Stat cards grid — 2×2 */}
      <div style={{
        position: 'absolute',
        top: 200,
        left: 40,
        right: 40,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
      }}>
        {stats.map((stat, index) => {
          const { opacity, translateY, progressWidth } = getStatAnimation(index);

          return (
            <div
              key={index}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
              }}
            >
              <div style={{
                backgroundColor: MEDIATWIST_COLORS.darkAlt,
                borderLeft: `4px solid ${brandColor}`,
                padding: 24,
                borderRadius: 4,
              }}>
                {/* Label */}
                <p style={{
                  color: MEDIATWIST_COLORS.subtext,
                  fontSize: 16,
                  fontWeight: 600,
                  margin: '0 0 12px 0',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}>
                  {stat.label}
                </p>

                {/* Value */}
                <p style={{
                  color: brandColor,
                  fontSize: 52,
                  fontWeight: 900,
                  margin: '0 0 18px 0',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1,
                }}>
                  {stat.value}
                </p>

                {/* Progress bar */}
                <div style={{
                  backgroundColor: MEDIATWIST_COLORS.muted,
                  height: 4,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(progressWidth, 100)}%`,
                    height: '100%',
                    backgroundColor: brandColor,
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom brand — right side, away from logo */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        right: 40,
        opacity: brandOpacity,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ width: 30, height: 3, backgroundColor: brandColor, borderRadius: 2 }} />
        <span style={{
          color: brandColor,
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 0.5,
        }}>
          @mediatwist
        </span>
      </div>

      {/* Bottom bar — starts AFTER logo zone */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 200,
        right: 0,
        height: 5,
        background: `linear-gradient(90deg, ${brandColor}, transparent)`,
        opacity: brandOpacity,
      }} />

    </AbsoluteFill>
  );
};
