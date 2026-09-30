import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useNavigate, useLocation } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";

/** Shared navigation into Product Details for every product card. */
function goProduct(
  navigate: ReturnType<typeof useNavigate>,
  location: ReturnType<typeof useLocation>,
  slug: string,
): void {
  beginProductTransition();
  navigate(`/products/${slug}`, { state: { from: location.pathname + location.search } });
}
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Pill, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { preloadProductDetail } from "@/lib/route-preload";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    discountPrice?: number;
    manufacturer: string;
    dosage?: string;
    strength?: string;
    form?: string;
    packSize: string;
    prescriptionRequired: boolean;
    stockQuantity: number;
    isActive: boolean;
    categoryName?: string;
    brandName?: string | null;
    imageUrl?: string;
  };
  /** Opt-in "New" badge (used by the homepage New Arrivals carousel only). */
  newArrival?: boolean;
}

/* ─── Product image presentation ───
 * The stored packshots are full-bleed source images: a 600px-wide canvas that
 * usually carries a lot of baked-in white/transparent padding around a product
 * sitting in the middle. `object-fit: contain` fits the WHOLE canvas, so the
 * actual medicine stays small no matter how large the image area is — which is
 * why simply enlarging the <img> left the product looking tiny.
 *
 * So the padding is measured and removed before display: the image is decoded
 * once into a small offscreen canvas, the bounding box of its non-background
 * pixels is found, and the <img> is then laid out so that box fills the image
 * area with `contain` proportions. The product therefore appears large while
 * the image itself is still fully visible — never cropped, stretched, squeezed
 * or blurred by a CSS transform (the box is expressed in layout pixels, so the
 * browser downsamples the source smoothly instead of scaling a raster layer).
 *
 * Everything here is progressive enhancement: if the image cannot be measured
 * (no canvas, blocked CORS, non-browser environment) the component falls back
 * to a plain centred `object-contain` image, which is the previous behaviour.
 */

/** Content box of a product image, in fractions of the natural image. */
type ContentCrop = {
  /** Left edge of the product, 0–1 of natural width. */
  x: number;
  /** Top edge of the product, 0–1 of natural height. */
  y: number;
  /** Width of the product, 0–1 of natural width. */
  w: number;
  /** Height of the product, 0–1 of natural height. */
  h: number;
  naturalWidth: number;
  naturalHeight: number;
};

/** Measured crops are cached per URL — each image is decoded at most once. */
const cropCache = new Map<string, ContentCrop | null>();

/** Longest edge of the scratch canvas used for measuring. */
const MEASURE_EDGE = 220;
/**
 * How far below the backdrop level a pixel may sit and still count as
 * backdrop. Catalogue packshots sit on a near-white sweep, often a little
 * grey or warm from JPEG compression, so the level is taken from the image
 * itself rather than assumed to be pure white.
 */
const BACKGROUND_TOLERANCE = 20;
/** Percentile used as the backdrop level: high, but not hostage to one specular pixel. */
const BACKGROUND_PERCENTILE = 0.99;
/** Ignore fully transparent pixels. */
const MIN_ALPHA = 12;
/**
 * Share of transparent pixels that means the image is a cut-out, where alpha
 * is an exact product mask and no brightness test is needed.
 */
const MIN_TRANSPARENT_SHARE = 0.15;
/** Below this share of foreground pixels the image is treated as unusable. */
const MIN_CONTENT_DENSITY = 0.02;
/** Reject degenerate slivers rather than zooming into a stray dark pixel. */
const MIN_CROP_AXIS = 0.06;
/** Breathing room added around the detected box so edges are never shaved. */
const CROP_PADDING = 0.02;
/** Never upscale a tiny source beyond this, so small crops cannot turn blurry. */
const MAX_UPSCALE = 2;
/** A crop must beat the uncropped render by this much to be worth applying. */
const MIN_IMPROVEMENT = 1.02;

/**
 * Find the bounding box of the product inside a decoded image.
 *
 * The backdrop is the bright sweep the product sits on, so the backdrop level
 * is taken as a high percentile of the image's luminance: that survives a
 * product touching a corner, a shadow, and JPEG noise, all of which broke
 * earlier corner/median based estimates. Fully transparent pixels are treated
 * as backdrop, so cut-out PNGs work too.
 *
 * Returns null when there is nothing meaningful to trim.
 */
