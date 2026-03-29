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
import { BackgroundMusic } from '../lib/BackgroundMusic';

export interface FeedPostProps {
  /** Main caption / body text */
  captionText: string;
  /** Bold headline above the caption */
  headline?: string;
  /** Smaller supporting line below caption */
  subText?: string;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL — renders behind content with dark overlay */
  backgroundImageUrl?: string;
  /** Optional audio track path (relative to public/) for background music */
  audioSrc?: string;
}

/**
 * FeedPost — 1080×1080 square composition
 * Clean, professional feed post with radar grid background.
 * Simple fade + slide animations. Text always readable.
 */
export const FeedPost: React.FC<FeedPostProps> = ({
  captionText,
  headline = 'Mediatwist',
  subText,
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
  audioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ──────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // ── Radar pulse ─────────────────────────────────────────
  const radarPhase = frame % 100;
  const radarR = interpolate(radarPhase, [0, 100], [30, 480], { extrapolateRight: 'clamp' });
  const radarO = interpolate(radarPhase, [0, 100], [0.25, 0], { extrapolateRight: 'clamp' });

  // ── Horizontal scan line ────────────────────────────────
  // Scan line stops at y=880, NEVER enters logo zone (y=915+)
  const scanY = interpolate(frame, [15, 120], [0, 880], { extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [15, 30, 90, 120], [0, 0.5, 0.3, 0], { extrapolateRight: 'clamp' });

  // ── Accent bar grows down from top ──────────────────────
  // Accent bar capped so it never enters logo zone (top:80 + 400 = y:480, logo at y:915)
  const barHeight = interpolate(frame, [5, 50], [0, 400], { extrapolateRight: 'clamp' });

  // ── Headline ────────────────────────────────────────────
  const headlineOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  const headlineY = interpolate(frame, [10, 35], [20, 0], { extrapolateRight: 'clamp' });

  // ── Divider line sweeps right ───────────────────────────
  const dividerWidth = interpolate(frame, [35, 65], [0, 920], { extrapolateRight: 'clamp' });

  // ── Caption text ────────────────────────────────────────
  const captionOpacity = interpolate(frame, [45, 75], [0, 1], { extrapolateRight: 'clamp' });
  const captionY = interpolate(frame, [45, 75], [25, 0], { extrapolateRight: 'clamp' });

  // ── Sub text ────────────────────────────────────────────
  const subOpacity = interpolate(frame, [75, 100], [0, 1], { extrapolateRight: 'clamp' });
  const subY = interpolate(frame, [75, 100], [15, 0], { extrapolateRight: 'clamp' });

  // ── Logo ────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 5, fps, from: 0.85, to: 1, config: { damping: 200, stiffness: 120 } });

  // ── Brand handle ────────────────────────────────────────
  const brandOpacity = interpolate(frame, [90, 115], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Background music (when provided) */}
      <BackgroundMusic src={audioSrc} />

      {/* Photo background (when provided) */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.55} blur={2} />

      {/* Radar grid background */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1080 1080"
      >
        {/* Static grid */}
        {[200, 400, 600, 800].map(y => (
          <line key={`h-${y}`} x1="0" y1={y} x2="1080" y2={y} stroke={brandColor} strokeWidth="1" opacity="0.05" />
        ))}
        {[200, 400, 600, 800].map(x => (
          <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="1080" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        ))}
        {/* Concentric rings */}
        {[150, 300, 450].map(r => (
          <circle key={r} cx="540" cy="540" r={r} fill="none" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        ))}
        {/* Animated pulse */}
        <circle cx="540" cy="540" r={radarR} fill="none" stroke={brandColor} strokeWidth="2" opacity={radarO} />
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
        boxShadow: `0 0 20px ${brandColor}66`,
      }} />

      {/* Logo — bottom left, ISOLATED zone (nothing else within 200px of this corner) */}
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

      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 70,
        width: 5,
        height: barHeight,
        backgroundColor: brandColor,
        borderRadius: 3,
      }} />

      {/* Headline */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 100,
        right: 80,
        opacity: headlineOpacity,
        transform: `translateY(${headlineY}px)`,
      }}>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: 68,
          fontWeight: 900,
          lineHeight: 1.1,
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
        top: 200,
        left: 70,
        width: dividerWidth,
        height: 2,
        backgroundColor: brandColor,
        opacity: 0.3,
      }} />

      {/* Caption */}
      <div style={{
        position: 'absolute',
        top: 230,
        left: 70,
        right: 70,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: captionText.length > 120 ? 46 : captionText.length > 80 ? 54 : 62,
          fontWeight: 600,
          lineHeight: 1.35,
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
          bottom: 240,
          left: 200,
          right: 70,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
        }}>
          <p style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'italic',
          }}>
            {subText}
          </p>
        </div>
      )}

      {/* Bottom brand bar — starts AFTER logo zone (left:200) */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 200,
        right: 0,
        height: 5,
        background: `linear-gradient(90deg, ${brandColor}, transparent)`,
        opacity: brandOpacity,
      }} />
      {/* Handle — bottom right (away from logo zone) */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        right: 50,
        opacity: brandOpacity,
      }}>
        <span style={{
          color: brandColor,
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 0.5,
        }}>
          @mediatwist
        </span>
      </div>

    </AbsoluteFill>
  );
};
