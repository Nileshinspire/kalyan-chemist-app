import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  MessageCircle,
  Users,
  Handshake,
  Clock,
  Search,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
  BarChart3,
  Headphones,
} from "lucide-react";
import { motion } from "framer-motion";

export default function AdminChatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const analytics = useQuery(api.chatbot.getAdminAnalytics);

  if (!analytics) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">AI Chatbot Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading analytics…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Conversations",
      value: analytics.totalConversations,
      icon: MessageCircle,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Total Messages",
      value: analytics.totalMessages,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      label: "Human Handoffs",
      value: `${analytics.humanHandoffPercentage}%`,
      icon: Handshake,
      color: "text-amber-600",
      bg: "bg-amber-100",
      sub: `${analytics.handoffCount} conversations`,
    },
    {
      label: "Avg Response Time",
      value: `${analytics.avgResponseTimeMs}ms`,
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
          <Bot className="size-3" />
          AI Chatbot
        </div>
        <h1 className="text-2xl font-bold">AI Chatbot Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor chatbot performance, conversations, and customer interactions
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
          >
            <Card className="border-border/70">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex size-10 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.sub && <p className="text-[10px] text-muted-foreground">{stat.sub}</p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Top Intents ── */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Top Query Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topIntents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No queries yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.topIntents.map((intent, i) => {
                  const maxCount = analytics.topIntents[0]?.count || 1;
                  const pct = Math.round((intent.count / maxCount) * 100);
                  const intentLabels: Record<string, string> = {
                    product_search: "🔍 Product Search",
                    order_tracking: "📦 Order Tracking",
                    refill: "🔄 Refill",
                    navigation: "🧭 Navigation",
                    medical_question: "⚕️ Medical Question",
                    complaint: "⚠️ Complaint",
                    greeting: "👋 Greeting",
                    help: "❓ Help",
                    general: "💬 General",
                  };
                  return (
                    <div key={intent.intent}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {intentLabels[intent.intent] || intent.intent}
                        </span>
                        <span className="text-xs text-muted-foreground">{intent.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Most Searched Products ── */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="size-4 text-primary" />
              Most Searched Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.mostSearchedProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No searches yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.mostSearchedProducts.map((item, i) => (
                  <div
                    key={item.productName}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm">{item.productName}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.searchCount} searches
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Unavailable Products ── */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Searched but Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.unavailableSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No unavailable product searches
              </p>
            ) : (
              <div className="space-y-2">
                {analytics.unavailableSearches.map((item) => (
                  <div
                    key={item.productName}
                    className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <span className="text-sm">{item.productName}</span>
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                      Out of stock
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Conversations ── */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              Recent Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.recentConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No conversations yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.recentConversations.slice(0, 8).map((conv) => {
                  const date = new Date(conv.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={conv._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        conv.handoffRequested ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary"
                      }`}>
                        {conv.handoffRequested ? <Headphones className="size-4" /> : <Bot className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title || "New conversation"}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{conv.messageCount} messages</span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground">{date}</span>
                          {conv.language && conv.language !== "en" && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 h-4">
                              {conv.language.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {conv.handoffRequested && (
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                            Handoff
                          </Badge>
                        )}
                        {conv.sentiment === "frustrated" && (
                          <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200">
                            Frustrated
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Summary Footer ── */}
      <Card className="border-border/70 mt-6">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Chatbot Health Summary</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {analytics.totalConversations > 0
                  ? `The chatbot has handled ${analytics.totalConversations} conversations with ${analytics.totalMessages} messages. ` +
                    `${analytics.humanHandoffPercentage}% required human handoff. ` +
                    `Average response time is ${analytics.avgResponseTimeMs}ms.`
                  : "No chatbot activity yet. Conversations will appear here once customers start using the chatbot."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
