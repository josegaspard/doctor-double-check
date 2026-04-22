import React, { useMemo, useRef, useState, useEffect } from 'react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';

interface HoverPlayCardProps {
  recordingId: string;
  thumbnailUrl?: string;
  /** Short preview clip URL (mp4/webm). When omitted, only the static poster shows. */
  previewClipUrl?: string;
  alt: string;
  /** When false, no hover-play and no watermark — only static poster (e.g. unpurchased). */
  enableHoverPlay: boolean;
  /** User identity for watermark (only mounted while playing). */
  userEmail?: string | null;
  userId?: string | null;
}

/**
 * Card thumbnail with hover-play preview + DRM watermark.
 * - Static poster only when not hovering OR when `enableHoverPlay=false`.
 * - On hover (with hover-play enabled): mounts <video autoPlay muted loop> + <DynamicWatermark>.
 * - `previewSessionId` is stable per `recordingId` — re-hovering the same card
 *   reuses the same id; hovering a different card generates a new one.
 */
export function HoverPlayCard({
  recordingId,
  thumbnailUrl,
  previewClipUrl,
  alt,
  enableHoverPlay,
  userEmail,
  userId,
}: HoverPlayCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stable per-card session id — survives mouseLeave/mouseEnter cycles.
  const previewSessionId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `prev-${recordingId}-${Date.now().toString(36)}`,
    [recordingId]
  );

  // Stop the video when leaving hover to free decoder
  useEffect(() => {
    if (!isHovering && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {
        /* noop */
      }
    }
  }, [isHovering]);

  const showHoverPlay = enableHoverPlay && isHovering && !!previewClipUrl;

  return (
    <div
      data-testid={`hover-play-card-${recordingId}`}
      data-hovering={isHovering ? 'true' : 'false'}
      data-hover-play-enabled={enableHoverPlay ? 'true' : 'false'}
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Static poster (always rendered as fallback / first paint) */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}

      {/* Hover-play preview video — only when allowed */}
      {showHoverPlay && (
        <video
          ref={videoRef}
          data-testid={`hover-play-video-${recordingId}`}
          className="absolute inset-0 w-full h-full object-cover"
          src={previewClipUrl}
          autoPlay
          muted
          loop
          playsInline
          controlsList="nodownload"
          disablePictureInPicture
          aria-label={alt}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* DRM watermark mounts ONLY while hover-play is active */}
      {showHoverPlay && (
        <DynamicWatermark
          email={userEmail || undefined}
          userId={userId || undefined}
          sessionId={previewSessionId}
        />
      )}
    </div>
  );
}
