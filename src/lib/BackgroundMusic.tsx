import React from 'react';
import {
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

export interface BackgroundMusicProps {
  /**
   * Path to the audio file, relative to public/ (e.g., 'audio/ambient-tech-pulse.mp3').
   * If empty/null, no audio plays — video remains silent.
   */
  src?: string | null;

  /**
   * Base volume for the music (0 to 1).
   * Default: 0.18 — subtle background level.
   */
  volume?: number;

  /**
   * Number of frames for the fade-in at the start.
   * Default: 30 (1 second at 30fps).
   */
  fadeInFrames?: number;

  /**
   * Number of frames for the fade-out at the end.
   * Default: 45 (1.5 seconds at 30fps).
   */
  fadeOutFrames?: number;

  /**
   * Start playback at this offset in seconds into the track.
   * Useful for skipping intros. Default: 0.
   */
  startFrom?: number;
}

/**
 * BackgroundMusic — shared component for all Mediatwist compositions.
 *
 * Plays a subtle audio track behind the video with smooth fade-in/out.
 * Designed to be non-intrusive: default volume is 0.18 (18%).
 *
 * Usage:
 *   <BackgroundMusic src="audio/ambient-tech-pulse.mp3" />
 *   <BackgroundMusic src="audio/energetic-startup-drive.mp3" volume={0.22} />
 *   <BackgroundMusic src={null} />  // No audio — safe to include always
 */
export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
  src,
  volume = 0.18,
  fadeInFrames = 30,
  fadeOutFrames = 45,
  startFrom = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // No audio file provided — render nothing (silent video)
  if (!src) return null;

  // Resolve audio source — supports both URLs and local staticFile paths
  const audioSrc = src.startsWith('http://') || src.startsWith('https://')
    ? src
    : staticFile(src);

  // Frame-by-frame volume with fade in/out
  const fadeInEnd = fadeInFrames;
  const fadeOutStart = durationInFrames - fadeOutFrames;

  const currentVolume = interpolate(
    frame,
    [0, fadeInEnd, fadeOutStart, durationInFrames],
    [0, volume, volume, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <Audio
      src={audioSrc}
      volume={currentVolume}
      startFrom={Math.round(startFrom * fps)}
    />
  );
};
