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

export interface BrandedCaptionProps {
  /** The caption or quote to display */
  captionText: string;
  /** Attribution line below the caption */
  attribution?: string;
  /** Override brand accent color */
  brandColor?: string;
  /** Optional background photo URL */
  backgroundImageUrl?: string;
  /** Optional audio track path (relative to public/) for background music */
  audioSrc?: string;
}

/**
 * BrandedCaption — 1080×1080 square composition
 * Minimal, quote-forward design with radar grid background.
 * Clean fade-in with corner accents. Text always fully readable.
 */
export const BrandedCaption: React.FC<BrandedCaptionProps> = ({
  captionText,
  attribution = '— The Mediatwist Group',
  brandColor = MEDIATWIST_COLORS.accent,
  backgroundImageUrl,
  audioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ──────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // ── Radar pulse ─────────────────────────────────────────
  const radarPhase = frame % 80;
  const radarR = interpolate(radarPhase, [0, 80], [30, 400], { extrapolateRight: 'clamp' });
  const radarO = interpolate(radarPhase, [0, 80], [0.2, 0], { extrapolateRight: 'clamp' });

  // ── Corner accents grow in ──────────────────────────────
  const cornerSize = interpolate(frame, [8, 40], [0, 100], { extrapolateRight: 'clamp' });

  // ── Large quotation mark ────────────────────────────────
  const quoteOpacity = interpolate(frame, [5, 30], [0, 0.12], { extrapolateRight: 'clamp' });
  const quoteScale = spring({ frame, fps, from: 0.5, to: 1, config: { damping: 150, stiffness: 80 } });

  // ── Caption text ────────────────────────────────────────
  const captionOpacity = interpolate(frame, [25, 60], [0, 1], { extrapolateRight: 'clamp' });
  const captionY = interpolate(frame, [25, 60], [30, 0], { extrapolateRight: 'clamp' });

  // ── Attribution ─────────────────────────────────────────
  const attrOpacity = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: 'clamp' });
  const attrLineWidth = interpolate(frame, [70, 95], [0, 60], { extrapolateRight: 'clamp' });

  // ── Logo ────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [60, 85], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 60, fps, from: 0.85, to: 1, config: { damping: 200, stiffness: 120 } });

  // ── Brand handle ────────────────────────────────────────
  const brandOpacity = interpolate(frame, [durationInFrames - 60, durationInFrames - 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: MEDIATWIST_COLORS.dark, opacity: bgOpacity }}>

      {/* Background music (when provided) */}
      <BackgroundMusic src={audioSrc} />

      {/* Photo background (when provided) */}
      <BackgroundImage src={backgroundImageUrl} overlayOpacity={0.5} blur={3} />

      {/* Radar grid background */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1080 1080"
      >
        {[180, 360, 540].map(r => (
          <circle key={r} cx="540" cy="540" r={r} fill="none" stroke={brandColor} strokeWidth="1" opacity="0.04" />
        ))}
        <line x1="540" y1="100" x2="540" y2="980" stroke={brandColor} strokeWidth="1" opacity="0.04" />
        <line x1="100" y1="540" x2="980" y2="540" stroke={brandColor} strokeWidth="1" opacity="0.04" />
        <circle cx="540" cy="540" r={radarR} fill="none" stroke={brandColor} strokeWidth="1.5" opacity={radarO} />
      </svg>

      {/* Corner accent — top left */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: cornerSize,
        height: cornerSize,
        borderTop: `4px solid ${brandColor}`,
        borderLeft: `4px solid ${brandColor}`,
        opacity: 0.5,
      }} />

      {/* Corner accent — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: cornerSize,
        height: cornerSize,
        borderBottom: `4px solid ${brandColor}`,
        borderRight: `4px solid ${brandColor}`,
        opacity: 0.5,
      }} />

      {/* Large quotation mark */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 70,
        transform: `scale(${Math.max(quoteScale, 0)})`,
        transformOrigin: 'top left',
        color: brandColor,
        fontSize: 180,
        lineHeight: 1,
        fontFamily: 'Georgia, serif',
        fontWeight: 900,
        opacity: quoteOpacity,
        userSelect: 'none',
      }}>
        {'\u201C'}
      </div>

      {/* Caption text — centered area */}
      <div style={{
        position: 'absolute',
        top: 200,
        left: 90,
        right: 90,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: captionText.length > 100 ? 48 : captionText.length > 60 ? 58 : 68,
          fontWeight: 700,
          lineHeight: 1.3,
          margin: 0,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'left',
        }}>
          {captionText}
        </p>
      </div>

      {/* Attribution */}
      {attribution && (
        <div style={{
          position: 'absolute',
          bottom: 210,
          left: 90,
          right: 90,
          opacity: attrOpacity,
        }}>
          <div style={{
            width: attrLineWidth,
            height: 3,
            backgroundColor: brandColor,
            marginBottom: 14,
            borderRadius: 2,
          }} />
          <p style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 28,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            margin: 0,
            fontStyle: 'italic',
          }}>
            {attribution}
          </p>
        </div>
      )}

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

      {/* Handle — bottom right, away from logo */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        right: 50,
        opacity: brandOpacity,
      }}>
        <span style={{
          color: brandColor,
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
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
