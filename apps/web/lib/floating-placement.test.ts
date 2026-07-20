import { describe, expect, it } from "vitest";
import { placeFloating } from "./floating-placement";

const boundary = { left: 0, top: 0, right: 1000, bottom: 700 };
const size = { width: 280, height: 240 };

describe("placeFloating", () => {
  it("uses the preferred lower-right quadrant when it fits", () => {
    expect(placeFloating({ left: 200, top: 180, right: 214, bottom: 194 }, size, boundary)).toMatchObject({
      left: 228,
      top: 208,
      quadrant: "bottom-right",
    });
  });

  it("flips to the upper-left near the lower-right corner", () => {
    expect(placeFloating({ left: 920, top: 640, right: 934, bottom: 654 }, size, boundary).quadrant).toBe("top-left");
  });

  it("uses the upper-right quadrant when only the lower edge is crowded", () => {
    expect(placeFloating({ left: 200, top: 640, right: 214, bottom: 654 }, size, boundary).quadrant).toBe("top-right");
  });

  it("uses the lower-left quadrant when only the right edge is crowded", () => {
    expect(placeFloating({ left: 920, top: 180, right: 934, bottom: 194 }, size, boundary).quadrant).toBe("bottom-left");
  });

  it("stays inside the boundary without covering an edge anchor", () => {
    const placement = placeFloating({ left: 8, top: 330, right: 22, bottom: 344 }, size, boundary);
    expect(placement.left).toBeGreaterThanOrEqual(12);
    expect(placement.top).toBeGreaterThanOrEqual(12);
    expect(placement.left + size.width).toBeLessThanOrEqual(988);
    expect(placement.quadrant).toContain("right");
  });
});
