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

export interface KineticTypeProps {
  /** The text to display with kinetic animation */
  captionText: string;
  /** Override brand accent color */
  brandColor?: string;
}

/**
 * KineticType — 1080×1080 square composition
 * Clean line-by-line text reveal with radar scanning background.
 * Text is ALWAYS fully readable — no overlapping, no rotation.
 */
export const KineticType: React.FC<KineticTypeProps> = ({
  captionText,
  brandColor = MEDIATWIST_COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ──────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── Radar pulse (loops every 90 frames = 3 seconds) ────
  const radarPhase = frame % 90;
  const radarR1 = interpolate(radarPhase, [0, 90], [20, 500], { extrapolateRight: 'clamp' });
  const radarO1 = interpolate(radarPhase, [0, 90], [0.35, 0], { extrapolateRight: 'clamp' });
  const radarPhase2 = (frame + 45) % 90;
  const radarR2 = interpolate(radarPhase2, [0, 90], [20, 500], { extrapolateRight: 'clamp' });
  const radarO2 = interpolate(radarPhase2, [0, 90], [0.35, 0], { extrapolateRight: 'clamp' });

  // ── Scanning line sweeps across ─────────────────────────
  const scanX = interpolate(frame, [0, durationInFrames], [-100, 1200], { extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [10, 40, durationInFrames - 30, durationInFrames], [0, 0.4, 0.4, 0], { extrapolateRight: 'clamp' });

  // ── Split text into lines (sentences) for reveal ────────
  const sentences = captionText
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  // If only 1 sentence, split by commas or show as one block
  const lines = sentences.length > 1
    ? sentences
    : captionText.split(/,\s*/).filter(s => s.trim().length > 0);

  const framesPerLine = 35;
  const lineStartOffset = 30; // first line appears at frame 30

  // ── Logo ────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [5, 25], [0, 0.9], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 5, fps, from: 0.85, to: 1, config: { damping: 200, stiffness: 120 } });

  // ── Bottom brand handle ─────────────────────────────────
  const brandOpacity = interpolate(frame, [durationInFrames - 60, durationInFrames - 30], [0, 1], { extrapolateRight: 'clamp' });

  // ── Accent bar height ───────────────────────────────────
  const accentHeight = interpolate(frame, [20, 80], [0, 600], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Radar pulse background */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1080 1080"
      >
        {/* Static grid rings */}
        {[150, 300, 450].map(r => (
          <circle key={r} cx="540" cy="540" r={r} fill="none" stroke={brandColor} strokeWidth="1" opacity="0.06" />
        ))}
        {/* Crosshair lines */}
        <line x1="540" y1="80" x2="540" y2="1000" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        <line x1="80" y1="540" x2="1000" y2="540" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        {/* Animated pulse rings */}
        <circle cx="540" cy="540" r={radarR1} fill="none" stroke={brandColor} strokeWidth="2" opacity={radarO1} />
        <circle cx="540" cy="540" r={radarR2} fill="none" stroke={brandColor} strokeWidth="2" opacity={radarO2} />
      </svg>

      {/* Vertical scanning line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: scanX,
        width: 2,
        height: '100%',
        backgroundColor: brandColor,
        opacity: scanOpacity,
        boxShadow: `0 0 30px ${brandColor}66`,
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

      {/* Logo — top right */}
      <div style={{
        position: 'absolute',
        top: 40,
        right: 40,
        width: 100,
        height: 100,
        opacity: logoOpacity,
        transform: `scale(${Math.max(logoScale, 0)})`,
        transformOrigin: 'top right',
      }}>
        <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        top: 200,
        left: 60,
        width: 5,
        height: accentHeight,
        backgroundColor: brandColor,
        borderRadius: 3,
      }} />

      {/* Text lines — clean line-by-line reveal */}
      <div style={{
        position: 'absolute',
        top: 200,
        left: 90,
        right: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {lines.map((line, i) => {
          const lineStart = lineStartOffset + i * framesPerLine;
          const opacity = interpolate(frame, [lineStart, lineStart + 20], [0, 1], { extrapolateRight: 'clamp' });
          const translateY = interpolate(frame, [lineStart, lineStart + 20], [25, 0], { extrapolateRight: 'clamp' });

          return (
            <p
              key={i}
              style={{
                color: MEDIATWIST_COLORS.text,
                fontSize: lines.length > 3 ? 40 : 48,
                fontWeight: 600,
                lineHeight: 1.45,
                margin: 0,
                fontFamily: 'Inter, sans-serif',
                opacity,
                transform: `translateY(${translateY}px)`,
              }}
            >
              {line}
            </p>
          );
        })}
      </div>

      {/* Brand handle — bottom left */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: 60,
        opacity: brandOpacity,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ width: 40, height: 3, backgroundColor: brandColor, borderRadius: 2 }} />
        <span style={{
          color: brandColor,
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}>
          @mediatwist
        </span>
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
