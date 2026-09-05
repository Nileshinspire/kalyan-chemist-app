import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send,
  Mic,
  MicOff,
  Plus,
  Trash2,
  ShoppingCart,
  RefreshCw,
  HelpCircle,
  Bot,
  User,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Languages,
  Pill,
  Search,
  ClipboardList,
  Stethoscope,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  Phone,
  Package,
  Truck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  XCircle,
  IndianRupee,
  PackageX,
  History,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS — brand tokens (matches Kalyan Chemist palette)
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   RENDERING HELPERS — markdown-lite (bold, links, bullets)
   ═══════════════════════════════════════════Regex═════════════ */

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = boldRegex.exec(line)) !== null) {
      if (m.index > lastIdx) parts.push(line.slice(lastIdx, m.index));
      parts.push(
        <strong key={`b-${idx}-${m.index}`} className="font-semibold text-foreground">
          {m[1]}
        </strong>,
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    if (parts.length === 0) parts.push(line);

    const rendered = parts.map((p, pi) => {
      if (typeof p !== "string") return p;
      const linkRe = /\[(.+?)\]\((.+?)\)/g;
      const segs: React.ReactNode[] = [];
      let li = 0;
      let lm: RegExpExecArray | null;
      while ((lm = linkRe.exec(p)) !== null) {
        if (lm.index > li) segs.push(p.slice(li, lm.index));
        segs.push(
          <a
            key={`lk-${idx}-${pi}-${lm.index}`}
            href={lm[2]}
            className="text-[oklch(0.45_0.12_170)] font-medium underline underline-offset-2 decoration-[oklch(0.45_0.12_170)]/40 hover:decoration-[oklch(0.45_0.12_170)] transition-colors"
          >
            {lm[1]}
          </a>,
        );
        li = lm.index + lm[0].length;
      }
      if (li < p.length) segs.push(p.slice(li));
      return segs.length ? segs : p;
    });

    if (line.trim().startsWith("• ") || line.trim().startsWith("- ")) {
      const content = line.trim().slice(2);
      elements.push(
        <div key={`li-${idx}`} className="flex gap-2 ml-0.5 py-[1px]">
          <span className="text-[oklch(0.45_0.12_170)] mt-px shrink-0 text-[9px] leading-[18px]">●</span>
          <span className="text-[13px] leading-relaxed">{content.length > 2 ? rendered : content}</span>
        </div>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`br-${idx}`} className="h-1.5" />);
    } else {
      elements.push(
        <div key={`p-${idx}`} className="text-[13px] leading-relaxed">
          {rendered}
        </div>,
      );
    }
  });

  return <>{elements}</>;
}

/* ══════════════════════════════════════════════════════════════
   STRUCTURED CARD PARSERS — derive rich cards from the REAL
   assistant message content already produced by the backend
   (product search, order tracking, refill suggestion). No
   backend changes; only presentation of existing data.
   ══════════════════════════════════════════════════════════════ */

interface ProductCardData {
  name: string;
  detail: string;
  meta: string;
  href?: string;
}

function parseProductBlocks(content: string): { intro: string; products: ProductCardData[]; outro: string } {
  const lines = content.split("\n");
  const products: ProductCardData[] = [];
  const introLines: string[] = [];
  const outroLines: string[] = [];
  let current: Partial<ProductCardData> | null = null;

  const flush = (target: "products" | null) => {
    if (current?.name) products.push(current as ProductCardData);
    current = null;
    return target;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
    const isIndent = trimmed.startsWith("• ") === false && /^\s{2,}/.test(line) && current;

    if (isBullet || isIndent) {
      const clean = trimmed.replace(/^[•\-]\s*/, "");
      // Heuristic: product bullet lines contain "**Name** — detail" or "Name — detail"
      const nameMatch = clean.match(/^\*\*(.+?)\*\*\s*[—-]\s*(.*)$/);
      if (nameMatch) {
        flush("products");
        current = { name: nameMatch[1], detail: nameMatch[2] || "", meta: "" };
      } else if (current) {
        current.meta = (current.meta ? current.meta + " · " : "") + clean.replace(/\[.+?\]\(.+?\)/g, "");
      } else {
        introLines.push(line);
      }
    } else {
      const isOutro =
        /would you like|browse|catalogue|notify|add any|details on|visit your|full refill/i.test(trimmed);
      if (current) flush("products");
      (isOutro ? outroLines : introLines).push(line);
    }
  });
  flush(null);

  // extract links out of detail
  products.forEach((p) => {
    if (p.detail) {
      const hrefMatch = p.detail.match(/\[(.+?)\]\((.+?)\)/);
      if (hrefMatch) p.href = hrefMatch[2];
      p.detail = p.detail.replace(/\[.+?\]\(.+?\)/g, "").trim();
      if (p.meta) p.meta = p.meta.replace(/\[.+?\]\(.+?\)/g, "").trim();
    }
  });

  return { intro: introLines.join("\n").trim(), products, outro: outroLines.join("\n").trim() };
}

