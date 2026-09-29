import { describe, it, expect } from "vitest";

/**
 * The crop measurement lives inside ProductCard.tsx and depends on a real
 * canvas, so the geometry it relies on is re-implemented here against
 * synthetic images. These tests pin the behaviour the card depends on:
 * a padded packshot must yield a content box that is much smaller than the
 * canvas, a tightly cropped image must yield no crop at all, and the
 * contain-fit must keep the product centred and fully visible.
 */

/** Mirrors measureContentCrop() in ProductCard.tsx. */
const BACKGROUND_LEVEL = 240;
const MIN_ALPHA = 12;
const MIN_CONTENT_DENSITY = 0.02;
const ALREADY_TIGHT = 0.92;
const MIN_CROP_AXIS = 0.06;
const CROP_PADDING = 0.03;

type Pixels = { width: number; height: number; data: Uint8ClampedArray };

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

function measure(img: Pixels) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;

  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < MIN_ALPHA) continue;
      if (
        img.data[i] >= BACKGROUND_LEVEL &&
        img.data[i + 1] >= BACKGROUND_LEVEL &&
        img.data[i + 2] >= BACKGROUND_LEVEL
      ) {
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foreground += 1;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  if (foreground / (img.width * img.height) < MIN_CONTENT_DENSITY) return null;

  const w = (maxX - minX + 1) / img.width;
  const h = (maxY - minY + 1) / img.height;
  if (w >= ALREADY_TIGHT && h >= ALREADY_TIGHT) return null;
  if (w < MIN_CROP_AXIS || h < MIN_CROP_AXIS) return null;

  const padX = w * CROP_PADDING;
  const padY = h * CROP_PADDING;
  return {
    x: Math.max(0, minX / img.width - padX),
    y: Math.max(0, minY / img.height - padY),
    w: Math.min(1, w + padX * 2),
    h: Math.min(1, h + padY * 2),
  };
}

const FILL_FACTOR = 0.96;
const MAX_UPSCALE = 2;

/** Mirrors the contain-fit + centring in ProductCard.tsx. */
function layout(
  crop: NonNullable<ReturnType<typeof measure>>,
  box: { width: number; height: number }
) {
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
  };
}

/** Where the product's own box ends up inside the image area. */
function visibleBounds(
  crop: NonNullable<ReturnType<typeof measure>>,
  box: { width: number; height: number }
) {
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
    expect(crop!.h).toBeGreaterThan(0.5);

    const bounds = visibleBounds({ ...crop!, naturalWidth: 600, naturalHeight: 450 }, BOX);
    // Centred within a pixel or two in both axes.
    expect((bounds.x0 + bounds.x1) / 2).toBeCloseTo(BOX.width / 2, 0);
    expect((bounds.y0 + bounds.y1) / 2).toBeCloseTo(BOX.height / 2, 0);
    // Whole product visible, and it now dominates the area.
    expect(bounds.x0).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.y0).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.x1).toBeLessThanOrEqual(BOX.width + 0.5);
    expect(bounds.y1).toBeLessThanOrEqual(BOX.height + 0.5);
    expect(bounds.contentHeight / BOX.height).toBeGreaterThan(0.9);
  });

  it("makes a padded product far larger than uncropped contain would", () => {
    // A packshot that is small in BOTH axes, which is the case that matters:
    // whole-canvas contain wastes most of the area.
    const img = solid(600, 600);
    fillRect(img, 200, 200, 400, 400, [20, 90, 160, 255]);
    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 600 };

    // Whole canvas fitted with contain: the product only gets 200/600 of it.
    const naiveScale = Math.min(BOX.width / 600, BOX.height / 600);
    const naiveProductSize = 200 * naiveScale;

    expect(layout(crop, BOX).contentHeight).toBeGreaterThan(naiveProductSize * 2);
  });

  it("gains little when the product already fills the canvas height", () => {
    // Guards against over-cropping: a tall product in a height-bound canvas is
    // already near the limit, so the crop must not distort or clip it.
    const img = solid(600, 450);
    fillRect(img, 200, 75, 400, 375, [20, 90, 160, 255]);
    const crop = { ...measure(img)!, naturalWidth: 600, naturalHeight: 450 };

    const bounds = visibleBounds(crop, BOX);
    expect(bounds.y0).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.y1).toBeLessThanOrEqual(BOX.height + 0.5);
    expect(bounds.width / bounds.height).toBeCloseTo(600 / 450, 5);
  });

  it("treats transparency as background like white", () => {
    const img = solid(600, 600, [0, 0, 0, 0]); // fully transparent canvas
    fillRect(img, 150, 150, 450, 450, [30, 30, 30, 255]);

    const crop = measure(img);
    expect(crop).not.toBeNull();
    expect(crop!.w).toBeLessThan(0.6);
  });

  it("returns null for an image that already fills its canvas", () => {
    const img = solid(600, 450, [12, 40, 90, 255]);
    expect(measure(img)).toBeNull();
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
    const natural = crop.naturalWidth / crop.naturalHeight;
    expect(drawn).toBeCloseTo(natural, 5); // no stretching
    // Width-bound in a wide box, and it uses the full width.
    expect(bounds.x1 - bounds.x0).toBeGreaterThan(BOX.width * 0.9);
  });

  it("never upscales a small source past MAX_UPSCALE", () => {
    const img = solid(120, 120);
    fillRect(img, 10, 10, 110, 110, [10, 10, 200, 255]);
    const crop = { ...measure(img)!, naturalWidth: 120, naturalHeight: 120 };

    expect(layout(crop, BOX).scale).toBeLessThanOrEqual(MAX_UPSCALE);
  });
});
