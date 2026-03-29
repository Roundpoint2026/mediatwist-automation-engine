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

export interface BoldStatementProps {
  /** The main statement text — displayed HUGE */
  captionText: string;
  /** Optional category tag shown at top */
  tagline?: string;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL — renders behind content with dark overlay */
  backgroundImageUrl?: string;
  /** Optional audio track path (relative to public/) for background music */
  audioSrc?: string;
}

/**
 * BoldStatement — 1080×1080 square composition
 * Full-bleed giant typography. No radar grid — pure geometric impact.
 * Diagonal yellow stripe, massive text, confident authority feel.
 */
export const BoldStatement: React.FC<BoldStatementProps> = ({
  captionText,
  tagline = 'THE MEDIATWIST GROUP',
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
  audioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background fade in ────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  // ── Diagonal stripe wipe ──────────────────────────────────
  const stripeProgress = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: 'clamp' });
  const stripeX = interpolate(stripeProgress, [0, 1], [-400, 0]);

  // ── Tagline ───────────────────────────────────────────────
  const tagOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const tagX = interpolate(frame, [20, 40], [-30, 0], { extrapolateRight: 'clamp' });

  // ── Main text reveal ──────────────────────────────────────
  const textOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [30, 55], [40, 0], { extrapolateRight: 'clamp' });

  // ── Bottom bar + handle ───────────────────────────────────
  const bottomOpacity = interpolate(frame, [60, 85], [0, 1], { extrapolateRight: 'clamp' });
  const barWidth = interpolate(frame, [60, 100], [0, 1080], { extrapolateRight: 'clamp' });

  // ── Logo ──────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 45, fps, from: 0.7, to: 1, config: { damping: 180, stiffness: 100 } });

  // ── Geometric accent circles ──────────────────────────────
  const circle1Scale = spring({ frame: frame - 10, fps, from: 0, to: 1, config: { damping: 80, stiffness: 60 } });
  const circle2Scale = spring({ frame: frame - 25, fps, from: 0, to: 1, config: { damping: 80, stiffness: 60 } });

  // Responsive font size — use FULL space
  const len = captionText.length;
  const fontSize = len > 120 ? 58 : len > 80 ? 68 : len > 50 ? 80 : 96;

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Background music (when provided) */}
      <BackgroundMusic src={audioSrc} />

      {/* Photo background (when provided) */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.6} blur={3} />

      {/* Geometric background accents */}
      <div style={{
        position: 'absolute',
        top: -80,
        right: -80,
        width: 350,
        height: 350,
        borderRadius: '50%',
        border: `3px solid ${brandColor}`,
        opacity: 0.08,
        transform: `scale(${Math.max(circle1Scale, 0)})`,
      }} />
      <div style={{
        position: 'absolute',
        bottom: 300,
        left: -100,
        width: 250,
        height: 250,
        borderRadius: '50%',
        border: `2px solid ${brandColor}`,
        opacity: 0.06,
        transform: `scale(${Math.max(circle2Scale, 0)})`,
      }} />

      {/* Diagonal yellow stripe — bold visual anchor */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -50,
          left: stripeX,
          width: 120,
          height: 1200,
          backgroundColor: brandColor,
          transform: 'rotate(-15deg)',
          transformOrigin: 'top left',
          opacity: 0.15,
        }} />
      </div>

      {/* Small dots pattern — top right */}
      <svg style={{ position: 'absolute', top: 40, right: 40, width: 120, height: 120, opacity: 0.1 }} viewBox="0 0 120 120">
        {[0, 1, 2, 3, 4].map(row =>
          [0, 1, 2, 3, 4].map(col => (
            <circle key={`${row}-${col}`} cx={12 + col * 24} cy={12 + row * 24} r={3} fill={brandColor} />
          ))
        )}
      </svg>

      {/* Tagline / category label */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 70,
        opacity: tagOpacity,
        transform: `translateX(${tagX}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 40,
          height: 4,
          backgroundColor: brandColor,
          borderRadius: 2,
        }} />
        <span style={{
          color: brandColor,
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}>
          {tagline}
        </span>
      </div>

      {/* MAIN TEXT — uses the full canvas, clears logo zone at bottom-left */}
      <div style={{
        position: 'absolute',
        top: 160,
        left: 70,
        right: 70,
        bottom: 220,
        display: 'flex',
        alignItems: 'center',
        opacity: textOpacity,
        transform: `translateY(${textY}px)`,
      }}>
        <h1 style={{
          color: MEDIATWIST_COLORS.text,
          fontSize,
          fontWeight: 900,
          lineHeight: 1.1,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: -2,
        }}>
          {captionText}
        </h1>
      </div>

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

      {/* Bottom yellow bar — starts AFTER logo zone */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 200,
        width: Math.max(barWidth - 200, 0),
        height: 5,
        backgroundColor: brandColor,
        opacity: bottomOpacity,
      }} />

      {/* Handle — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 55,
        right: 70,
        opacity: bottomOpacity,
      }}>
        <span style={{
          color: brandColor,
          fontSize: 26,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}>
          @mediatwist
        </span>
      </div>

    </AbsoluteFill>
  );
};