interface OrderCardData {
  id: string;
  status: string;
  items: string;
  meta: string;
}

const ORDER_STATUS_META: Record<string, { icon: any; label: string; tone: string; dot: string }> = {
  pending: { icon: Clock3, label: "Pending", tone: "bg-amber-50 text-amber-700 border-amber-200/70", dot: "bg-amber-500" },
  confirmed: { icon: CheckCircle2, label: "Confirmed", tone: "bg-blue-50 text-blue-700 border-blue-200/70", dot: "bg-blue-500" },
  processing: { icon: Package, label: "Processing", tone: "bg-violet-50 text-violet-700 border-violet-200/70", dot: "bg-violet-500" },
  ready_for_dispatch: { icon: Package, label: "Ready for Dispatch", tone: "bg-indigo-50 text-indigo-700 border-indigo-200/70", dot: "bg-indigo-500" },
  out_for_delivery: { icon: Truck, label: "Out for Delivery", tone: "bg-emerald-50 text-emerald-700 border-emerald-200/70", dot: "bg-emerald-500" },
  delivered: { icon: CheckCircle2, label: "Delivered", tone: "bg-emerald-50 text-emerald-700 border-emerald-200/70", dot: "bg-emerald-500" },
  cancelled: { icon: XCircle, label: "Cancelled", tone: "bg-rose-50 text-rose-700 border-rose-200/70", dot: "bg-rose-500" },
  refund_initiated: { icon: RefreshCw, label: "Refund Initiated", tone: "bg-orange-50 text-orange-700 border-orange-200/70", dot: "bg-orange-500" },
  refunded: { icon: IndianRupee, label: "Refunded", tone: "bg-teal-50 text-teal-700 border-teal-200/70", dot: "bg-teal-500" },
};

