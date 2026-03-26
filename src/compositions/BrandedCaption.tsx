import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { MEDIATWIST_COLORS } from '../lib/colors';

export interface BrandedCaptionProps {
  /** The caption or quote to display — this is the star of the show */
  captionText: string;
  /** Small attribution or author line below the caption */
  attribution?: string;
  /** Override brand accent color */
  brandColor?: string;
}

/**
 * BrandedCaption — 1080×1080 square composition
 * Minimal, caption-forward design — great for quotes, stats, and bold statements
 * Accepts captionText so 3 variations can be rendered from a single script
 */
export const BrandedCaption: React.FC<BrandedCaptionProps> = ({
  captionText,
  attribution,
  brandColor = MEDIATWIST_COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background fade in
  const bgOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  // Large quotation mark springs in
  const quoteScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 120, stiffness: 80, mass: 0.8 },
  });

  // Caption text character-by-word reveal (word-level via opacity)
  const captionOpacity = interpolate(frame, [20, 55], [0, 1], { extrapolateRight: 'clamp' });
  const captionY = interpolate(frame, [20, 55], [40, 0], { extrapolateRight: 'clamp' });

  // Attribution
  const attrOpacity = interpolate(frame, [65, 85], [0, 1], { extrapolateRight: 'clamp' });

  // Corner accent squares animate in
  const cornerScale = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' });

  // Brand handle
  const brandOpacity = interpolate(frame, [75, 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: MEDIATWIST_COLORS.dark,
      opacity: bgOpacity,
    }}>

      {/* Corner accent — top left */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 120 * cornerScale,
        height: 120 * cornerScale,
        borderTop: `6px solid ${brandColor}`,
        borderLeft: `6px solid ${brandColor}`,
        opacity: 0.6,
      }} />

      {/* Corner accent — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 120 * cornerScale,
        height: 120 * cornerScale,
        borderBottom: `6px solid ${brandColor}`,
        borderRight: `6px solid ${brandColor}`,
        opacity: 0.6,
      }} />

      {/* Large quotation mark */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 80,
        transform: `scale(${quoteScale})`,
        transformOrigin: 'top left',
        color: brandColor,
        fontSize: 200,
        lineHeight: 1,
        fontFamily: 'Georgia, serif',
        fontWeight: 900,
        opacity: 0.2,
        userSelect: 'none',
      }}>
        "
      </div>

      {/* Caption text — center of canvas */}
      <div style={{
        position: 'absolute',
        top: 180,
        left: 100,
        right: 100,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        <p style={{
          color: MEDIATWIST_COLORS.text,
          fontSize: captionText.length > 80 ? 40 : 50,
          fontWeight: 600,
          lineHeight: 1.5,
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
          bottom: 160,
          left: 100,
          right: 100,
          opacity: attrOpacity,
        }}>
          <div style={{
            width: 60,
            height: 3,
            backgroundColor: brandColor,
            marginBottom: 16,
            borderRadius: 2,
          }} />
          <p style={{
            color: MEDIATWIST_COLORS.subtext,
            fontSize: 30,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            margin: 0,
            fontStyle: 'italic',
          }}>
            {attribution}
          </p>
        </div>
      )}

      {/* Brand handle */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: brandOpacity,
      }}>
        <span style={{
          color: brandColor,
          fontSize: 26,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          @mediatwist
        </span>
      </div>

    </AbsoluteFill>
  );
};
