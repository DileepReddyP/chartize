export interface FloatingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export type FloatingQuadrant = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface FloatingPlacement {
  left: number;
  top: number;
  quadrant: FloatingQuadrant;
}

export interface ContainedFloatingRect extends FloatingSize {
  left: number;
  top: number;
  maxHeight: number;
}

/**
 * Fits a proposed floating surface inside a boundary, shrinking it only when
 * the boundary itself is smaller than the preferred surface. This is useful
 * after a viewport resize, when an otherwise good anchor placement may have
 * stale coordinates. maxHeight is the full distance from the contained top to
 * the boundary bottom so a long scroll surface can end flush with the viewport.
 */
export function containFloating(
  position: Pick<FloatingPlacement, "left" | "top">,
  size: FloatingSize,
  boundary: FloatingRect,
  margin = 12,
): ContainedFloatingRect {
  const minimumLeft = boundary.left + margin;
  const minimumTop = boundary.top + margin;
  const availableWidth = Math.max(0, boundary.right - boundary.left - margin * 2);
  const availableHeight = Math.max(0, boundary.bottom - boundary.top - margin * 2);
  const width = Math.min(Math.max(0, size.width), availableWidth);
  const height = Math.min(Math.max(0, size.height), availableHeight);
  const maximumLeft = Math.max(minimumLeft, boundary.right - margin - width);
  const maximumTop = Math.max(minimumTop, boundary.bottom - margin - height);

  const left = Math.max(minimumLeft, Math.min(maximumLeft, position.left));
  const top = Math.max(minimumTop, Math.min(maximumTop, position.top));

  return {
    left,
    top,
    width,
    height,
    maxHeight: Math.max(0, boundary.bottom - top),
  };
}

function overlapArea(left: number, top: number, size: FloatingSize, anchor: FloatingRect) {
  const width = Math.max(0, Math.min(left + size.width, anchor.right) - Math.max(left, anchor.left));
  const height = Math.max(0, Math.min(top + size.height, anchor.bottom) - Math.max(top, anchor.top));
  return width * height;
}

/**
 * Chooses the first roomy quadrant around an anchor, but scores every option
 * so a point near an edge can flip diagonally instead of being covered by a
 * blindly clamped bottom-right popup.
 */
export function placeFloating(
  anchor: FloatingRect,
  size: FloatingSize,
  boundary: FloatingRect,
  gap = 14,
  margin = 12,
): FloatingPlacement {
  const candidates: Array<{ quadrant: FloatingQuadrant; left: number; top: number }> = [
    { quadrant: "bottom-right", left: anchor.right + gap, top: anchor.bottom + gap },
    { quadrant: "top-right", left: anchor.right + gap, top: anchor.top - size.height - gap },
    { quadrant: "bottom-left", left: anchor.left - size.width - gap, top: anchor.bottom + gap },
    { quadrant: "top-left", left: anchor.left - size.width - gap, top: anchor.top - size.height - gap },
  ];
  const minimumLeft = boundary.left + margin;
  const maximumLeft = Math.max(minimumLeft, boundary.right - margin - size.width);
  const minimumTop = boundary.top + margin;
  const maximumTop = Math.max(minimumTop, boundary.bottom - margin - size.height);

  const best = candidates
    .map((candidate, preference) => {
      const overflow = Math.max(0, minimumLeft - candidate.left)
        + Math.max(0, candidate.left - maximumLeft)
        + Math.max(0, minimumTop - candidate.top)
        + Math.max(0, candidate.top - maximumTop);
      const left = Math.max(minimumLeft, Math.min(maximumLeft, candidate.left));
      const top = Math.max(minimumTop, Math.min(maximumTop, candidate.top));
      const overlap = overlapArea(left, top, size, anchor);
      return {
        left,
        top,
        quadrant: candidate.quadrant,
        // Covering the active item is worse than crossing an edge before the
        // final clamp; preference is only a stable tie-breaker.
        score: overlap * 100_000 + overflow * 100 + preference,
      };
    })
    .sort((left, right) => left.score - right.score)[0]!;

  return { left: best.left, top: best.top, quadrant: best.quadrant };
}
