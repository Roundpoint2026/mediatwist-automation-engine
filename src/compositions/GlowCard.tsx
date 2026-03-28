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

export interface GlowCardProps {
  /** Main text content */
  captionText: string;
  /** Category or topic label */
  tagline?: string;
  /** Override brand accent color */
  brandColor?: string;
}

/**
 * GlowCard — 1080×1080 square composition
 * Centered glowing card with neon yellow border, floating particles,
 * and abstract illustration elements. Modern, tech-forward aesthetic.
 */
export const GlowCard: React.FC<GlowCardProps> = ({
  captionText,
  tagline = 'MEDIATWIST INSIGHT',
  brandColor = MEDIATWIST_COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Background ────────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // ── Card entrance ─────────────────────────────────────────
  const cardScale = spring({ frame: frame - 8, fps, from: 0.85, to: 1, config: { damping: 120, stiffness: 80 } });
  const cardOpacity = interpolate(frame, [8, 25], [0, 1], { extrapolateRight: 'clamp' });

  // ── Glow pulse animation ──────────────────────────────────
  const glowPhase = (frame % 60) / 60;
  const glowIntensity = 0.4 + 0.3 * Math.sin(glowPhase * Math.PI * 2);

  // ── Tagline ───────────────────────────────────────────────
  const tagOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });

  // ── Text reveal ───────────────────────────────────────────
  const textOpacity = interpolate(frame, [35, 60], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [35, 60], [20, 0], { extrapolateRight: 'clamp' });

  // ── Floating particles ────────────────────────────────────
  const particles = [
    { x: 120, y: 150, size: 6, delay: 0 },
    { x: 900, y: 200, size: 4, delay: 10 },
    { x: 250, y: 750, size: 5, delay: 20 },
    { x: 950, y: 780, size: 7, delay: 5 },
    { x: 500, y: 100, size: 3, delay: 15 },
    { x: 80, y: 500, size: 4, delay: 25 },
    { x: 980, y: 500, size: 5, delay: 8 },
    { x: 700, y: 950, size: 4, delay: 18 },
  ];

  // ── Abstract illustration elements ────────────────────────
  const illustrationOpacity = interpolate(frame, [5, 30], [0, 1], { extrapolateRight: 'clamp' });
  const hexRotate = interpolate(frame, [0, durationInFrames], [0, 60], { extrapolateRight: 'clamp' });

  // ── Logo + brand ──────────────────────────────────────────
  const brandOpacity = interpolate(frame, [65, 85], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 60, fps, from: 0.7, to: 1, config: { damping: 180, stiffness: 100 } });

  // Font size
  const len = captionText.length;
  const fontSize = len > 130 ? 42 : len > 90 ? 50 : len > 60 ? 58 : 66;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505', opacity: bgOpacity }}>

      {/* Background abstract illustration — hexagons & circuits */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: illustrationOpacity }}
        viewBox="0 0 1080 1080"
      >
        {/* Large hex outline — top right */}
        <polygon
          points="850,80 920,120 920,200 850,240 780,200 780,120"
          fill="none" stroke={brandColor} strokeWidth="1.5"
          opacity="0.08"
          transform={`rotate(${hexRotate}, 850, 160)`}
        />
        {/* Medium hex — moved up to avoid logo zone */}
        <polygon
          points="180,680 230,710 230,770 180,800 130,770 130,710"
          fill="none" stroke={brandColor} strokeWidth="1"
          opacity="0.06"
          transform={`rotate(${-hexRotate * 0.7}, 180, 740)`}
        />
        {/* Circuit lines */}
        <path d="M 0 300 L 120 300 L 150 270 L 200 270" fill="none" stroke={brandColor} strokeWidth="1" opacity="0.06" />
        <path d="M 880 1080 L 880 950 L 920 910 L 1080 910" fill="none" stroke={brandColor} strokeWidth="1" opacity="0.06" />
        <path d="M 1080 400 L 960 400 L 930 430 L 930 500" fill="none" stroke={brandColor} strokeWidth="1" opacity="0.05" />
        {/* Connection dots */}
        <circle cx="200" cy="270" r="4" fill={brandColor} opacity="0.1" />
        <circle cx="920" cy="910" r="4" fill={brandColor} opacity="0.1" />
        <circle cx="930" cy="500" r="3" fill={brandColor} opacity="0.08" />
        {/* Diagonal hash marks — bottom right */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={`hash-${i}`}
            x1={920 + i * 20} y1={700}
            x2={960 + i * 20} y2={660}
            stroke={brandColor} strokeWidth="1" opacity="0.06"
          />
        ))}
      </svg>

      {/* Floating particles */}
      {particles.map((p, i) => {
        const particleFrame = Math.max(frame - p.delay, 0);
        const drift = Math.sin((particleFrame + i * 50) * 0.03) * 15;
        const pOpacity = interpolate(particleFrame, [0, 20, durationInFrames - 20, durationInFrames], [0, 0.4, 0.4, 0], { extrapolateRight: 'clamp' });

        return (
          <div key={i} style={{
            position: 'absolute',
            left: p.x,
            top: p.y + drift,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: brandColor,
            opacity: pOpacity,
            boxShadow: `0 0 ${p.size * 3}px ${brandColor}88`,
          }} />
        );
      })}

      {/* MAIN CARD — centered with glow border */}
      <div style={{
        position: 'absolute',
        top: 100,
        left: 80,
        right: 80,
        bottom: 190,
        opacity: cardOpacity,
        transform: `scale(${Math.max(cardScale, 0)})`,
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: MEDIATWIST_COLORS.darkAlt,
          border: `2px solid ${brandColor}44`,
          borderRadius: 12,
          boxShadow: `0 0 ${40 * glowIntensity}px ${brandColor}22, inset 0 0 ${20 * glowIntensity}px ${brandColor}08`,
          padding: 60,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}>
          {/* Tagline inside card */}
          <div style={{
            opacity: tagOpacity,
            marginBottom: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: brandColor,
              boxShadow: `0 0 12px ${brandColor}`,
            }} />
            <span style={{
              color: brandColor,
              fontSize: 20,
              fontWeight: 800,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}>
              {tagline}
            </span>
          </div>

          {/* Main text */}
          <div style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            <h1 style={{
              color: MEDIATWIST_COLORS.text,
              fontSize,
              fontWeight: 700,
              lineHeight: 1.25,
              margin: 0,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: -0.5,
            }}>
              {captionText}
            </h1>
          </div>

          {/* Bottom of card — handle only (logo moved outside card) */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            opacity: brandOpacity,
            marginTop: 20,
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
      </div>

      {/* Logo — bottom left, ISOLATED zone outside the card */}
      <div style={{
        position: 'absolute',
        bottom: 25,
        left: 30,
        width: 140,
        height: 140,
        opacity: brandOpacity,
        transform: `scale(${Math.max(logoScale, 0)})`,
        transformOrigin: 'bottom left',
      }}>
        <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* Corner accent lines */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        width: 50,
        height: 50,
        borderTop: `2px solid ${brandColor}`,
        borderLeft: `2px solid ${brandColor}`,
        opacity: 0.3 * cardOpacity,
      }} />
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 50,
        height: 50,
        borderBottom: `2px solid ${brandColor}`,
        borderRight: `2px solid ${brandColor}`,
        opacity: 0.3 * cardOpacity,
      }} />

    </AbsoluteFill>
  );
};
