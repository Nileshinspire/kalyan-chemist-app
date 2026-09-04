import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  Mic,
  MicOff,
  Image,
  Plus,
  Trash2,
  Phone,
  ExternalLink,
  ShoppingCart,
  Package,
  RefreshCw,
  Navigation,
  HelpCircle,
  Bot,
  User,
  X,
  Volume2,
  VolumeX,
  ArrowRight,
  ChevronLeft,
  Languages,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Markdown-lite renderer (bold, links, lists) ───
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    // Bold text
    let processed: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        processed.push(line.slice(lastIndex, match.index));
      }
      processed.push(<strong key={`b-${idx}-${match.index}`} className="font-semibold">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      processed.push(line.slice(lastIndex));
    }
    if (processed.length === 0) processed.push(line);

    // Links [text](url)
    processed = processed.map((p, pi) => {
      if (typeof p !== "string") return p;
      const linkRegex = /\[(.+?)\]\((.+?)\)/g;
      const parts: React.ReactNode[] = [];
      let lLastIndex = 0;
      let lMatch;
      while ((lMatch = linkRegex.exec(p)) !== null) {
        if (lMatch.index > lLastIndex) {
          parts.push(p.slice(lLastIndex, lMatch.index));
        }
        parts.push(
          <a
            key={`link-${idx}-${pi}-${lMatch.index}`}
            href={lMatch[2]}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {lMatch[1]}
          </a>
        );
        lLastIndex = lMatch.index + lMatch[0].length;
      }
      if (lLastIndex < p.length) parts.push(p.slice(lLastIndex));
      return parts.length > 0 ? parts : p;
    });

    // Bullet points
    if (line.trim().startsWith("• ") || line.trim().startsWith("- ")) {
      elements.push(
        <div key={`li-${idx}`} className="flex gap-2 ml-1">
          <span className="text-primary mt-0.5 shrink-0">•</span>
          <span>{processed.length === 1 && typeof processed[0] === "string" ? processed[0].slice(2) : processed}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`br-${idx}`} className="h-2" />);
    } else {
      elements.push(<div key={`p-${idx}`}>{processed}</div>);
    }
  });

  return <>{elements}</>;
}

// ─── Quick suggestion chips ───
const SUGGESTIONS = [
  { icon: ShoppingCart, text: "Search medicines", prompt: "I want to search for medicines" },
  { icon: Package, text: "Track my order", prompt: "Where is my order?" },
  { icon: RefreshCw, text: "Refill medicines", prompt: "I want to refill my medicines" },
  { icon: HelpCircle, text: "Get help", prompt: "What can you help me with?" },
];

// ─── Language options ───
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "hinglish", label: "Hinglish" },
];

// ─── Voice recording hook ───
function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, isSupported, toggleListening };
}

