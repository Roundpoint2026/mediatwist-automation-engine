import React from 'react';
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  interpolate,
  staticFile,
} from 'remotion';
import { MEDIATWIST_COLORS } from './colors';

/**
 * Resolve image source — if it's a URL (http/https), use directly.
 * If it's a relative path (e.g., 'backgrounds/photo.jpg'), use staticFile().
 */
function resolveImageSrc(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  return staticFile(src);
}

export interface BackgroundImageProps {
  /** URL or staticFile path to background photo */
  src?: string;
  /** Darkness of overlay: 0 = no darkening, 1 = fully black. Default 0.55 */
  overlayOpacity?: number;
  /** Brand tint color overlaid. Default = yellow at very low opacity */
  tintColor?: string;
  /** Tint opacity. Default 0.08 */
  tintOpacity?: number;
  /** CSS blur amount in px. Default 2 — subtle depth blur */
  blur?: number;
  /** Zoom scale factor for subtle Ken Burns. Default 1.08 */
  zoomScale?: number;
  /** Duration for zoom animation in frames. Default = composition duration */
  zoomDuration?: number;
}

/**
 * BackgroundImage — Shared background layer for all compositions.
 *
 * Renders a photo background with:
 * - Dark overlay for text readability
 * - Subtle brand yellow tint
 * - Ken Burns slow zoom animation
 * - Optional blur for depth
 *
 * If no `src` is provided, renders a rich gradient fallback instead of plain black.
 * A post should NEVER have a plain black background.
 */
export const BackgroundImage: React.FC<BackgroundImageProps> = ({
  src,
  overlayOpacity = 0.55,
  tintColor = MEDIATWIST_COLORS.accent,
  tintOpacity = 0.08,
  blur = 2,
  zoomScale = 1.08,
  zoomDuration,
}) => {
  const frame = useCurrentFrame();

  // If no src, render an on-brand gradient fallback — black/yellow palette, never blue
  if (!src) {
    const gradientShift = interpolate(frame, [0, 300], [0, 30], { extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(${135 + gradientShift}deg, #0A0A0A 0%, #1a1a0a 30%, #1c1a00 50%, #2a2400 70%, #0A0A0A 100%)`,
        }}
      >
        {/* Yellow accent glow — stronger for brand presence */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 70% 30%, ${MEDIATWIST_COLORS.accent}33 0%, transparent 55%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Ken Burns: slow zoom in over full duration
  const duration = zoomDuration || 300; // fallback 10s @ 30fps
  const scale = interpolate(frame, [0, duration], [1, zoomScale], {
    extrapolateRight: 'clamp',
  });

  // Fade in the background image
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Photo layer with zoom */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      >
        <Img
          src={resolveImageSrc(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Dark overlay for text readability */}
      <AbsoluteFill
        style={{
          backgroundColor: MEDIATWIST_COLORS.dark,
          opacity: overlayOpacity,
        }}
      />

      {/* Brand yellow tint */}
      <AbsoluteFill
        style={{
          backgroundColor: tintColor,
          opacity: tintOpacity,
        }}
      />

      {/* Bottom gradient for logo zone legibility */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, ${MEDIATWIST_COLORS.dark} 0%, transparent 35%)`,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  );
};
