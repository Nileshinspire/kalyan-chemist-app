import { describe, it, expect } from "vitest";

/**
 * The crop measurement lives inside ProductCard.tsx and depends on a real
 * canvas, so the geometry it relies on is re-implemented here against
 * synthetic images. These tests pin the behaviour the card depends on:
 * a padded packshot must yield a content box that is much smaller than the
 * canvas, a tightly cropped image must yield no useful crop, and the render
 * must never make the product smaller than a plain `contain` fit.
 */

const BACKGROUND_TOLERANCE = 20;
const BACKGROUND_PERCENTILE = 0.99;
const MIN_ALPHA = 12;
const MIN_TRANSPARENT_SHARE = 0.15;
const MIN_CONTENT_DENSITY = 0.02;
const MIN_CROP_AXIS = 0.06;
const CROP_PADDING = 0.02;
const FILL_FACTOR = 0.86;
const MAX_UPSCALE = 2;
const MIN_IMPROVEMENT = 1.02;

type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/** Fractions returned by measure(), before natural size is attached. */
type Measured = { x: number; y: number; w: number; h: number };
/** What the layout helpers consume, mirroring ContentCrop in ProductCard. */
type Crop = Measured & { naturalWidth: number; naturalHeight: number };

function solid(
  width: number,
  height: number,
  fill: [number, number, number, number] = [255, 255, 255, 255]
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { width, height, data };
}

function fillRect(
  img: Pixels,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: [number, number, number, number]
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * img.width + x) * 4;
      img.data[i] = fill[0];
      img.data[i + 1] = fill[1];
      img.data[i + 2] = fill[2];
      img.data[i + 3] = fill[3];
    }
  }
}

function measure(img: Pixels): Measured | null {
  const total = img.width * img.height;
  const luma = new Float32Array(total);
  const alpha = new Uint8ClampedArray(total);
  const opaque: number[] = [];
  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    alpha[p] = img.data[i + 3];
    if (alpha[p] < MIN_ALPHA) {
      luma[p] = -1;
      continue;
    }
    const value = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    luma[p] = value;
    opaque.push(value);
  }
  if (!opaque.length) return null;

  const useAlpha = (total - opaque.length) / total >= MIN_TRANSPARENT_SHARE;
  let threshold = 0;
  if (!useAlpha) {
    opaque.sort((a, b) => a - b);
    const backdrop = opaque[Math.floor((opaque.length - 1) * BACKGROUND_PERCENTILE)];
    threshold = backdrop - BACKGROUND_TOLERANCE;
  }

  let minX = img.width, minY = img.height, maxX = -1, maxY = -1, foreground = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const p = y * img.width + x;
      if (useAlpha ? alpha[p] < MIN_ALPHA : luma[p] >= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foreground += 1;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  if (foreground / total < MIN_CONTENT_DENSITY) return null;

  const w = (maxX - minX + 1) / img.width;
  const h = (maxY - minY + 1) / img.height;
  if (w < MIN_CROP_AXIS || h < MIN_CROP_AXIS) return null;

  const padX = w * CROP_PADDING, padY = h * CROP_PADDING;
  return {
    x: Math.max(0, minX / img.width - padX),
    y: Math.max(0, minY / img.height - padY),
    w: Math.min(1, w + padX * 2),
    h: Math.min(1, h + padY * 2),
  };
}

/** How much of the image area the product occupies, plain `contain` render. */
function plainFill(crop: Crop, box: { width: number; height: number }) {
  const scale = Math.min(box.width / crop.naturalWidth, box.height / crop.naturalHeight);
  return Math.max(
    ((crop.w * crop.naturalWidth) * scale) / box.width,
    ((crop.h * crop.naturalHeight) * scale) / box.height
  );
}

/** Everything the render needs for the cropped layout. */
function layout(crop: Crop, box: { width: number; height: number }) {
  const contentWidth = crop.w * crop.naturalWidth;
  const contentHeight = crop.h * crop.naturalHeight;
  const fit = Math.min(
    (box.width * FILL_FACTOR) / contentWidth,
    (box.height * FILL_FACTOR) / contentHeight
  );
  const scale = Math.min(fit, MAX_UPSCALE);
  return {
    scale,
    width: crop.naturalWidth * scale,
    height: crop.naturalHeight * scale,
    left: (box.width - contentWidth * scale) / 2 - crop.x * crop.naturalWidth * scale,
    top: (box.height - contentHeight * scale) / 2 - crop.y * crop.naturalHeight * scale,
    contentWidth: contentWidth * scale,
    contentHeight: contentHeight * scale,
    fill: Math.max(
      (contentWidth * scale) / box.width,
      (contentHeight * scale) / box.height
    ),
  };
}

/** Mirrors the ProductImage decision: is the crop worth applying? */
function shouldCrop(crop: Crop, box: { width: number; height: number }) {
  return layout(crop, box).fill >= plainFill(crop, box) * MIN_IMPROVEMENT;
}

function visibleBounds(crop: Crop, box: { width: number; height: number }) {
  const l = layout(crop, box);
  return {
    ...l,
    x0: l.left + crop.x * crop.naturalWidth * l.scale,
    y0: l.top + crop.y * crop.naturalHeight * l.scale,
    x1: l.left + (crop.x + crop.w) * crop.naturalWidth * l.scale,
    y1: l.top + (crop.y + crop.h) * crop.naturalHeight * l.scale,
  };
}