function parseOrderBlocks(content: string): { intro: string; orders: OrderCardData[]; outro: string } {
  const lines = content.split("\n");
  const orders: OrderCardData[] = [];
  const introLines: string[] = [];
  const outroLines: string[] = [];
  let current: Partial<OrderCardData> | null = null;

  const flush = () => {
    if (current?.id) orders.push(current as OrderCardData);
    current = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
    if (isBullet) {
      const clean = trimmed.replace(/^[•\-]\s*/, "");
      const idMatch = clean.match(/^\*\*(?:Order\s*)?(#?.+?)\*\*\s*(.*)$/i);
      if (idMatch && /order/i.test(clean)) {
        flush();
        current = { id: idMatch[1].replace(/^#/, "#"), status: "", items: "", meta: "" };
        const rest = idMatch[2] || "";
        const statusPart = rest.replace(/[⏳✅📦🚚🏍️🎉❌🔄💰]/g, "").trim();
        current.status = statusPart.replace(/\s+/g, " ");
      } else if (current) {
        current.items = clean;
      } else {
        introLines.push(line);
      }
    } else {
      if (/^\s{2,}/.test(line) && current && !current.items) {
        current.items = trimmed;
      } else if (/^\s{2,}/.test(line) && current) {
        current.meta = current.meta ? current.meta + " · " + trimmed : trimmed;
      } else {
        flush();
        const isOutro = /would you like|details on a specific/i.test(trimmed);
        (isOutro ? outroLines : introLines).push(line);
      }
    }
  });
  flush();

  return { intro: introLines.join("\n").trim(), orders, outro: outroLines.join("\n").trim() };
}

interface RefillCardData {
  name: string;
  lastOrdered: string;
}

function parseRefillBlocks(content: string): { intro: string; refills: RefillCardData[]; outro: string } {
  const lines = content.split("\n");
  const refills: RefillCardData[] = [];
  const introLines: string[] = [];
  const outroLines: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-");
    if (isBullet) {
      const clean = trimmed.replace(/^[•\-]\s*/, "");
      const m = clean.match(/^\*\*(.+?)\*\*\s*[—-]\s*(.*)$/);
      if (m && /last ordered/i.test(m[2])) {
        refills.push({ name: m[1], lastOrdered: m[2].replace(/\[.+?\]\(.+?\)/g, "").trim() });
      } else {
        introLines.push(line);
      }
    } else {
      const isOutro = /medicine refill|refill details|visit your/i.test(trimmed);
      (isOutro ? outroLines : introLines).push(line);
    }
  });

  return { intro: introLines.join("\n").trim(), refills, outro: outroLines.join("\n").trim() };
}

/* ══════════════════════════════════════════════════════════════
   SMART ACTION CHIPS (after assistant messages)
   ══════════════════════════════════════════════════════════════ */

function extractActionChips(content: string): { label: string; action: string }[] {
  const chips: { label: string; action: string }[] = [];
  const lower = content.toLowerCase();

  if (lower.includes("view product") || lower.includes("browse") || lower.includes("viewing product")) {
    chips.push({ label: "Browse Products", action: "navigate:/products" });
  }
  if (lower.includes("add to cart") || lower.includes("add it to your cart")) {
    chips.push({ label: "Go to Cart", action: "navigate:/cart" });
  }
  if (lower.includes("track") && (lower.includes("order") || lower.includes("delivery"))) {
    chips.push({ label: "Track Order", action: "query:Where is my order?" });
  }
  if (lower.includes("refill")) {
    chips.push({ label: "Refill Medicines", action: "navigate:/refill" });
  }
  if (lower.includes("pharmacist") || lower.includes("human support") || lower.includes("connect you")) {
    chips.push({ label: "Talk to Pharmacist", action: "query:Connect me with a pharmacist" });
  }
  if (lower.includes("upload") && lower.includes("prescription")) {
    chips.push({ label: "Upload Prescription", action: "navigate:/upload-prescription" });
  }
  return chips.slice(0, 3);
}

/* ══════════════════════════════════════════════════════════════
   TOPIC PILLS — premium compact starters
   ══════════════════════════════════════════════════════════════ */

const TOPIC_PILLS = [
  { icon: Search, label: "Search Medicines", prompt: "I want to search for medicines" },
  { icon: ClipboardList, label: "Track Order", prompt: "Where is my order?" },
  { icon: RefreshCw, label: "Refill Medicine", prompt: "I want to refill my medicines" },
  { icon: Pill, label: "Check Availability", prompt: "Is this product available in stock?" },
  { icon: HelpCircle, label: "Help With Cart", prompt: "Take me to my cart" },
  { icon: Stethoscope, label: "Talk to Pharmacist", prompt: "Connect me with a pharmacist" },
];

const TRY_ASKING = [
  "Do you have Dolo 650?",
  "Where is my order?",
  "Can I refill my medicine?",
  "Is this medicine available?",
  "Help me find a product",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "hinglish", label: "Hinglish" },
];

/* ══════════════════════════════════════════════════════════════
   HOOKS — unchanged behavior
   ══════════════════════════════════════════════════════════════ */

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setIsSupported(true);
      const r = new SR();
      r.continuous = false;
      r.interimResults = false;
      r.lang = "en-IN";
      r.onresult = (e: any) => {
        onTranscript(e.results[0][0].transcript);
        setIsListening(false);
      };
      r.onerror = () => setIsListening(false);
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
    }
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) return;
    isListening ? (recognitionRef.current.stop(), setIsListening(false)) : (recognitionRef.current.start(), setIsListening(true));
  }, [isListening]);

  return { isListening, isSupported, toggle };
}

function useTextToSpeech() {
  const [enabled, setEnabled] = useState(false);
  const speak = useCallback(
    (text: string) => {
      if (!enabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/\*\*/g, "").replace(/\[.+?\]\(.+?\)/g, "").replace(/[•\-]+/g, "").replace(/\n+/g, ". ");
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "en-IN";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    },
    [enabled],
  );
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  return { enabled, setEnabled, speak };
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function AiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "size-16 rounded-[20px]" : size === "md" ? "size-9 rounded-xl" : "size-7 rounded-lg";
  const icon = size === "lg" ? "size-7" : size === "md" ? "size-4" : "size-3.5";
  return (
    <div
      className={`relative flex ${dims} shrink-0 items-center justify-center bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.36_0.09_173)] text-white shadow-sm shadow-[oklch(0.45_0.12_170)]/20`}
    >
      <Bot className={icon} />
    </div>
  );
}

