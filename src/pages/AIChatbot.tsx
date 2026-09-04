import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";
import {
  Send,
  Mic,
  MicOff,
  Plus,
  Trash2,
  ShoppingCart,
  Package,
  RefreshCw,
  HelpCircle,
  Bot,
  User,
  X,
  Volume2,
  VolumeX,
  ArrowRight,
  ChevronLeft,
  Languages,
  Pill,
  Search,
  ClipboardList,
  Stethoscope,
  ShieldCheck,
  Clock,
  MessageSquare,
  Sparkles,
  Phone,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

/* ────────────────────────────────────────────
   RENDERING HELPERS
   ──────────────────────────────────────────── */

/** Markdown-lite: bold, links, bullets, line breaks */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    // Bold **text**
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

    // Links [text](url)
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
            className="text-[oklch(0.45_0.12_170)] underline underline-offset-2 decoration-[oklch(0.45_0.12_170)]/40 hover:decoration-[oklch(0.45_0.12_170)] transition-colors"
          >
            {lm[1]}
          </a>,
        );
        li = lm.index + lm[0].length;
      }
      if (li < p.length) segs.push(p.slice(li));
      return segs.length ? segs : p;
    });

    // Bullet lines
    if (line.trim().startsWith("• ") || line.trim().startsWith("- ")) {
      const content = line.trim().startsWith("• ") ? line.trim().slice(2) : line.trim().slice(2);
      elements.push(
        <div key={`li-${idx}`} className="flex gap-2 ml-0.5 py-[1px]">
          <span className="text-[oklch(0.45_0.12_170)] mt-px shrink-0 text-xs">●</span>
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

/* ────────────────────────────────────────────
   SMART ACTION CHIPS (after assistant messages)
   ──────────────────────────────────────────── */

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
  if (lower.includes("browse our catalogue")) {
    chips.push({ label: "Browse Medicines", action: "navigate:/products" });
  }
  if (lower.includes("upload") && lower.includes("prescription")) {
    chips.push({ label: "Upload Prescription", action: "navigate:/upload-prescription" });
  }
  return chips.slice(0, 3);
}

/* ────────────────────────────────────────────
   STARTER ACTIONS
   ──────────────────────────────────────────── */

const STARTER_ACTIONS = [
  {
    icon: Search,
    label: "Search Medicine",
    subtitle: "Find any medicine or product",
    prompt: "I want to search for medicines",
    color: "from-blue-500/10 to-blue-600/5",
    iconColor: "text-blue-600",
  },
  {
    icon: ClipboardList,
    label: "Track My Order",
    subtitle: "Check order status & delivery",
    prompt: "Where is my order?",
    color: "from-emerald-500/10 to-emerald-600/5",
    iconColor: "text-emerald-600",
  },
  {
    icon: RefreshCw,
    label: "Refill Medicine",
    subtitle: "Reorder your regular medicines",
    prompt: "I want to refill my medicines",
    color: "from-violet-500/10 to-violet-600/5",
    iconColor: "text-violet-600",
  },
  {
    icon: Pill,
    label: "Check Availability",
    subtitle: "Is a product in stock?",
    prompt: "Is this product available in stock?",
    color: "from-amber-500/10 to-amber-600/5",
    iconColor: "text-amber-600",
  },
  {
    icon: HelpCircle,
    label: "Help & Support",
    subtitle: "Get help with the website",
    prompt: "What can you help me with?",
    color: "from-rose-500/10 to-rose-600/5",
    iconColor: "text-rose-600",
  },
  {
    icon: Stethoscope,
    label: "Talk to Pharmacist",
    subtitle: "Connect with our pharmacy team",
    prompt: "Connect me with a pharmacist",
    color: "from-teal-500/10 to-teal-600/5",
    iconColor: "text-teal-600",
  },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "hinglish", label: "Hinglish" },
];

/* ────────────────────────────────────────────
   HOOKS
   ──────────────────────────────────────────── */

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

/* ────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────── */