const BOX = { width: 280, height: 176 }; // the h-44 image area

describe("product image content crop", () => {
  it("finds a small product centred in a large white canvas", () => {
    // 600x450 canvas, product occupies the middle 200x300.
    const img = solid(600, 450);
    fillRect(img, 200, 75, 400, 375, [20, 90, 160, 255]);

    const crop = measure(img);
    expect(crop).not.toBeNull();
    expect(crop!.w).toBeLessThan(0.45);

    const withSize = { ...crop!, naturalWidth: 600, naturalHeight: 450 };
    const bounds = visibleBounds(withSize, BOX);
    // Centred within a pixel or two in both axes.
    expect((bounds.x0 + bounds.x1) / 2).toBeCloseTo(BOX.width / 2, 0);
    expect((bounds.y0 + bounds.y1) / 2).toBeCloseTo(BOX.height / 2, 0);
    // Whole product visible.
    expect(bounds.x0).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.y0).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.x1).toBeLessThanOrEqual(BOX.width + 0.5);
    expect(bounds.y1).toBeLessThanOrEqual(BOX.height + 0.5);
  });

  it("makes a padded product much larger than uncropped contain would", () => {
    // A packshot small in BOTH axes, which is the case that matters:
    // whole-canvas contain wastes most of the area.
    const img = solid(600, 600);
    fillRect(img, 200, 200, 400, 400, [20, 90, 160, 255]);
    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 600 };

    expect(shouldCrop(crop, BOX)).toBe(true);
    const before = plainFill(crop, BOX);
    expect(layout(crop, BOX).fill).toBeGreaterThan(before * 2);
    // Prominent: fills roughly the 70-85% band on its limiting axis.
    expect(layout(crop, BOX).fill).toBeGreaterThan(0.78);
    expect(layout(crop, BOX).fill).toBeLessThanOrEqual(FILL_FACTOR);
  });

  it("finds the product on a light-grey, washed-out backdrop", () => {
    // The regression this guards: a fixed "near-white" threshold classified a
    // 236-level backdrop as product, so the whole canvas looked like content,
    // no crop was produced, and the product stayed tiny.
    const img = solid(600, 600, [236, 234, 232, 255]);
    fillRect(img, 180, 180, 420, 420, [40, 80, 140, 255]);

    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 600 };
    expect(crop.w).toBeLessThan(0.5);
    expect(shouldCrop(crop, BOX)).toBe(true);
  });

  it("finds the product on a warm off-white backdrop", () => {
    const img = solid(600, 450, [250, 244, 228, 255]);
    fillRect(img, 210, 90, 390, 360, [30, 60, 120, 255]);
    const crop = measure(img);
    expect(crop).not.toBeNull();
    expect(crop!.h).toBeLessThan(0.75);
  });

  it("treats transparency as backdrop", () => {
    const img = solid(600, 600, [0, 0, 0, 0]); // fully transparent canvas
    fillRect(img, 150, 150, 450, 450, [30, 30, 30, 255]);

    const crop = measure(img);
    expect(crop).not.toBeNull();
    expect(crop!.w).toBeLessThan(0.6);
  });

  it("does NOT crop an image that already fills its canvas", () => {
    // Tight crop: nothing to reclaim, and trimming would only shrink it.
    const img = solid(300, 300);
    fillRect(img, 0, 0, 300, 300, [25, 25, 60, 255]);
    const crop = { ...measure(img)!, naturalWidth: 300, naturalHeight: 300 };
    expect(shouldCrop(crop, BOX)).toBe(false);
  });

  it("never makes the product smaller than a plain contain render", () => {
    // Real catalogue case: a product that fills the full height of its frame
    // but only part of the width. Uncropped contain already fills the height,
    // so trimming the width would make the product SMALLER.
    const img = solid(600, 464);
    fillRect(img, 0, 0, 360, 464, [30, 60, 130, 255]);
    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 464 };

    expect(plainFill(crop, BOX)).toBeCloseTo(1, 2);
    expect(shouldCrop(crop, BOX)).toBe(false);
  });

  it("returns null for a blank white image instead of zooming into nothing", () => {
    expect(measure(solid(600, 450))).toBeNull();
  });

  it("returns null for a stray dark pixel rather than cropping to a sliver", () => {
    const img = solid(600, 450);
    fillRect(img, 300, 220, 303, 223, [0, 0, 0, 255]);
    expect(measure(img)).toBeNull();
  });

  it("keeps aspect ratio intact when the box is wide", () => {
    const img = solid(600, 200);
    fillRect(img, 150, 50, 450, 150, [200, 40, 40, 255]);
    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 200 };

    const bounds = visibleBounds(crop, BOX);
    const drawn = bounds.width / bounds.height;
    expect(drawn).toBeCloseTo(600 / 200, 5); // no stretching
  });

  it("never upscales a small source past MAX_UPSCALE", () => {
    const img = solid(120, 120);
    fillRect(img, 10, 10, 110, 110, [10, 10, 200, 255]);
    const crop = { ...measure(img)!, naturalWidth: 120, naturalHeight: 120 };

    expect(layout(crop, BOX).scale).toBeLessThanOrEqual(MAX_UPSCALE);
  });
});
