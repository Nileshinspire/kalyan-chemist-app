import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useNavigate, useLocation, type NavigateFunction } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";
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
import { clsx } from "clsx";
import { motion, type Variants } from "framer-motion";

function goProduct(navigate: NavigateFunction, currentPath: string, slug: string) {
  beginProductTransition();
  navigate(`/products/${slug}`, { state: { from: currentPath } });
}

function isAuthError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string" && /not authenticated/i.test(String((error as any).message));
}

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
  x: number;
  y: number;
  w: number;
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
 */
function findCrop(img: HTMLImageElement): ContentCrop | null {
  const { naturalWidth: width, naturalHeight: height } = img;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(width, MEASURE_EDGE);
  canvas.height = Math.min(height, MEASURE_EDGE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const scale = canvas.width / width;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width: cw, height: ch } = imageData;
  const total = cw * ch;

  const luma = new Float32Array(total);
  const alpha = new Uint8Array(total);
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  let foreground = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    alpha[i] = a;
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const sorted = new Float32Array(luma);
  sorted.sort((a, b) => a - b);
  const threshold = sorted[Math.min(total - 1, Math.round(total * BACKGROUND_PERCENTILE))] + BACKGROUND_TOLERANCE;

  const useAlpha = alpha.reduce((acc, v) => acc + v, 0) / total > MIN_TRANSPARENT_SHARE;

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (useAlpha ? alpha[i] < MIN_ALPHA : luma[i] >= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foreground++;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  if (foreground / total < MIN_CONTENT_DENSITY) return null;

  const contentW = (maxX - minX + 1) / cw;
  const contentH = (maxY - minY + 1) / ch;
  if (contentW < MIN_CROP_AXIS || contentH < MIN_CROP_AXIS) return null;

  const padX = contentW * CROP_PADDING;
  const padY = contentH * CROP_PADDING;

  return {
    x: Math.max(0, minX / cw - padX),
    y: Math.max(0, minY / ch - padY),
    w: Math.min(1, (maxX - minX + 1) / cw + padX * 2),
    h: Math.min(1, (maxY - minY + 1) / ch + padY * 2),
    naturalWidth: width,
    naturalHeight: height,
  };
}

/** Reuse one scratch canvas per decode width to reduce GC pressure. */
const CANVAS_CACHE = new Map<number, HTMLCanvasElement>();

function decodeToCanvas(src: string, edge: number): HTMLCanvasElement | null {
  const cached = CANVAS_CACHE.get(edge);
  if (cached && cached.width === edge) {
    const ctx = cached.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, edge, edge);
      return cached;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  CANVAS_CACHE.set(edge, canvas);
  return canvas;
}

function measureImage(src: string): ContentCrop | null {
  if (!src || src.startsWith("data:") || !document.createElement("canvas").getContext("2d")) return null;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    if (!img.complete || img.naturalWidth === 0) return null;
    const canvas = decodeToCanvas(src, MEASURE_EDGE);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: cw, height: ch } = imageData;
    const total = cw * ch;
    const luma = new Float32Array(total);
    const alpha = new Uint8Array(total);
    let minX = Infinity;
    let maxX = -1;
    let minY = Infinity;
    let maxY = -1;
    let foreground = 0;
    for (let i = 0; i < total; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const a = data[i * 4 + 3];
      alpha[i] = a;
      luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const sorted = new Float32Array(luma);
    sorted.sort((a, b) => a - b);
    const threshold = sorted[Math.min(total - 1, Math.round(total * BACKGROUND_PERCENTILE))] + BACKGROUND_TOLERANCE;
    const useAlpha = alpha.reduce((acc, v) => acc + v, 0) / total > MIN_TRANSPARENT_SHARE;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x;
        if (useAlpha ? alpha[i] < MIN_ALPHA : luma[i] >= threshold) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        foreground++;
      }
    }
    if (maxX < minX || maxY < minY) return null;
    if (foreground / total < MIN_CONTENT_DENSITY) return null;
    const contentW = (maxX - minX + 1) / cw;
    const contentH = (maxY - minY + 1) / ch;
    if (contentW < MIN_CROP_AXIS || contentH < MIN_CROP_AXIS) return null;
    const padX = contentW * CROP_PADDING;
    const padY = contentH * CROP_PADDING;
    return {
      x: Math.max(0, minX / cw - padX),
      y: Math.max(0, minY / ch - padY),
      w: Math.min(1, (maxX - minX + 1) / cw + padX * 2),
      h: Math.min(1, (maxY - minY + 1) / ch + padY * 2),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

function useContentCrop(src: string | undefined): ContentCrop | null | undefined {
  const [crop, setCrop] = useState<ContentCrop | null | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    const cached = cropCache.get(src);
    if (cached !== undefined) {
      setCrop(cached);
      return;
    }
    const measured = measureImage(src);
    cropCache.set(src, measured);
    setCrop(measured);
  }, [src]);
  return crop;
}

function useBoxSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const schedule = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setSize({ width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) });
  }, [ref]);

  useEffect(() => {
    schedule();
    let frame = 0;
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(ref.current!);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [ref, schedule]);
  return size;
}

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

  const plainScale = Math.min(box.width / crop.naturalWidth, box.height / crop.naturalHeight);
  const plainFill = Math.max(
    (contentWidth * plainScale) / box.width,
    (contentHeight * plainScale) / box.height
  );

  const fitByWidth = Math.min(0.95, (box.width * 0.95) / contentWidth);
  const fitByHeight = box.height > 0
    ? Math.min((box.height * 1.05) / contentHeight, MAX_UPSCALE)
    : MAX_UPSCALE;
  const scale = Math.min(fitByWidth, fitByHeight);
  const cropFill = Math.max(
    (contentWidth * scale) / box.width,
    (contentHeight * scale) / box.height
  );

  const minScale60 = 60 / Math.max(contentWidth, contentHeight, 1);
  const useScale = Math.max(scale, minScale60);
  const canRender60 =
    contentWidth * useScale <= box.width &&
    (box.height > 0 ? contentHeight * useScale <= box.height * 1.05 : true);

  if (!canRender60) return plain;

  const width = Math.max(60, crop.naturalWidth * useScale);
  const height = Math.max(60, crop.naturalHeight * useScale);
  const left =
    (box.width - contentWidth * useScale) / 2 - crop.x * crop.naturalWidth * useScale;
  const top =
    (box.height - contentHeight * useScale) / 2 - crop.y * crop.naturalHeight * useScale;

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
    const signInUrl = `/auth?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`;
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate(signInUrl);
      return;
    }
    try {
      await addToCart({ productId: product._id as any, quantity: 1 });
      toast.success(`${product.name} added to cart`);
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to add items to cart");
        navigate(signInUrl);
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
    goProduct(navigate, location.pathname + location.search, product.slug);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: product._id as any });
    } catch (error: any) {
      if (isAuthError(error)) {
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

  const warmProductDetail = useCallback(() => {
    preloadProductDetail();
    convexClient.prewarmQuery({ query: api.products.getBySlug, args: { slug: product.slug } });
  }, [convexClient, product.slug]);

  const motionBuiltIn: boolean =
    typeof window !== "undefined" && (window as any).__PRODUCT_CARD_MOTION_BUILT_IN__ === true;

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate={motionBuiltIn ? "visible" : undefined}
      className="group relative h-full flex-col overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:gap-0 max-sm:py-0"
      onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
    >
      <Card
        className="group relative h-full flex-col overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:gap-0 max-sm:py-0"
        onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
        onMouseEnter={warmProductDetail}
        onFocus={warmProductDetail}
        onPointerDown={warmProductDetail}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-110 transition-all duration-300 opacity-100 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={handleWishlist}
        >
          <Heart className={`size-4 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"}`} />
        </Button>

        <div
          ref={imageAreaRef}
          className="relative flex h-24 min-h-[100px] items-center justify-center overflow-hidden rounded-xl border-b border-border/40 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] sm:h-44"
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

        <CardContent className="flex flex-1 flex-col p-2.5 sm:p-4">
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
              <h3 className="text-sm max-sm:text-[13px] max-sm:leading-snug font-semibold max-sm:leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300">
                {product.name}
              </h3>
              <p className="mt-0.5 text-xs max-sm:text-[11px] max-sm:leading-snug text-muted-foreground break-words max-sm:line-clamp-2">{product.manufacturer}</p>
            </div>

            {displayInfo && (
              <p className="text-xs max-sm:text-[11px] max-sm:leading-snug text-muted-foreground">
                {displayInfo}{product.packSize ? ` · ${product.packSize}` : ""}
              </p>
            )}

            <div className="flex items-baseline gap-1.5">
              <span className="text-lg max-sm:text-base font-extrabold text-foreground">
                {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
          </div>

          <div className={clsx(
            "mt-auto flex flex-wrap gap-2 pt-2.5 max-sm:gap-1 max-sm:pt-1.5",
            motionBuiltIn && "opacity-0 motion-safe:opacity-100 motion-safe:duration-700 motion-safe:transition-opacity"
          )}>
            <Button
              size="sm"
              className="h-8 max-sm:h-8 max-sm:px-1 max-sm:py-0 flex-1 min-w-0 px-2 sm:px-3 text-[11px] max-sm:text-[11px] sm:text-xs font-semibold gap-1 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleBuyNow}
              disabled={product.stockQuantity === 0}
            >
              <Zap className="size-3 max-sm:hidden" />
              {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 max-sm:h-8 max-sm:px-1 max-sm:py-0 shrink-0 px-2 sm:px-3 text-[11px] max-sm:text-[11px] sm:text-xs font-semibold gap-1 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300"
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
            >
              <ShoppingCart className="size-3 max-sm:hidden" />
              Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

export default ProductCard;