function measureContentCrop(img: HTMLImageElement): ContentCrop | null {
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (!naturalWidth || !naturalHeight) return null;

  const scale = Math.min(1, MEASURE_EDGE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  let data: Uint8ClampedArray;
  try {
    // Throws on a CORS-tainted canvas, which is the expected failure mode for
    // third-party image hosts — callers fall back to the plain image.
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  const total = width * height;
  const luma = new Float32Array(total);
  const alpha = new Uint8ClampedArray(total);
  const opaque: number[] = [];
  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    alpha[p] = data[i + 3];
    if (alpha[p] < MIN_ALPHA) {
      luma[p] = -1;
      continue;
    }
    const value = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    luma[p] = value;
    opaque.push(value);
  }
  if (!opaque.length) return null;

  // A cut-out on transparency: alpha alone is an exact product mask. Deriving a
  // brightness threshold here would sample the product itself, since it is
  // often the only opaque thing in the image.
  const useAlpha = (total - opaque.length) / total >= MIN_TRANSPARENT_SHARE;

  let threshold = 0;
  if (!useAlpha) {
    opaque.sort((a, b) => a - b);
    const backdrop = opaque[Math.floor((opaque.length - 1) * BACKGROUND_PERCENTILE)];
    threshold = backdrop - BACKGROUND_TOLERANCE;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      // Transparent, or backdrop-coloured: not part of the product.
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

  const contentW = (maxX - minX + 1) / width;
  const contentH = (maxY - minY + 1) / height;
  // Too thin to crop safely. Whether a crop is worth applying at all is
  // decided by the caller, which can compare it against the plain render.
  if (contentW < MIN_CROP_AXIS || contentH < MIN_CROP_AXIS) return null;

  const padX = contentW * CROP_PADDING;
  const padY = contentH * CROP_PADDING;
  return {
    x: Math.max(0, minX / width - padX),
    y: Math.max(0, minY / height - padY),
    w: Math.min(1, contentW + padX * 2),
    h: Math.min(1, contentH + padY * 2),
    naturalWidth,
    naturalHeight,
  };
}

/**
 * Measure an image's content box off-screen. `undefined` means "still
 * measuring", `null` means "use the plain image" — the caller keeps rendering
 * a correctly sized image in both cases, so there is no layout shift.
 */
function useContentCrop(src: string | undefined): ContentCrop | null | undefined {
  const [crop, setCrop] = useState<ContentCrop | null | undefined>(() => {
    if (!src) return null;
    return cropCache.get(src);
  });

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const cached = cropCache.get(src);
      if (cached !== undefined) {
        setCrop(cached);
        return;
      }
      // A detached probe is used rather than crossOrigin on the visible <img>:
      // if the host withholds CORS headers only this probe fails, and the real
      // image still renders.
      const probe = new Image();
      probe.crossOrigin = "anonymous";
      probe.decoding = "async";
      probe.onload = () => {
        const result = measureContentCrop(probe);
        cropCache.set(src, result);
        if (!cancelled) setCrop(result);
      };
      probe.onerror = () => {
        cropCache.set(src, null);
        if (!cancelled) setCrop(null);
      };
      probe.src = src;
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleWindow.requestIdleCallback(measure);
    } else {
      window.setTimeout(measure, 120);
    }
    return () => {
      cancelled = true;
    };
  }, [src]);

  return crop;
}

/** Live pixel size of the image area, so the crop stays correct on resize. */
function useBoxSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    // Bail out when the size is unchanged, so measuring never triggers a
    // pointless re-render (which matters for consumers that read render order).
    const update = () =>
      setSize((prev) => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        return prev.width === width && prev.height === height
          ? prev
          : { width, height };
      });
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    schedule();
    // Environments without ResizeObserver (e.g. jsdom) still get the initial
    // measurement from the scheduled frame above.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(el);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [ref]);
  return size;
}

/**
 * Share of the image area the cropped product may fill on its limiting axis.
 * With CROP_PADDING the visible product lands at roughly 83% of the area,
 * matching the reference storefronts, while keeping a clean margin so the
 * product never touches the card edge or a corner badge.
 */
const FILL_FACTOR = 0.86;

/**
 * Renders the product image so the product — not the image's baked-in white
 * padding — fills the area.
 *
 * A crop is applied ONLY when it makes the product genuinely larger. Many
 * catalogue images are already cropped tight to the product, so trimming them
 * would shrink the product instead of growing it; those keep the plain
 * `object-contain` render, which is already as large as their aspect ratio
 * allows.
 *
 * When a crop does help, the image is laid out at explicit pixel dimensions and
 * offset so the product's bounding box is centred and fitted with `contain`
 * proportions. The full image is still displayed (the product is never cut
 * off) and its aspect ratio is preserved exactly, because the offset is
 * derived from the same scale used for the width and height.
 */
function ProductImage({
  src,
  alt,
  crop,
  box,
}: {
  src: string;
  alt: string;
  crop: ContentCrop | null | undefined;
  box: { width: number; height: number };
}) {
  const plain = (
    <img
      src={src}
      alt={alt}
      className="h-auto w-auto max-h-full max-w-full object-contain"
      loading="lazy"
      decoding="async"
    />
  );

  if (!crop || box.width <= 0 || box.height <= 0) return plain;

  const contentWidth = crop.w * crop.naturalWidth;
  const contentHeight = crop.h * crop.naturalHeight;
  if (contentWidth <= 0 || contentHeight <= 0) return plain;

  // How much of the image area the product occupies as-is.
  const plainScale = Math.min(box.width / crop.naturalWidth, box.height / crop.naturalHeight);
  const plainFill = Math.max(
    (contentWidth * plainScale) / box.width,
    (contentHeight * plainScale) / box.height
  );

  // "contain" fit of the product box inside the image area, never upscaling a
  // small source beyond MAX_UPSCALE so the result cannot look blurry.
  const fit = Math.min(
    (box.width * FILL_FACTOR) / contentWidth,
    (box.height * FILL_FACTOR) / contentHeight
  );
  const scale = Math.min(fit, MAX_UPSCALE);
  const cropFill = Math.max(
    (contentWidth * scale) / box.width,
    (contentHeight * scale) / box.height
  );

  // Trimming only helps when there is real padding to reclaim. Otherwise the
  // untouched image already fills the area as well as it can.
  if (cropFill < plainFill * MIN_IMPROVEMENT) return plain;

  const width = crop.naturalWidth * scale;
  const height = crop.naturalHeight * scale;
  // Centre the product box, then shift back by the padding that sits to the
  // left of / above it, so the visible product lands dead centre.
  const left = (box.width - contentWidth * scale) / 2 - crop.x * crop.naturalWidth * scale;
  const top = (box.height - contentHeight * scale) / 2 - crop.y * crop.naturalHeight * scale;

  return (
    <img
      src={src}
      alt={alt}
      className="absolute object-contain"
      style={{ width, height, left, top }}
      loading="lazy"
      decoding="async"
    />
  );
}