function ProductResultCards({ products }: { products: ProductCardData[] }) {
  return (
    <div className="mt-3 space-y-2">
      {products.map((p, i) => {
        const priceMatch = p.meta.match(/₹[\d,.]+(?:\s*\(was ₹[\d,.]+\))?/);
        const rx = /rx required/i.test(p.detail + " " + p.meta);
        const stockOut = /out of stock/i.test(p.detail + " " + p.meta);
        return (
          <div
            key={i}
            className="group rounded-xl border border-border/50 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-[oklch(0.45_0.12_170)]/25 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.03_170)] border border-[oklch(0.45_0.12_170)]/10">
                <Pill className="size-5 text-[oklch(0.45_0.12_170)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-foreground leading-snug truncate">{p.name}</p>
                  {rx && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-200 text-amber-600 bg-amber-50 shrink-0">
                      Rx
                    </Badge>
                  )}
                </div>
                {p.detail && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">{p.detail}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {priceMatch && (
                    <span className="text-[12px] font-bold text-foreground">{priceMatch[0]}</span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      stockOut
                        ? "bg-rose-50 text-rose-600 border-rose-200/70"
                        : "bg-[oklch(0.96_0.03_170)] text-[oklch(0.45_0.12_170)] border-[oklch(0.45_0.12_170)]/15"
                    }`}
                  >
                    {stockOut ? <PackageX className="size-2.5" /> : <CheckCircle2 className="size-2.5" />}
                    {stockOut ? "Out of Stock" : "In Stock"}
                  </span>
                  {p.meta
                    .replace(priceMatch?.[0] || "", "")
                    .replace(/📋/g, "")
                    .trim()
                    .split(/[|·]/)
                    .filter((s) => s.trim())
                    .slice(0, 2)
                    .map((s, j) => (
                      <span key={j} className="text-[10px] text-muted-foreground/80 truncate max-w-[140px]">
                        {s.trim()}
                      </span>
                    ))}
                </div>
              </div>
              {p.href && (
                <a
                  href={p.href}
                  className="shrink-0 self-center inline-flex items-center gap-1 rounded-lg bg-[oklch(0.45_0.12_170)]/[0.07] px-2.5 py-1.5 text-[11px] font-semibold text-[oklch(0.45_0.12_170)] hover:bg-[oklch(0.45_0.12_170)]/[0.14] transition-colors"
                >
                  View <ArrowUpRight className="size-3" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderResultCards({ orders }: { orders: OrderCardData[] }) {
  return (
    <div className="mt-3 space-y-2">
      {orders.map((o, i) => {
        const key = o.status.toLowerCase().trim().replace(/\s+/g, "_");
        const meta =
          ORDER_STATUS_META[key] ||
          ORDER_STATUS_META[Object.keys(ORDER_STATUS_META).find((k) => key.includes(k) || k.includes(key)) || ""] || {
            icon: Package,
            label: o.status || "Order",
            tone: "bg-muted text-muted-foreground border-border",
            dot: "bg-muted-foreground",
          };
        const Icon = meta.icon;
        return (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-[oklch(0.45_0.12_170)]/25 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-foreground tracking-tight">{o.id.toUpperCase()}</span>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}>
                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            </div>
            {o.items && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{o.items}</p>}
            {o.meta && (
              <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1.5">
                <History className="size-2.5" />
                {o.meta}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RefillResultCards({ refills }: { refills: RefillCardData[] }) {
  return (
    <div className="mt-3 space-y-2">
      {refills.map((r, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-[oklch(0.45_0.12_170)]/25 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.96_0.03_170)] border border-[oklch(0.45_0.12_170)]/10">
              <RefreshCw className="size-4.5 text-[oklch(0.45_0.12_170)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground leading-snug truncate">{r.name}</p>
              {r.lastOrdered && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.lastOrdered}</p>
              )}
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200/70">
                <Clock3 className="size-2.5" />
                Refill Due
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function AIChatbot() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const conversations = useQuery(api.chatbot.getConversations);
  const createConversation = useMutation(api.chatbot.createConversation);
  const sendAiMessage = useAction(api.chatbotLlm.sendLlmMessage);
  const deleteConversation = useMutation(api.chatbot.deleteConversation);
  const proactiveSuggestions = useQuery(api.chatbot.getProactiveSuggestions);

  const [activeConvId, setActiveConvId] = useState<Id<"chatbot_conversations"> | null>(null);
  const messages = useQuery(
    activeConvId ? api.chatbot.getMessages : ("skip" as any),
    activeConvId ? { conversationId: activeConvId } : ("skip" as any),
  );

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: voiceSupported, toggle: toggleVoice } = useVoiceInput((t) => setInput(t));
  const { enabled: ttsOn, setEnabled: setTts, speak } = useTextToSpeech();

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* TTS for latest assistant message */
  useEffect(() => {
    if (messages?.length) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant") speak(last.content);
    }
  }, [messages?.length]);

  /* ── Send ── */
  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || isTyping) return;
      setInput("");
      setShowLangPicker(false);

      let convId = activeConvId;
      if (!convId) {
        try {
          convId = await createConversation();
          setActiveConvId(convId);
        } catch {
          toast.error("Failed to start conversation");
          return;
        }
      }

      setIsTyping(true);
      try {
        // LLM engine (Claude + function-calling) — generates the reply, runs
        // data tools, and persists both messages server-side. The UI simply
        // renders the updated conversation from the reactive getMessages query.
        const result = await sendAiMessage({ conversationId: convId, content: msg });
        if (result.handoffTriggered) toast.info("Connecting you with a pharmacist…");
      } catch (err: any) {
        toast.error(err.message || "Failed to send message");
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [input, activeConvId, isTyping, createConversation, sendAiMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const handleDelete = async (id: Id<"chatbot_conversations">) => {
    try {
      await deleteConversation({ conversationId: id });
      if (activeConvId === id) setActiveConvId(null);
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  /* ── Action chip click ── */
  const handleChipAction = (action: string) => {
    if (action.startsWith("navigate:")) {
      navigate(action.slice("navigate:".length));
    } else if (action.startsWith("query:")) {
      handleSend(action.slice("query:".length));
    }
  };

  const hasMessages = messages && messages.length > 0;
  const showWelcome = !activeConvId && !hasMessages;
  const userInitial = user?.name?.trim()?.[0]?.toUpperCase() || user?.email?.trim()?.[0]?.toUpperCase() || "U";

  /* Parsed structured blocks for the latest assistant message */
  const lastAssistant = useMemo(() => {
    if (!messages?.length) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i] as any;
    }
    return null;
  }, [messages]);

  const structured = useMemo(() => {
    if (!lastAssistant) return null;
    const content = lastAssistant.content || "";
    const lower = content.toLowerCase();
    if (lastAssistant.orderIds?.length || (lower.includes("order") && /• \*\*#/.test(content))) {
      return { kind: "order" as const, ...parseOrderBlocks(content) };
    }
    if (lower.includes("refill") && /last ordered/i.test(content)) {
      return { kind: "refill" as const, ...parseRefillBlocks(content) };
    }
    if (lastAssistant.productIds?.length || /• \*\*/.test(content)) {
      const parsed = parseProductBlocks(content);
      if (parsed.products.length > 0) return { kind: "product" as const, ...parsed };
    }
    return null;
  }, [lastAssistant]);

  /* ────────────── NOT LOGGED IN ────────────── */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-[oklch(0.985_0.005_170)]">
        <header className="h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-border/40 flex items-center px-4 sm:px-6">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-sm w-full text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.36_0.09_173)] text-white shadow-lg shadow-[oklch(0.45_0.12_170)]/20">
              <Bot className="size-7" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Kalyan Chemist AI</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-6 leading-relaxed">
              Sign in to chat with your personal pharmacy assistant for medicine search, order tracking, and more.
            </p>
            <Button
              className="gradient-primary text-white h-10 px-8 rounded-xl font-semibold shadow-sm"
              onClick={() => navigate("/auth?returnTo=/chatbot")}
            >
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  /* ────────────── MAIN UI ────────────── */
  return (
    <div className="h-screen flex flex-col bg-[oklch(0.985_0.005_170)] overflow-hidden">
      {/* ═══════ MINIMAL PREMIUM HEADER ═══════ */}
      <header className="h-14 shrink-0 bg-white/70 backdrop-blur-xl border-b border-border/30 flex items-center px-3 sm:px-6 gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
          title="Back"
        >
          <ChevronLeft className="size-4.5" />
        </Button>

        <div className="relative">
          <AiAvatar size="md" />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-[13px] font-bold text-foreground leading-tight tracking-tight">Kalyan Chemist AI</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {isTyping ? (
              <span className="text-[oklch(0.45_0.12_170)] font-medium">Thinking…</span>
            ) : (
              "Your personal pharmacy assistant"
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className={`h-8 w-8 p-0 rounded-lg ${ttsOn ? "text-[oklch(0.45_0.12_170)]" : "text-muted-foreground"} hover:text-foreground`}
            onClick={() => setTts(!ttsOn)}
            title={ttsOn ? "Mute voice" : "Enable voice"}
          >
            {ttsOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setShowHistory((s) => !s)}
            title="Chat history"
          >
            <History className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={handleNewChat}
            title="New conversation"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </header>

      {/* ═══════ HISTORY DRAWER ═══════ */}
      {showHistory && (
        <div className="absolute inset-0 z-40" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div
            className="absolute top-14 left-0 right-0 sm:right-auto sm:w-[340px] max-h-[70vh] bg-white border border-border/50 shadow-xl rounded-b-2xl sm:rounded-2xl sm:ml-3 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <p className="text-[12px] font-bold text-foreground">Conversations</p>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-0.5">
              {conversations && conversations.length === 0 && (
                <div className="text-center py-10 px-4">
                  <MessageSquare className="size-7 text-muted-foreground/30 mx-auto mb-2.5" />
                  <p className="text-[11px] text-muted-foreground">No conversations yet. Start chatting to see history here.</p>
                </div>
              )}
              {conversations?.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => {
                    setActiveConvId(conv._id);
                    setShowHistory(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl text-sm transition-all duration-150 group ${
                    activeConvId === conv._id
                      ? "bg-[oklch(0.45_0.12_170)]/[0.08] text-[oklch(0.45_0.12_170)] ring-1 ring-[oklch(0.45_0.12_170)]/15"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate flex-1 font-medium text-[12.5px]">{conv.title || "New conversation"}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conv._id);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleDelete(conv._id)}
                      className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="size-3" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground/70">{conv.messageCount} messages</span>
                    {conv.handoffRequested && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200/60">
                        Handoff
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ SCROLL AREA ═══════ */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">

          {/* ═══ WELCOME ═══ */}
          {showWelcome && (
            <div className="flex flex-col items-center text-center pt-[10vh] pb-8 animate-in fade-in duration-500">
              {/* Identity */}
              <div className="relative mb-5">
                <div className="flex size-[76px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.35_0.08_172)] text-white shadow-xl shadow-[oklch(0.45_0.12_170)]/20">
                  <Bot className="size-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-400 border-[3px] border-[oklch(0.985_0.005_170)] flex items-center justify-center">
                  <span className="size-1.5 rounded-full bg-white" />
                </span>
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.45_0.12_170)]/70 mb-3">
                Kalyan Chemist AI Assistant
              </p>

              <h1 className="text-[28px] sm:text-[32px] font-bold text-foreground tracking-tight leading-tight">
                Hello <span className="inline-block">👋</span>
              </h1>
              <p className="text-[15px] font-medium text-foreground/80 mt-1.5">
                How can I help you today?
              </p>
              <p className="text-[13px] text-muted-foreground mt-3 max-w-md leading-relaxed">
                Your Kalyan Chemist AI Assistant can help you find medicines, check availability, track orders,
                manage refills and connect you with our pharmacy team.
              </p>

              {/* Topic pills */}
              <div className="flex flex-wrap justify-center gap-2 w-full max-w-xl mt-8">
                {TOPIC_PILLS.map((pill) => (
                  <button
                    key={pill.label}
                    onClick={() => handleSend(pill.prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-3.5 py-2 text-[12px] font-medium text-foreground/85 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-[oklch(0.45_0.12_170)]/30 hover:text-[oklch(0.45_0.12_170)] hover:shadow-sm active:scale-[0.97]"
                  >
                    <pill.icon className="size-3.5 text-[oklch(0.45_0.12_170)]" />
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Proactive suggestions */}
              {proactiveSuggestions && proactiveSuggestions.length > 0 && (
                <div className="mt-8 w-full max-w-lg text-left">
                  <div className="flex items-center gap-1.5 mb-2.5 justify-center">
                    <Sparkles className="size-3 text-[oklch(0.45_0.12_170)]" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Suggested for you</p>
                  </div>
                  <div className="space-y-2">
                    {proactiveSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(sug.replace(/\*\*/g, ""))}
                        className="w-full p-3.5 rounded-xl bg-white border border-border/40 text-[13px] text-foreground/90 hover:border-[oklch(0.45_0.12_170)]/25 hover:shadow-sm transition-all text-left leading-relaxed"
                      >
                        {renderMarkdown(sug)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Try asking about */}
              <div className="mt-10 w-full text-left max-w-[720px]">
                <p className="text-[11px] text-muted-foreground/80 mb-2.5">Try asking about...</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
                  {TRY_ASKING.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="shrink-0 whitespace-nowrap rounded-full bg-white border border-border/50 px-3.5 py-2 text-[12px] text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-[oklch(0.45_0.12_170)]/30 hover:shadow-sm active:scale-[0.97]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-10 text-[10px] text-muted-foreground/50 font-medium tracking-wide uppercase">
                Powered by Kalyan Chemist
              </p>
            </div>
          )}

          {/* ═══ CONVERSATION ═══ */}
          {!showWelcome && (
            <div className="py-6 space-y-4">
              {messages?.map((msg: any, i: number) => {
                const isUser = msg.role === "user";
                const isAssistant = msg.role === "assistant";
                const isLast = i === messages.length - 1;
                const actionChips = isAssistant ? extractActionChips(msg.content) : [];
                const showStructured = isAssistant && isLast && structured && structured.kind !== null;

                /* Structured rendering for the latest assistant message */
                if (showStructured) {
                  const s = structured!;
                  return (
                    <div key={msg._id} className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <AiAvatar size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl rounded-tl-md bg-white border border-border/50 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                          {s.kind === "order" ? (
                            <>
                              {s.intro && <div>{renderMarkdown(s.intro)}</div>}
                              <OrderResultCards orders={s.orders} />
                              {s.outro && <div className="mt-2.5">{renderMarkdown(s.outro)}</div>}
                            </>
                          ) : s.kind === "refill" ? (
                            <>
                              {s.intro && <div>{renderMarkdown(s.intro)}</div>}
                              <RefillResultCards refills={s.refills} />
                              {s.outro && <div className="mt-2.5">{renderMarkdown(s.outro)}</div>}
                            </>
                          ) : (
                            <>
                              {s.intro && <div>{renderMarkdown(s.intro)}</div>}
                              <ProductResultCards products={s.products} />
                              {s.outro && <div className="mt-2.5">{renderMarkdown(s.outro)}</div>}
                            </>
                          )}

                          {/* Handoff badge */}
                          {msg.handoffTriggered && (
                            <div className="mt-3 pt-2.5 border-t border-border/30">
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/60">
                                <Phone className="size-3.5 text-amber-600 shrink-0" />
                                <span className="text-[11px] font-medium text-amber-700">Human support recommended</span>
                              </div>
                            </div>
                          )}

                          {/* Product browse action */}
                          {msg.productIds && msg.productIds.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-border/30">
                              <button
                                onClick={() => navigate("/products")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[oklch(0.45_0.12_170)]/[0.07] text-[oklch(0.45_0.12_170)] text-[11px] font-semibold hover:bg-[oklch(0.45_0.12_170)]/[0.14] transition-colors"
                              >
                                <ShoppingCart className="size-3" />
                                Browse Products
                                <ArrowRight className="size-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Contextual chips */}
                        {actionChips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pl-1">
                            {actionChips.map((chip) => (
                              <button
                                key={chip.label}
                                onClick={() => handleChipAction(chip.action)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-[oklch(0.45_0.12_170)] hover:border-[oklch(0.45_0.12_170)]/25 transition-all"
                              >
                                {chip.label}
                                <ArrowRight className="size-2.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                /* Default messages */
                return (
                  <div
                    key={msg._id}
                    className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    {isAssistant && <AiAvatar size="sm" />}

                    <div
                      className={`max-w-[82%] sm:max-w-[76%] ${
                        isUser
                          ? "bg-[oklch(0.45_0.12_170)] text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm shadow-[oklch(0.45_0.12_170)]/20"
                          : "bg-white border border-border/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      }`}
                    >
                      <div className={isUser ? "[&_strong]:text-white [&_a]:text-white/90 [&_span]:text-white/80" : ""}>
                        {renderMarkdown(msg.content)}
                      </div>

                      {isAssistant && msg.handoffTriggered && (
                        <div className="mt-3 pt-2.5 border-t border-border/30">
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/60">
                            <Phone className="size-3.5 text-amber-600 shrink-0" />
                            <span className="text-[11px] font-medium text-amber-700">Human support recommended</span>
                          </div>
                        </div>
                      )}

                      {isAssistant && msg.productIds && msg.productIds.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/30">
                          <button
                            onClick={() => navigate("/products")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[oklch(0.45_0.12_170)]/[0.07] text-[oklch(0.45_0.12_170)] text-[11px] font-semibold hover:bg-[oklch(0.45_0.12_170)]/[0.14] transition-colors"
                          >
                            <ShoppingCart className="size-3" />
                            Browse Products
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground/60 mt-0.5 text-[11px] font-bold">
                        {userInitial}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-2.5 animate-in fade-in duration-200">
                  <AiAvatar size="sm" />
                  <div className="bg-white border border-border/50 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-1">
                      <span className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/35 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/35 animate-bounce" style={{ animationDelay: "120ms" }} />
                      <span className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/35 animate-bounce" style={{ animationDelay: "240ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ═══════ PREMIUM INPUT AREA ═══════ */}
      <div className="shrink-0 bg-gradient-to-t from-[oklch(0.985_0.005_170)] via-[oklch(0.985_0.005_170)] to-transparent pt-2">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-3">
          {/* Language bar */}
          {showLangPicker && (
            <div className="flex items-center gap-1.5 mb-2.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
              <Languages className="size-3 text-muted-foreground shrink-0" />
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    const prompts: Record<string, string> = {
                      en: "Hello, I need help",
                      hi: "नमस्ते, मुझे मदद चाहिए",
                      mr: "नमस्कार, मला मदत हवी आहे",
                      hinglish: "Hello bhai, mujhe help chahiye",
                    };
                    handleSend(prompts[lang.code] || "Hello");
                    setShowLangPicker(false);
                  }}
                  className="text-[11px] font-medium text-muted-foreground hover:text-[oklch(0.45_0.12_170)] px-2.5 py-1 rounded-full border border-border/50 bg-white hover:border-[oklch(0.45_0.12_170)]/25 hover:bg-[oklch(0.45_0.12_170)]/[0.05] transition-all"
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}

          {/* Elevated input container */}
          <div className="bg-white border border-border/60 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] focus-within:border-[oklch(0.45_0.12_170)]/30 focus-within:shadow-[0_2px_16px_rgba(0,0,0,0.07)] focus-within:ring-2 focus-within:ring-[oklch(0.45_0.12_170)]/[0.08] transition-all duration-200">
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Plus / language quick toggle */}
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className={`flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200 ${
                  showLangPicker
                    ? "bg-[oklch(0.45_0.12_170)]/10 text-[oklch(0.45_0.12_170)]"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"
                }`}
                title="Language"
              >
                <Plus className="size-4.5" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Kalyan Chemist AI…"
                className="flex-1 bg-transparent text-[13.5px] outline-none placeholder-muted-foreground/55 min-w-0"
                disabled={isTyping}
              />

              {/* Voice */}
              {voiceSupported && (
                <button
                  onClick={toggleVoice}
                  className={`flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200 ${
                    isListening
                      ? "bg-red-500 text-white shadow-sm shadow-red-500/25 animate-pulse"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"
                  }`}
                  title="Voice input"
                >
                  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </button>
              )}

              {/* Send */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className={`flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200 ${
                  input.trim() && !isTyping
                    ? "bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.38_0.10_168)] text-white shadow-sm shadow-[oklch(0.45_0.12_170)]/25 hover:shadow-md active:scale-95"
                    : "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                }`}
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>

          <p className="text-center text-[9.5px] text-muted-foreground/40 mt-2 leading-relaxed">
            AI-powered assistant · For pharmacy information only · Not a substitute for medical advice
          </p>
        </div>
      </div>
    </div>
  );
}