// ─── Text-to-speech hook ───
function useTextToSpeech() {
  const [enabled, setEnabled] = useState(false);

  const speak = useCallback((text: string) => {
    if (!enabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/\[.+?\]\(.+?\)/g, "").replace(/[•\-\n]+/g, ". ");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [enabled]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return { enabled, setEnabled, speak };
}

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
    activeConvId ? api.chatbot.getMessages : "skip" as any,
    activeConvId ? { conversationId: activeConvId } : "skip" as any
  );

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput(
    (text) => setInput(text)
  );
  const { enabled: ttsEnabled, setEnabled: setTtsEnabled, speak } = useTextToSpeech();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speak latest assistant message
  useEffect(() => {
    if (messages && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant") {
        speak(last.content);
      }
    }
  }, [messages?.length]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    setInput("");

    let convId = activeConvId;

    // Create new conversation if needed
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
      const result = await sendMessage({
        conversationId: convId,
        content: msg,
      });

      if (result.handoffTriggered) {
        toast.info("Connecting you with our support team…");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }, [input, activeConvId, isTyping, createConversation, sendMessage]);

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

  const handleDeleteConversation = async (convId: Id<"chatbot_conversations">) => {
    try {
      await deleteConversation({ conversationId: convId });
      if (activeConvId === convId) setActiveConvId(null);
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  const handleSelectConversation = (convId: Id<"chatbot_conversations">) => {
    setActiveConvId(convId);
    setShowSidebar(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center">
            <Bot className="size-12 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">AI Chatbot</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to chat with our AI assistant for medicine search, order tracking, and support.
            </p>
            <Button className="gradient-primary text-white" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const activeConversation = activeConvId && conversations
    ? conversations.find((c) => c._id === activeConvId)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* ── Sidebar: Conversation History ── */}
        <aside
          className={`
            ${showSidebar ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0
            fixed lg:static inset-y-0 left-0 z-40
            w-72 lg:w-80 bg-card border-r border-border/40
            flex flex-col transition-transform duration-200
            top-[64px] lg:top-0
          `}
        >
          <div className="p-3 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-sm font-bold">Conversations</h2>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={handleNewChat}
                title="New Chat"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg lg:hidden"
                onClick={() => setShowSidebar(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations && conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                No conversations yet. Start chatting!
              </p>
            )}
            {conversations?.map((conv) => (
              <button
                key={conv._id}
                onClick={() => handleSelectConversation(conv._id)}
                className={`
                  w-full text-left p-3 rounded-xl text-sm transition-all
                  ${activeConvId === conv._id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate flex-1">{conv.title || "New conversation"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv._id);
                    }}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]">{conv.messageCount} messages</span>
                  {conv.handoffRequested && (
                    <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4">Handoff</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {showSidebar && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden top-[64px]"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* ── Main Chat Area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="h-14 shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-sm flex items-center px-4 gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg lg:hidden"
              onClick={() => setShowSidebar(true)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate">
                {activeConversation?.title || "Kalyan Chemist Assistant"}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {isTyping ? "Typing…" : "Online"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setTtsEnabled(!ttsEnabled)}
                title={ttsEnabled ? "Disable voice output" : "Enable voice output"}
              >
                {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={handleNewChat}
                title="New Chat"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Welcome screen / empty state */}
              {!activeConvId && (!messages || messages.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                    <Bot className="size-8" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Kalyan Chemist Assistant</h2>
                  <p className="text-sm text-muted-foreground max-w-md mb-8">
                    I can help you search medicines, track orders, set up refills, and navigate the website.
                    For medical advice, I'll connect you with our pharmacist.
                  </p>

                  {/* Quick suggestions */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {SUGGESTIONS.map((sug) => (
                      <button
                        key={sug.text}
                        onClick={() => handleSend(sug.prompt)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-accent/40 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <sug.icon className="size-4" />
                        </div>
                        <span className="text-sm font-medium">{sug.text}</span>
                      </button>
                    ))}
                  </div>

                  {/* Proactive suggestions */}
                  {proactiveSuggestions && proactiveSuggestions.length > 0 && (
                    <div className="mt-6 w-full max-w-md">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Suggestions for you:</p>
                      <div className="space-y-2">
                        {proactiveSuggestions.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(sug.replace(/\*\*/g, ""))}
                            className="w-full text-left p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm hover:bg-primary/10 transition-colors"
                          >
                            {renderMarkdown(sug)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat messages */}
              {messages?.map((msg: any, i: number) => (
                <div
                  key={msg._id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-1">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={`
                      max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                      ${msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border/60 rounded-bl-md"
                      }
                    `}
                  >
                    <div className={msg.role === "user" ? "" : "space-y-1"}>
                      {renderMarkdown(msg.content)}
                    </div>
                    {msg.handoffTriggered && msg.role === "assistant" && (
                      <div className="mt-3 pt-2 border-t border-border/40">
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                          🤝 Human support recommended
                        </Badge>
                      </div>
                    )}
                    {msg.productIds && msg.productIds.length > 0 && msg.role === "assistant" && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => navigate("/products")}
                        >
                          <ShoppingCart className="size-3" />
                          Browse Products
                          <ArrowRight className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground mt-1">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </div>
                  <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input area ── */}
          <div className="shrink-0 border-t border-border/40 bg-card/60 backdrop-blur-sm p-3">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 bg-background border border-border/60 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about medicines, orders, refills…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder-muted-foreground"
                  disabled={isTyping}
                />

                {/* Voice input */}
                {voiceSupported && (
                  <Button
                    size="sm"
                    variant={isListening ? "default" : "ghost"}
                    className={`h-8 w-8 p-0 rounded-lg shrink-0 ${isListening ? "bg-red-500 text-white animate-pulse" : ""}`}
                    onClick={toggleListening}
                    title="Voice input"
                  >
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                )}

                {/* Send button */}
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg shrink-0 gradient-primary text-white"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                >
                  <Send className="size-4" />
                </Button>
              </div>

              {/* Language chips */}
              <div className="flex items-center gap-2 mt-2 px-1">
                <Languages className="size-3 text-muted-foreground" />
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
                    }}
                    className="text-[10px] font-medium text-muted-foreground hover:text-primary px-2 py-0.5 rounded-full border border-border/40 hover:border-primary/30 transition-colors"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