const ProductCard = memo(function ProductCard({ product, newArrival = false }: ProductCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const convexClient = useConvex();
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const imageBox = useBoxSize(imageAreaRef);
  const realImage =
    product.imageUrl && product.imageUrl !== "/placeholder-medicine.svg"
      ? product.imageUrl
      : undefined;
  const crop = useContentCrop(realImage);
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const isWishlisted = useQuery(
    api.wishlist.isWishlisted,
    user ? { productId: product._id as any } : "skip"
  );
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await addToCart({ productId: product._id as any, quantity: 1 });
      toast.success(`${product.name} added to cart`);
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("Please sign in to add items to cart");
        navigate("/auth");
      } else {
        toast.error(error.message || "Failed to add to cart");
      }
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to buy now");
      navigate(`/auth?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    goProduct(navigate, location, product.slug);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: product._id as any });
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("Please sign in to use wishlist");
      } else {
        toast.error(error.message || "Failed to update wishlist");
      }
    }
  };

  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;

  const displayInfo = product.dosage || product.strength || product.form || "";

  // Warm the destination before the click happens. Loading the route chunk
  // alone is not enough: the Product Detail page renders a bare loading state
  // until its `products.getBySlug` query resolves, and that short state makes
  // the footer fill the screen for a moment. Subscribing to the query ahead of
  // time means the page has its data on the very first render.
  const warmProductDetail = useCallback(() => {
    preloadProductDetail();
    convexClient.prewarmQuery({ query: api.products.getBySlug, args: { slug: product.slug } });
  }, [convexClient, product.slug]);

  return (
    <Card
      className="group relative overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
      onClick={() => goProduct(navigate, location, product.slug)}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
    >
      {/* Wishlist button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100"
        onClick={handleWishlist}
      >
        <Heart className={`size-4 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"}`} />
      </Button>

      {/* Product image placeholder */}
      <div
        ref={imageAreaRef}
        className="relative flex items-center justify-center bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] h-44 border-b border-border/40 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {realImage ? (
          <ProductImage
            src={realImage}
            alt={product.name}
            crop={crop}
            box={imageBox}
          />
        ) : (
          <Pill
            className="size-14 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6"
          />
        )}
        {newArrival && (
          <div className="absolute top-3 left-3">
            <Badge className="text-[10px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-md">
              New
            </Badge>
          </div>
        )}
        {hasDiscount && (
          <div className={`absolute left-3 ${newArrival ? "top-12" : "top-3"}`}>
            <Badge className="text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
              {discountPct}% OFF
            </Badge>
          </div>
        )}
        {product.stockQuantity > 0 && product.stockQuantity < 10 && (
          <div className="absolute bottom-3 left-3">
            <Badge
              variant="outline"
              className="text-[10px] font-medium text-amber-600 border-amber-300 bg-amber-50/80 backdrop-blur-sm"
            >
              Only {product.stockQuantity} left
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {product.prescriptionRequired && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx Required
              </Badge>
            )}
            {!product.prescriptionRequired && (
              <Badge variant="outline" className="text-[10px] font-medium text-green-700 border-green-200 bg-green-50/50">
                OTC
              </Badge>
            )}
            {product.brandName && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {product.brandName}
              </Badge>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300">
              {product.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground break-words">{product.manufacturer}</p>
          </div>

          {displayInfo && (
            <p className="text-xs text-muted-foreground">
              {displayInfo}{product.packSize ? ` · ${product.packSize}` : ""}
            </p>
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>

          {/* In the 2-column grids a card is only ~140px wide on a small phone,
              where "Buy Now" + "Cart" no longer fit side by side. The row wraps
              so the same two buttons stack instead of colliding; from `sm` up
              there is room, nothing wraps, and the card is unchanged. */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 px-2 sm:px-3 text-xs font-semibold gap-1 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleBuyNow}
              disabled={product.stockQuantity === 0}
            >
              <Zap className="size-3" />
              {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 px-2 sm:px-3 text-xs font-semibold gap-1 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300"
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
            >
              <ShoppingCart className="size-3" />
              Cart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ProductCard;