export default function AIChatbot() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const conversations = useQuery(api.chatbot.getConversations);
  const createConversation = useMutation(api.chatbot.createConversation);
  const sendMessage = useMutation(api.chatbot.sendMessage);
  const deleteConversation = useMutation(api.chatbot.deleteConversation);
  const proactiveSuggestions = useQuery(api.chatbot.getProactiveSuggestions);

  const [activeConvId, setActiveConvId] = useState<Id<"chatbot_conversations"> | null>(null);
  const messages = useQuery(
    activeConvId ? api.chatbot.getMessages : ("skip" as any),
    activeConvId ? { conversationId: activeConvId } : ("skip" as any),
  );

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        const result = await sendMessage({ conversationId: convId, content: msg });
        if (result.handoffTriggered) toast.info("Connecting you with a pharmacist…");
      } catch (err: any) {
        toast.error(err.message || "Failed to send message");
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [input, activeConvId, isTyping, createConversation, sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setShowSidebar(false);
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

  /* ── Conversation metadata ── */
  const activeConv = activeConvId && conversations ? conversations.find((c) => c._id === activeConvId) : null;
  const hasMessages = messages && messages.length > 0;
  const showWelcome = !activeConvId && !hasMessages;

  /* ────────────── NOT LOGGED IN ────────────── */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-sm w-full text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-[oklch(0.96_0.03_170)] border border-[oklch(0.45_0.12_170)]/10">
              <Bot className="size-7 text-[oklch(0.45_0.12_170)]" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Kalyan Chemist AI</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-6 leading-relaxed">
              Sign in to chat with your personal pharmacy assistant for medicine search, order tracking, and more.
            </p>
            <Button className="gradient-primary text-white h-10 px-8 rounded-xl font-semibold" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  /* ────────────── MAIN UI ────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* ═══════ SIDEBAR ═══════ */}
        <aside
          className={`
            ${showSidebar ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0
            fixed lg:static inset-y-0 left-0 z-40
            w-72 lg:w-[300px] bg-white border-r border-border/50
            flex flex-col transition-transform duration-200 ease-out
            top-[64px] lg:top-0
          `}
        >
          {/* Sidebar header */}
          <div className="p-4 border-b border-border/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[oklch(0.45_0.12_170)] text-white">
                  <Bot className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Assistant</h2>
                  <p className="text-[10px] text-muted-foreground">Conversation history</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg hover:bg-[oklch(0.45_0.12_170)]/5 text-muted-foreground"
                onClick={handleNewChat}
                title="New Chat"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations && conversations.length === 0 && (
              <div className="text-center py-12 px-4">
                <MessageSquare className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No conversations yet.
                  <br />
                  Start chatting to see history here.
                </p>
              </div>
            )}
            {conversations?.map((conv) => (
              <button
                key={conv._id}
                onClick={() => {
                  setActiveConvId(conv._id);
                  setShowSidebar(false);
                }}
                className={`
                  w-full text-left p-3 rounded-xl text-sm transition-all duration-150 group
                  ${activeConvId === conv._id
                    ? "bg-[oklch(0.45_0.12_170)]/8 text-[oklch(0.45_0.12_170)] ring-1 ring-[oklch(0.45_0.12_170)]/15"
                    : "text-muted-foreground hover:bg-muted/60"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate flex-1 font-medium text-[13px]">{conv.title || "New conversation"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conv._id);
                    }}
                    className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
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

          {/* Sidebar footer */}
          <div className="p-3 border-t border-border/40">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[oklch(0.45_0.12_170)]/[0.03]">
              <ShieldCheck className="size-3.5 text-[oklch(0.45_0.12_170)] shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Protected by Kalyan Chemist AI safety guidelines
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {showSidebar && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden top-[64px] backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
        )}

        {/* ═══════ MAIN CHAT ═══════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-[oklch(0.985_0.005_170)]">
          {/* ── Header ── */}
          <div className="h-[60px] shrink-0 bg-white/80 backdrop-blur-md border-b border-border/40 flex items-center px-4 gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg lg:hidden text-muted-foreground"
              onClick={() => setShowSidebar(true)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.38_0.10_168)] text-white shadow-sm">
              <Bot className="size-[18px]" />
              <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-bold text-foreground leading-tight">Kalyan Chemist AI</h3>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
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
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setTts(!ttsOn)}
                title={ttsOn ? "Mute voice" : "Enable voice"}
              >
                {ttsOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
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
          </div>

          {/* ── Messages Area ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-6 space-y-5">

              {/* ═══ WELCOME SCREEN ═══ */}
              {showWelcome && (
                <div className="flex flex-col items-center pt-8 sm:pt-16 text-center">
                  {/* AI Avatar */}
                  <div className="relative mb-5">
                    <div className="flex size-[72px] items-center justify-center rounded-[22px] bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.35_0.08_172)] text-white shadow-lg shadow-[oklch(0.45_0.12_170)]/15">
                      <Bot className="size-8" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-400 border-[3px] border-[oklch(0.985_0.005_170)] flex items-center justify-center">
                      <div className="size-1.5 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* Welcome text */}
                  <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
                    Hello! 👋
                  </h1>
                  <p className="text-[15px] text-muted-foreground mt-2 max-w-md leading-relaxed">
                    I can help you find medicines, check availability, track orders, manage refills, and connect you with our pharmacy team.
                  </p>

                  {/* Starter actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-lg mt-8">
                    {STARTER_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleSend(action.prompt)}
                        className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-white hover:border-[oklch(0.45_0.12_170)]/20 hover:shadow-md hover:shadow-[oklch(0.45_0.12_170)]/5 transition-all duration-200 text-center"
                      >
                        <div className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} ${action.iconColor} group-hover:scale-105 transition-transform duration-200`}>
                          <action.icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{action.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{action.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Proactive suggestions */}
                  {proactiveSuggestions && proactiveSuggestions.length > 0 && (
                    <div className="mt-8 w-full max-w-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="size-3.5 text-[oklch(0.45_0.12_170)]" />
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suggested for you</p>
                      </div>
                      <div className="space-y-2">
                        {proactiveSuggestions.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(sug.replace(/\*\*/g, ""))}
                            className="w-full text-left p-3.5 rounded-xl bg-white border border-border/40 text-[13px] text-foreground hover:border-[oklch(0.45_0.12_170)]/20 hover:shadow-sm transition-all leading-relaxed"
                          >
                            {renderMarkdown(sug)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trust line */}
                  <p className="mt-10 text-[10px] text-muted-foreground/50 font-medium tracking-wide uppercase">
                    Powered by Kalyan Chemist
                  </p>
                </div>
              )}

              {/* ═══ CHAT MESSAGES ═══ */}
              {!showWelcome &&
                messages?.map((msg: any, i: number) => {
                  const isUser = msg.role === "user";
                  const isAssistant = msg.role === "assistant";
                  const actionChips = isAssistant ? extractActionChips(msg.content) : [];

                  return (
                    <div key={msg._id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      {/* Assistant avatar */}
                      {isAssistant && (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.38_0.10_168)] text-white mt-0.5 shadow-sm">
                          <Bot className="size-4" />
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`
                          max-w-[80%] sm:max-w-[75%] text-[13px]
                          ${isUser
                            ? "bg-[oklch(0.45_0.12_170)] text-white rounded-2xl rounded-br-lg px-4 py-3 shadow-sm"
                            : "bg-white border border-border/50 rounded-2xl rounded-bl-lg px-4 py-3 shadow-sm"
                          }
                        `}
                      >
                        <div className={isAssistant ? "space-y-0.5" : ""}>
                          {renderMarkdown(msg.content)}
                        </div>

                        {/* Handoff badge */}
                        {isAssistant && msg.handoffTriggered && (
                          <div className="mt-3 pt-2.5 border-t border-border/30">
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/60">
                              <Phone className="size-3.5 text-amber-600 shrink-0" />
                              <span className="text-[11px] font-medium text-amber-700">Human support recommended</span>
                            </div>
                          </div>
                        )}

                        {/* Product results → browse button */}
                        {isAssistant && msg.productIds && msg.productIds.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-border/30">
                            <button
                              onClick={() => navigate("/products")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[oklch(0.45_0.12_170)]/8 text-[oklch(0.45_0.12_170)] text-[11px] font-semibold hover:bg-[oklch(0.45_0.12_170)]/15 transition-colors"
                            >
                              <ShoppingCart className="size-3" />
                              Browse Products
                              <ArrowRight className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* User avatar */}
                      {isUser && (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground/60 mt-0.5">
                          <User className="size-4" />
                        </div>
                      )}

                      {/* Action chips after assistant messages */}
                      {isAssistant && actionChips.length > 0 && i === (messages?.length ?? 0) - 1 && (
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5 mt-1.5 ml-0">
                            {actionChips.map((chip) => (
                              <button
                                key={chip.label}
                                onClick={() => handleChipAction(chip.action)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-border/50 text-[11px] font-medium text-muted-foreground hover:text-[oklch(0.45_0.12_170)] hover:border-[oklch(0.45_0.12_170)]/20 transition-all"
                              >
                                {chip.label}
                                <ArrowRight className="size-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* ═══ TYPING INDICATOR ═══ */}
              {isTyping && (
                <div className="flex gap-2.5 animate-in fade-in duration-200">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.38_0.10_168)] text-white shadow-sm">
                    <Bot className="size-4" />
                  </div>
                  <div className="bg-white border border-border/50 rounded-2xl rounded-bl-lg px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/40 animate-bounce" style={{ animationDelay: "120ms" }} />
                      <div className="size-[6px] rounded-full bg-[oklch(0.45_0.12_170)]/40 animate-bounce" style={{ animationDelay: "240ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input Area ── */}
          <div className="shrink-0 bg-white/80 backdrop-blur-md border-t border-border/40">
            <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-3">
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
                      className="text-[11px] font-medium text-muted-foreground hover:text-[oklch(0.45_0.12_170)] px-2.5 py-1 rounded-full border border-border/50 hover:border-[oklch(0.45_0.12_170)]/25 hover:bg-[oklch(0.45_0.12_170)]/5 transition-all"
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2 bg-[oklch(0.985_0.005_170)] border border-border/60 rounded-2xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-[oklch(0.45_0.12_170)]/15 focus-within:border-[oklch(0.45_0.12_170)]/30 transition-all duration-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about medicines, orders, refills…"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder-muted-foreground/60 min-w-0"
                  disabled={isTyping}
                />

                {/* Voice */}
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    className={`
                      flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200
                      ${isListening
                        ? "bg-red-500 text-white shadow-sm shadow-red-500/25 animate-pulse"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }
                    `}
                    title="Voice input"
                  >
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                )}

                {/* Language toggle */}
                <button
                  onClick={() => setShowLangPicker(!showLangPicker)}
                  className={`
                    flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200
                    ${showLangPicker
                      ? "bg-[oklch(0.45_0.12_170)]/10 text-[oklch(0.45_0.12_170)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }
                  `}
                  title="Change language"
                >
                  <Languages className="size-4" />
                </button>

                {/* Send */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className={`
                    flex size-8 items-center justify-center rounded-xl shrink-0 transition-all duration-200
                    ${input.trim() && !isTyping
                      ? "bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.38_0.10_168)] text-white shadow-sm shadow-[oklch(0.45_0.12_170)]/20 hover:shadow-md hover:shadow-[oklch(0.45_0.12_170)]/25 active:scale-95"
                      : "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                    }
                  `}
                >
                  <Send className="size-4" />
                </button>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-[10px] text-muted-foreground/40 mt-2 leading-relaxed">
                AI-powered assistant · For pharmacy information only · Not a substitute for medical advice
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
