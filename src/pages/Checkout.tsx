import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Banknote,
  Loader2,
  Pill,
  Plus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Checkout() {
  const navigate = useNavigate();
  const cartItems = useQuery(api.cart.list);
  const addresses = useQuery(api.addresses.list);
  const defaultAddress = useQuery(api.addresses.getDefault);
  const createOrder = useMutation(api.orders.create);
  const createRazorpayOrder = useAction(api.razorpay.createOrder);
  const getRazorpayKeyId = useAction(api.razorpay.getKeyId);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [notes, setNotes] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);

  const [newAddr, setNewAddr] = useState({
    name: "", phone: "", addressLine1: "", addressLine2: "",
    city: "", state: "", pincode: "",
  });
  const createAddress = useMutation(api.addresses.create);

  useEffect(() => {
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress._id);
    }
  }, [defaultAddress, selectedAddressId]);

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      setSelectedAddressId(addresses[0]._id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (paymentMethod === "online") {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [paymentMethod]);

  if (cartItems === undefined || addresses === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (cartItems.length === 0) {
    navigate("/cart");
    return null;
  }

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId);

  const subtotal = cartItems.reduce((sum, item) => {
    if (!item.product) return sum;
    const price = item.product.discountPrice && item.product.discountPrice < item.product.price
      ? item.product.discountPrice : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const savings = cartItems.reduce((sum, item) => {
    if (!item.product) return sum;
    if (item.product.discountPrice && item.product.discountPrice < item.product.price) {
      return sum + (item.product.price - item.product.discountPrice) * item.quantity;
    }
    return sum;
  }, 0);

  const canPlaceOrder = selectedAddress && selectedAddress.phone && selectedAddress.phone.trim().length > 0 && !isPlacing;

  const handleSaveNewAddress = async () => {
    if (!newAddr.name || !newAddr.phone || !newAddr.addressLine1 || !newAddr.city || !newAddr.state || !newAddr.pincode) {
      toast.error("Please fill in all required address fields");
      return;
    }
    try {
      const result = await createAddress({
        ...newAddr,
        addressLine2: newAddr.addressLine2 || undefined,
        isDefault: addresses.length === 0,
      });
      setSelectedAddressId(result.addressId);
      setShowNewAddress(false);
      setNewAddr({ name: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "" });
      toast.success("Address saved");
    } catch (error) {
      toast.error("Could not save address", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error("Please select a delivery address");
      return;
    }
    if (!selectedAddress.phone || selectedAddress.phone.trim().length === 0) {
      toast.error("Phone number is required", {
        description: "Please add a phone number to your address",
      });
      return;
    }

    setIsPlacing(true);

    try {
      if (paymentMethod === "online") {
        const razorpayOrder = await createRazorpayOrder({
          amount: subtotal,
          receipt: `order_${Date.now()}`,
        });

        if ((razorpayOrder as any)._demo) {
          const result = await createOrder({
            shippingAddress: formatAddress(selectedAddress),
            phone: selectedAddress.phone,
            paymentMethod: "online",
            notes: notes || undefined,
            razorpayOrderId: razorpayOrder.id,
            razorpayPaymentId: `pay_demo_${Date.now()}`,
            razorpaySignature: `demo_sig_${Date.now()}`,
          });
          toast.success("Demo payment successful! Order placed.");
          navigate(`/orders/${result.orderId}`);
          return;
        }

        const keyId = await getRazorpayKeyId();

        const options = {
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: "Kalyan Chemist",
          description: `Order from Kalyan Chemist`,
          order_id: razorpayOrder.id,
          handler: async (response: any) => {
            try {
              const result = await createOrder({
                shippingAddress: formatAddress(selectedAddress),
                phone: selectedAddress.phone,
                paymentMethod: "online",
                notes: notes || undefined,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast.success("Payment successful! Order placed.");
              navigate(`/orders/${result.orderId}`);
            } catch {
              toast.error("Payment received but order creation failed. Please contact support.");
              navigate("/orders");
            }
          },
          prefill: {
            name: selectedAddress.name,
            contact: selectedAddress.phone,
          },
          theme: {
            color: "#0f766e",
          },
          modal: {
            ondismiss: () => {
              setIsPlacing(false);
              toast.info("Payment cancelled");
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      } else {
        const result = await createOrder({
          shippingAddress: formatAddress(selectedAddress),
          phone: selectedAddress.phone,
          paymentMethod: "cod",
          notes: notes || undefined,
        });
        toast.success("Order placed successfully!", {
          description: "Pay cash on delivery when your order arrives.",
        });
        navigate(`/orders/${result.orderId}`);
        return;
      }
    } catch (error) {
      toast.error("Could not place order", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsPlacing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 gap-1.5 text-sm text-muted-foreground rounded-xl"
            onClick={() => navigate("/cart")}
          >
            <ArrowLeft className="size-4" />
            Back to Cart
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <Sparkles className="size-3" />
              Checkout
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-8">
              Checkout
            </h1>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Address & Payment */}
            <div className="lg:col-span-2 space-y-6">
              {/* Address Selection */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
                <Card className="border-border/60 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="size-4" />
                      Delivery Address
                      {!selectedAddress && (
                        <Badge variant="destructive" className="text-[10px] ml-1">Required</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {addresses.length === 0 && !showNewAddress ? (
                      <div className="text-center py-6">
                        <AlertCircle className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          No delivery address found
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Add a delivery address to continue with your order.
                        </p>
                        <Button size="sm" onClick={() => setShowNewAddress(true)} className="rounded-xl">
                          <Plus className="mr-1.5 size-3.5" />
                          Add Address
                        </Button>
                      </div>
                    ) : (
                      <>
                        <RadioGroup
                          value={selectedAddressId ?? ""}
                          onValueChange={(val) => setSelectedAddressId(val)}
                          className="space-y-2"
                        >
                          {addresses.map((addr) => (
                            <label
                              key={addr._id}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                                selectedAddressId === addr._id
                                  ? "border-primary bg-primary/[0.03] shadow-sm"
                                  : "border-border/60 hover:border-border hover:bg-muted/30"
                              }`}
                            >
                              <RadioGroupItem value={addr._id} className="mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {addr.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {addr.phone}
                                  </span>
                                  {addr.isDefault && (
                                    <Badge variant="secondary" className="text-[10px] rounded-lg">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  {addr.addressLine1}
                                  {addr.addressLine2 && `, ${addr.addressLine2}`}
                                  <br />
                                  {addr.city}, {addr.state} — {addr.pincode}
                                </p>
                              </div>
                              {selectedAddressId === addr._id && (
                                <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                              )}
                            </label>
                          ))}
                        </RadioGroup>
                        {!showNewAddress && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl"
                            onClick={() => setShowNewAddress(true)}
                          >
                            <Plus className="mr-1 size-3" />
                            Add Another Address
                          </Button>
                        )}
                      </>
                    )}

                    {showNewAddress && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="border border-border/60 rounded-xl p-4 space-y-3 mt-3 bg-muted/20"
                      >
                        <h4 className="text-sm font-semibold">New Address</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Full Name *</Label>
                            <Input
                              value={newAddr.name}
                              onChange={(e) => setNewAddr({ ...newAddr, name: e.target.value })}
                              placeholder="Receiver's full name"
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Phone Number *</Label>
                            <Input
                              value={newAddr.phone}
                              onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                              placeholder="10-digit mobile number"
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Address Line 1 *</Label>
                          <Input
                            value={newAddr.addressLine1}
                            onChange={(e) => setNewAddr({ ...newAddr, addressLine1: e.target.value })}
                            placeholder="House/Flat No., Building, Street"
                            className="h-9 rounded-xl text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Landmark (Optional)</Label>
                          <Input
                            value={newAddr.addressLine2}
                            onChange={(e) => setNewAddr({ ...newAddr, addressLine2: e.target.value })}
                            placeholder="Near hospital, opposite park, etc."
                            className="h-9 rounded-xl text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">City *</Label>
                            <Input
                              value={newAddr.city}
                              onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                              placeholder="City"
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">State *</Label>
                            <Input
                              value={newAddr.state}
                              onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                              placeholder="State"
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Pincode *</Label>
                            <Input
                              value={newAddr.pincode}
                              onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })}
                              placeholder="6-digit pincode"
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveNewAddress} className="rounded-xl">
                            Save Address
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl"
                            onClick={() => setShowNewAddress(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Payment Method */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
                <Card className="border-border/60 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="size-4" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(val: "cod" | "online") => setPaymentMethod(val)}
                      className="space-y-2"
                    >
                      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        paymentMethod === "online" ? "border-primary bg-primary/[0.03] shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}>
                        <RadioGroupItem value="online" />
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <CreditCard className="size-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">Online Payment</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pay securely via UPI, credit/debit cards, or net banking
                          </p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        paymentMethod === "cod" ? "border-primary bg-primary/[0.03] shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}>
                        <RadioGroupItem value="cod" />
                        <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600 shrink-0">
                          <Banknote className="size-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">Cash on Delivery</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pay when your order arrives at your doorstep
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Order Notes */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
                <Card className="border-border/60 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Order Notes (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special delivery instructions, timing preferences, etc."
                      className="text-sm rounded-xl"
                      rows={2}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="sticky top-24 space-y-4"
              >
                <Card className="border-border/60 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {cartItems.map((item) => {
                        if (!item.product) return null;
                        const p = item.product;
                        const price = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
                        return (
                          <div key={item._id} className="flex items-center gap-2.5 text-xs">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.05]">
                              <Pill className="size-3.5 text-primary/30" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-muted-foreground">× {item.quantity}</p>
                            </div>
                            <span className="font-medium text-foreground shrink-0">
                              {formatCurrency(price * item.quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      {savings > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>You save</span>
                          <span className="font-medium">-{formatCurrency(savings)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium text-green-600">Free</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-base font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    </div>

                    {!selectedAddress && (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                        <AlertCircle className="size-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700">
                          Please add and select a delivery address to continue.
                        </p>
                      </div>
                    )}

                    <Button
                      size="lg"
                      className="w-full font-semibold rounded-xl gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.01] active:scale-[0.99]"
                      onClick={handlePlaceOrder}
                      disabled={!canPlaceOrder}
                    >
                      {isPlacing ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Processing…
                        </>
                      ) : paymentMethod === "online" ? (
                        `Pay ${formatCurrency(subtotal)}`
                      ) : (
                        `Place Order — ${formatCurrency(subtotal)}`
                      )}
                    </Button>

                    <p className="text-[10px] text-center text-muted-foreground">
                      By placing this order, you agree to our terms of service.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function formatAddress(addr: {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}): string {
  let line = addr.addressLine1;
  if (addr.addressLine2) line += `, ${addr.addressLine2}`;
  return `${addr.name}, ${line}, ${addr.city}, ${addr.state} — ${addr.pincode}`;
}
