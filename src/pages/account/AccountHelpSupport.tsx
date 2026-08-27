import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  HelpCircle,
  Package,
  CreditCard,
  RotateCcw,
  ArrowUpRight,
  FileText,
} from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "How do I track my order?",
    answer:
      'Go to Account → My Orders or Account → Track Order to see your real-time order status, including processing, dispatch, and delivery updates.',
    icon: Package,
  },
  {
    question: "How do I return or exchange a product?",
    answer:
      "Contact our support team within 7 days of delivery with your order number and reason for return. We'll guide you through the process.",
    icon: RotateCcw,
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept UPI, credit/debit cards, net banking, wallets, and Cash on Delivery (COD) for eligible orders.",
    icon: CreditCard,
  },
  {
    question: "How do I upload a prescription?",
    answer:
      'Go to Account → Prescriptions and click "Upload Prescription". You can upload a photo or PDF of your valid prescription.',
    icon: FileText,
  },
];

export default function AccountHelpSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleWhatsApp = () => {
    const name = encodeURIComponent(user?.name || "Customer");
    const message = encodeURIComponent(
      `Hi Kalyan Chemist! I need help with my account. My name is ${name}.`
    );
    window.open(`https://wa.me/919876543210?text=${message}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We're here to help you with any questions or issues
        </p>
      </div>

      {/* Contact Options */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* WhatsApp */}
        <Card
          className="border-border/60 cursor-pointer hover:shadow-card-hover hover:border-green-200 transition-all group"
          onClick={handleWhatsApp}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                <MessageCircle className="size-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-green-600 transition-colors">
                  WhatsApp Support
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chat with us instantly on WhatsApp
                </p>
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  Start Chat
                  <ArrowUpRight className="size-3" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phone */}
        <Card className="border-border/60 cursor-pointer hover:shadow-card-hover hover:border-primary/20 transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Phone className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Call Us
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Speak with our support team directly
                </p>
                <p className="text-sm font-medium text-foreground mt-2">
                  +91 98765 43210
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="size-3" />
                  Mon – Sat, 8 AM – 10 PM
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card className="border-border/60 cursor-pointer hover:shadow-card-hover hover:border-primary/20 transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Mail className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Email Support
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send us an email anytime
                </p>
                <p className="text-sm font-medium text-foreground mt-2">
                  hello@kalyanchemist.in
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  We respond within 24 hours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visit Store */}
        <Card className="border-border/60 hover:shadow-card-hover hover:border-primary/20 transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <MapPin className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Visit Our Store
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Walk in for in-person assistance
                </p>
                <p className="text-sm font-medium text-foreground mt-2 leading-relaxed">
                  123 Health Street,
                  <br />
                  Mumbai, Maharashtra 400001
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="size-3" />
                  Mon – Sat, 8 AM – 10 PM
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="size-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((faq, i) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Card className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      <faq.icon className="size-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {faq.question}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-4 rounded-xl"
            onClick={() => navigate("/account/orders")}
          >
            <Package className="size-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">View My Orders</p>
              <p className="text-xs text-muted-foreground">
                Check order status and history
              </p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-4 rounded-xl"
            onClick={() => navigate("/account/prescriptions")}
          >
            <FileText className="size-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Upload Prescription</p>
              <p className="text-xs text-muted-foreground">
                Submit a new prescription
              </p>
            </div>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
