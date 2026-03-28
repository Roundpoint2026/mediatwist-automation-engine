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

export interface ReelsPostProps {
  /** Main caption / body text */
  captionText: string;
  /** Bold hook at the top */
  headline?: string;
  /** Call-to-action at the bottom */
  ctaText?: string;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL */
  backgroundImageUrl?: string;
}

/**
 * ReelsPost — 1080×1920 vertical composition
 * Clean vertical layout for Reels/Stories with radar background.
 * Simple slide + fade animations. Text always readable.
 */
export const ReelsPost: React.FC<ReelsPostProps> = ({
  captionText,
  headline = 'Did you know?',
  ctaText = 'Follow for more → @mediatwist',
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ──────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // ── Radar pulse (centered at ~500px from top) ──────────
  const radarPhase = frame % 100;
  const radarR1 = interpolate(radarPhase, [0, 100], [40, 500], { extrapolateRight: 'clamp' });
  const radarO1 = interpolate(radarPhase, [0, 100], [0.3, 0], { extrapolateRight: 'clamp' });
  const radarPhase2 = (frame + 50) % 100;
  const radarR2 = interpolate(radarPhase2, [0, 100], [40, 500], { extrapolateRight: 'clamp' });
  const radarO2 = interpolate(radarPhase2, [0, 100], [0.3, 0], { extrapolateRight: 'clamp' });

  // ── Vertical scan line ──────────────────────────────────
  // Scan line starts at y=320, NEVER enters logo zone (y=60-280)
  const scanY = interpolate(frame, [10, 200], [320, 1920], { extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [10, 30, 160, 200], [0, 0.4, 0.3, 0], { extrapolateRight: 'clamp' });

  // ── Logo ────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 5, fps, from: 0.85, to: 1, config: { damping: 200, stiffness: 120 } });

  // ── Badge ───────────────────────────────────────────────
  const badgeOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });
  const badgeX = interpolate(frame, [15, 35], [-30, 0], { extrapolateRight: 'clamp' });

  // ── Headline ────────────────────────────────────────────
  const headlineOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const headlineY = interpolate(frame, [20, 50], [25, 0], { extrapolateRight: 'clamp' });

  // ── Caption ─────────────────────────────────────────────
  const captionOpacity = interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp' });
  const captionY = interpolate(frame, [50, 80], [25, 0], { extrapolateRight: 'clamp' });

  // ── CTA ─────────────────────────────────────────────────
  const ctaOpacity = interpolate(frame, [90, 115], [0, 1], { extrapolateRight: 'clamp' });
  const ctaY = interpolate(frame, [90, 115], [20, 0], { extrapolateRight: 'clamp' });
  const ctaLineWidth = interpolate(frame, [90, 120], [0, 300], { extrapolateRight: 'clamp' });

  // ── Brand ───────────────────────────────────────────────
  const brandOpacity = interpolate(frame, [durationInFrames - 60, durationInFrames - 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Photo background (when provided) */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.5} blur={2} zoomScale={1.12} />

      {/* Radar grid background */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1080 1920"
      >
        {/* Static rings centered vertically */}
        {[120, 240, 360].map(r => (
          <circle key={r} cx="540" cy="700" r={r} fill="none" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        ))}
        {/* Crosshairs */}
        {/* Vertical crosshair starts below logo zone */}
        <line x1="540" y1="320" x2="540" y2="1200" stroke={brandColor} strokeWidth="1" opacity="0.04" />
        <line x1="100" y1="700" x2="980" y2="700" stroke={brandColor} strokeWidth="1" opacity="0.04" />
        {/* Animated pulse */}
        <circle cx="540" cy="700" r={radarR1} fill="none" stroke={brandColor} strokeWidth="2" opacity={radarO1} />
        <circle cx="540" cy="700" r={radarR2} fill="none" stroke={brandColor} strokeWidth="2" opacity={radarO2} />
      </svg>

      {/* Horizontal scan line */}
      <div style={{
        position: 'absolute',
        top: scanY,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: brandColor,
        opacity: scanOpacity,
        boxShadow: `0 0 25px ${brandColor}66`,
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

      {/* Logo — centered at top, ISOLATED zone (nothing overlaps) */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: '50%',
        transform: `translate(-50%, 0) scale(${Math.max(logoScale, 0)})`,
        width: 220,
        height: 220,
        opacity: logoOpacity,
      }}>
        <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* Mediatwist badge — pushed down below logo zone with 60px+ gap */}
      <div style={{
        position: 'absolute',
        top: 350,
        left: 70,
        opacity: badgeOpacity,
        transform: `translateX(${badgeX}px)`,
      }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: brandColor,
          paddingLeft: 18,
          paddingRight: 18,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 6,
        }}>
          <span style={{
            color: MEDIATWIST_COLORS.dark,
            fontSize: 22,
            fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}>
            Mediatwist
          </span>
        </div>
      </div>

      {/* Headline — below badge, clear of logo zone */}
      <div style={{
        position: 'absolute',
        top: 430,
        left: 70,
        right: 70,
        opacity: headlineOpacity,
        transform: `translateY(${headlineY}px)`,
      }}>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1.1,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: -1,
        }}>
          {headline}
        </h1>
      </div>

      {/* Caption — center zone with accent bar */}
      <div style={{
        position: 'absolute',
        top: 720,
        left: 70,
        right: 70,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        {/* Left accent bar */}
        <div style={{
          position: 'absolute',
          left: -20,
          top: 0,
          width: 4,
          height: '100%',
          backgroundColor: brandColor,
          borderRadius: 2,
          opacity: 0.6,
        }} />
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: captionText.length > 100 ? 44 : 52,
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
        bottom: 200,
        left: 70,
        right: 70,
        opacity: ctaOpacity,
        transform: `translateY(${ctaY}px)`,
      }}>
        <div style={{
          width: ctaLineWidth,
          height: 2,
          backgroundColor: brandColor,
          marginBottom: 20,
          borderRadius: 2,
        }} />
        <p style={{
          color: brandColor,
          fontSize: 32,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          margin: 0,
          letterSpacing: 0.5,
        }}>
          {ctaText}
        </p>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 5,
        background: `linear-gradient(90deg, ${brandColor}, transparent)`,
        opacity: brandOpacity,
      }} />

    </AbsoluteFill>
  );
};
