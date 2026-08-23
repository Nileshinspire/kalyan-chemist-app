import { useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  FileText,
  CheckCircle2,
  CreditCard,
  Truck,
  Pill,
  ShieldCheck,
  Loader2,
  PlusCircle,
  AlertTriangle,
  IndianRupee,
  Check,
  Lock,
  Tag,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { geocodeAddress } from "@/lib/geocode";
import { toast } from "sonner";
import { CheckCircle2 as CheckCircle, XCircle } from "lucide-react";
import type { RazorpayResponse } from "@/types/global";

const STEPS = [
  { id: "address", label: "Address", icon: MapPin },
  { id: "prescription", label: "Prescription", icon: FileText },
  { id: "summary", label: "Summary", icon: CheckCircle2 },
  { id: "payment", label: "Payment", icon: CreditCard },
];

function addressToString(addr: any): string {
  const parts = [
    addr.fullName,
    addr.houseFlat,
    addr.building,
    addr.street,
    addr.area,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);

  const [searchParams] = useSearchParams();
  const buyNowProductId = searchParams.get("buyNow");
  const isBuyNow = !!buyNowProductId;

  const buyNowProduct = useQuery(
    api.products.getById,
    isBuyNow && buyNowProductId ? { productId: buyNowProductId as any } : "skip"
  );

  const cartItemsRaw = useQuery(api.cart.list);
  // In buyNow mode, create a synthetic cart item from the product
  const cartItems = useMemo(() => {
    if (isBuyNow && buyNowProduct) {
      return [{ _id: "buynow" as any, productId: buyNowProduct._id, quantity: 1, product: buyNowProduct }];
    }
    return cartItemsRaw;
  }, [isBuyNow, buyNowProduct, cartItemsRaw]);

  const addresses = useQuery(api.addresses.list);
  const prescriptions = useQuery(api.prescriptions.list);
  const validateRx = useQuery(api.prescriptionValidation.validateCartPrescription);
  const createOrder = useMutation(api.orders.create);
  const createDirectOrder = useMutation(api.orders.createDirectOrder);
  const createRazorpayOrder = useAction(api.razorpayActions.createOrder);
  const verifyPayment = useAction(api.razorpayActions.verifyPayment);
  const getRazorpayKeyId = useAction(api.razorpayActions.getKeyId);
  const markPaymentFailed = useMutation(api.razorpay.markPaymentFailed);

  // Calculate totals
  const { subtotal, totalDiscount, deliveryFee, tax, total, totalItems, hasRxItems } = useMemo(() => {
    if (!cartItems) return { subtotal: 0, totalDiscount: 0, deliveryFee: 0, tax: 0, total: 0, totalItems: 0, hasRxItems: false };

    let sub = 0;
    let disc = 0;
    let rx = false;
    for (const item of cartItems) {
      const p = item.product;
      if (!p) continue;
      if (p.prescriptionRequired) rx = true;
      const unitPrice = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
      sub += unitPrice * item.quantity;
      disc += (p.price - unitPrice) * item.quantity;
    }
    const delivery = sub >= 500 ? 0 : 49;
    const taxAmount = Math.round(sub * 0.12);
    return {
      subtotal: sub,
      totalDiscount: disc,
      deliveryFee: delivery,
      tax: taxAmount,
      total: sub + delivery + taxAmount,
      totalItems: cartItems.reduce((s, i) => s + i.quantity, 0),
      hasRxItems: rx,
    };
  }, [cartItems]);

  // Final total with coupon discount
  const finalTotal = useMemo(() => {
    return Math.max(0, total - (appliedCoupon?.discount || 0));
  }, [total, appliedCoupon]);

  const selectedAddress = addresses?.find((a: any) => a._id === selectedAddressId);

  // Extract pincode from selected address for serviceability check
  const pincodeFromAddr = selectedAddress?.pincode || "";
  const pincodeCheck = useQuery(
    api.deliveryConfig.checkPincode,
    pincodeFromAddr && pincodeFromAddr.length === 6 ? { pincode: pincodeFromAddr } : "skip"
  );

  // Coupon validation query (only run when coupon code entered and subtotal known)
  const couponValidation = useQuery(
    api.coupons.computeDiscount,
    couponCode.trim().length >= 3 && subtotal > 0
      ? { code: couponCode.trim(), subtotal }
      : "skip"
  );

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (couponValidation && couponValidation.valid) {
      setAppliedCoupon({
        code: couponValidation.code || "",
        discount: couponValidation.discount || 0,
        message: couponValidation.message || "Coupon applied",
      });
      toast.success(couponValidation.message || "Coupon applied");
    } else if (couponValidation && !couponValidation.valid) {
      toast.error(couponValidation.reason || "Invalid coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  // Auto-select default address
  if (addresses && addresses.length > 0 && !selectedAddressId) {
    const defaultAddr = addresses.find((a: any) => a.isDefault);
    if (defaultAddr) setSelectedAddressId(defaultAddr._id);
    else setSelectedAddressId(addresses[0]._id);
  }

  // Redirect if cart empty (skip for buyNow mode)
  if (!isBuyNow && cartItemsRaw && cartItemsRaw.length === 0 && step === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Pill className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mt-2">Add items to your cart before checkout.</p>
          <Button className="mt-4 gradient-primary text-white" onClick={() => navigate("/products")}>Browse Medicines</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!selectedAddressId;
      case 1: return !hasRxItems || !!selectedPrescriptionId;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  // ── Open Razorpay checkout widget ──
  const openRazorpayCheckout = useCallback(async (orderId: string, invoiceNumber: string, amount: number) => {
    setPaymentProcessing(true);
    try {
      // 1. Create a Razorpay order on the backend
      const rpOrder = await createRazorpayOrder({
        amount,
        receipt: invoiceNumber,
      });

      // 2. Build Razorpay options
      const razorpayKeyId = rpOrder._demo ? "rzp_test_demo" : await getRazorpayKeyId();

      const options: any = {
        key: razorpayKeyId,
        amount: rpOrder.amount, // already in paise
        currency: rpOrder.currency || "INR",
        name: "Kalyan Chemist",
        description: `Order ${invoiceNumber}`,
        order_id: rpOrder.id,
        handler: async (response: RazorpayResponse) => {
          // Payment successful — verify server-side
          try {
            await verifyPayment({
              orderId: orderId as any,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment verified! Order confirmed.");
            setPaymentProcessing(false);
            navigate(`/orders/${orderId}`);
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed. Please contact support.");
            setPaymentProcessing(false);
            navigate(`/orders/${orderId}`);
          }
        },
        prefill: {
          name: user?.name || "",
          contact: selectedAddress?.phone || "",
        },
        notes: {
          order_id: orderId,
        },
        theme: {
          color: "#059669", // Kalyan Chemist brand green
        },
        modal: {
          confirm_close: true,
          escape: false,
          ondismiss: async () => {
            // User closed/cancelled the Razorpay modal
            setPaymentProcessing(false);
            toast.info("Payment was not completed. You can retry from your order.");
            navigate(`/orders/${orderId}`);
          },
        },
      };

      // 3. Open the Razorpay widget
      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", async (response: any) => {
          // Payment failed — mark on backend so order isn't left in limbo
          try {
            await markPaymentFailed({
              orderId: orderId as any,
              reason: response?.error?.description || "Payment failed",
            });
          } catch {
            // Non-critical — order stays pending
          }
          setPaymentProcessing(false);
          const desc = response?.error?.description || "Payment failed";
          toast.error(`${desc}. You can retry from your order.`);
          navigate(`/orders/${orderId}`);
        });
        rzp.open();
      } else {
        // Fallback: Razorpay script not loaded
        // In demo mode, treat as successful
        if (rpOrder._demo) {
          toast.success("Demo mode: Payment simulated successfully.");
          setPaymentProcessing(false);
          navigate(`/orders/${orderId}`);
        } else {
          throw new Error("Razorpay not loaded. Please refresh and try again.");
        }
      }
    } catch (err: any) {
      setPaymentProcessing(false);
      toast.error(err.message || "Failed to initiate payment");
    }
  }, [createRazorpayOrder, verifyPayment, getRazorpayKeyId, markPaymentFailed, navigate, user, selectedAddress]);

  // ── Place Order ──
  const handlePlaceOrder = async () => {
    if (!selectedAddress || !selectedAddressId) {
      toast.error("Please select a delivery address");
      return;
    }
    setPlacing(true);
    try {
      // Auto-geocode the delivery address if no coordinates are stored yet
      let deliveryLatitude = selectedAddress.latitude ?? undefined;
      let deliveryLongitude = selectedAddress.longitude ?? undefined;
      if (!deliveryLatitude || !deliveryLongitude) {
        const geo = await geocodeAddress(addressToString(selectedAddress));
        if (geo) {
          deliveryLatitude = geo.latitude;
          deliveryLongitude = geo.longitude;
        }
      }

      // Create order — use direct order for Buy Now, cart-based for normal flow
      let result;
      if (isBuyNow && buyNowProduct) {
        result = await createDirectOrder({
          productId: buyNowProduct._id,
          quantity: 1,
          shippingAddress: addressToString(selectedAddress),
          addressId: selectedAddressId as any,
          phone: selectedAddress.phone,
          paymentMethod,
          notes: notes.trim() || undefined,
          prescriptionId: (selectedPrescriptionId as any) || undefined,
          couponCode: appliedCoupon?.code,
          couponDiscount: appliedCoupon?.discount,
          deliveryLatitude,
          deliveryLongitude,
        });
      } else {
        result = await createOrder({
          shippingAddress: addressToString(selectedAddress),
          addressId: selectedAddressId as any,
          phone: selectedAddress.phone,
          paymentMethod,
          notes: notes.trim() || undefined,
          prescriptionId: (selectedPrescriptionId as any) || undefined,
          couponCode: appliedCoupon?.code,
          couponDiscount: appliedCoupon?.discount,
          deliveryLatitude,
          deliveryLongitude,
        });
      }

      if (paymentMethod === "online") {
        // Open Razorpay checkout for this order
        setPlacing(false);
        await openRazorpayCheckout(result.orderId, result.invoiceNumber, finalTotal);
      } else {
        // COD — order placed directly
        toast.success(`Order placed! Invoice: ${result.invoiceNumber}`);
        navigate(`/orders/${result.orderId}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      if (paymentMethod === "cod") {
        setPlacing(false);
      }
    }
  };

  const isProcessing = placing || paymentProcessing;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-sm text-muted-foreground rounded-xl" onClick={() => {
          if (step > 0) setStep(step - 1);
          else if (isBuyNow && buyNowProduct) navigate(`/products/${buyNowProduct.slug}`);
          else navigate("/cart");
        }}>
          <ArrowLeft className="size-4" /> {step > 0 ? "Back" : isBuyNow ? "Back to Product" : "Back to Cart"}
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Checkout</h1>
        </motion.div>

        {/* Step Progress */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isComplete = i < step;
            return (
              <div key={s.id} className="flex items-center gap-2 shrink-0">
                <button
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-glow" :
                    isComplete ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}
                  onClick={() => isComplete && setStep(i)}
                  disabled={!isComplete && i !== step}
                >
                  {isComplete ? <Check className="size-3" /> : <s.icon className="size-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Address */}                {step === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Delivery Address</h2>
                    <Button variant="outline" size="sm" onClick={() => navigate("/account/addresses")} className="gap-1.5">
                      <PlusCircle className="size-3.5" /> Add New
                    </Button>
                  </div>

                  {addresses === undefined ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
                  ) : addresses.length === 0 ? (
                    <Card className="border-border/60"><CardContent className="py-12 text-center">
                      <MapPin className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">No saved addresses</p>
                      <Button onClick={() => navigate("/account/addresses")} className="gradient-primary text-white gap-2">
                        <PlusCircle className="size-4" /> Add Address
                      </Button>
                    </CardContent></Card>
                  ) : (
                    <RadioGroup value={selectedAddressId || ""} onValueChange={setSelectedAddressId} className="space-y-3">
                      {addresses.map((addr: any) => (
                        <label key={addr._id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr._id ? "border-primary bg-primary/[0.03] shadow-sm" : "border-border/60 hover:border-border"}`}>
                          <RadioGroupItem value={addr._id} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-foreground">{addr.fullName}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{addr.addressType}</Badge>
                              {addr.isDefault && <Badge className="text-[10px] bg-primary/10 text-primary">Default</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{addressToString(addr)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Phone: {addr.phone}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  )}

                  {/* Pincode Serviceability Check */}
                  {selectedAddress && pincodeFromAddr && (
                    <div className="mt-3">
                      {pincodeCheck === undefined ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" /> Checking delivery availability...
                        </div>
                      ) : pincodeCheck.available ? (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                          <CheckCircle className="size-4 text-green-600 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-green-800">Delivery available to {pincodeFromAddr}</p>
                            <p className="text-xs text-green-700">
                              {pincodeCheck.area} · Delivery fee: {pincodeCheck.deliveryFee === 0 ? <span className="text-green-600 font-semibold">Free</span> : `₹${pincodeCheck.deliveryFee}`} · Est. {pincodeCheck.estimatedDeliveryTime}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                          <XCircle className="size-4 text-red-600 shrink-0" />
                          <p className="text-sm text-red-700">{pincodeCheck.reason || "Delivery not available to this pincode"}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Prescription */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">Prescription Verification</h2>
                  {hasRxItems ? (
                    <>
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-800">Prescription Required</p>
                            <p className="text-xs text-amber-700 mt-1">Your cart contains prescription medicines. Please select an approved prescription to proceed.</p>
                          </div>
                        </div>
                      </div>

                      {prescriptions === undefined ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <RadioGroup value={selectedPrescriptionId || ""} onValueChange={setSelectedPrescriptionId} className="space-y-3">
                          {prescriptions.filter((rx: any) => rx.status === "approved").map((rx: any) => (
                            <label key={rx._id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedPrescriptionId === rx._id ? "border-primary bg-primary/[0.03]" : "border-border/60 hover:border-border"}`}>
                              <RadioGroupItem value={rx._id} className="mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{rx.fileName}</p>
                                <p className="text-xs text-muted-foreground">Patient: {rx.patientName} · Dr. {rx.doctorName}</p>
                                <Badge className="mt-1 text-[10px] bg-green-100 text-green-800">Approved</Badge>
                              </div>
                            </label>
                          ))}
                          {prescriptions.filter((rx: any) => rx.status === "approved").length === 0 && (
                            <Card className="border-border/60"><CardContent className="py-8 text-center">
                              <FileText className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">No approved prescriptions found.</p>
                              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/account/prescriptions")}>Upload Prescription</Button>
                            </CardContent></Card>
                          )}
                        </RadioGroup>
                      )}
                    </>
                  ) : (
                    <Card className="border-border/60"><CardContent className="py-8 text-center">
                      <CheckCircle2 className="size-10 text-green-500/40 mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground">No Prescription Required</p>
                      <p className="text-xs text-muted-foreground mt-1">Your cart only contains OTC products. You can proceed.</p>
                    </CardContent></Card>
                  )}
                </div>
              )}

              {/* Step 2: Order Summary */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">Order Summary</h2>
                  <Card className="border-border/60">
                    <CardContent className="p-4 space-y-3">
                      {cartItems?.map((item: any) => {
                        const p = item.product;
                        if (!p) return null;
                        const unitPrice = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
                        return (
                          <div key={item._id} className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                              <Pill className="size-4 text-primary/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(unitPrice)}</p>
                            </div>
                            <p className="text-sm font-semibold">{formatCurrency(unitPrice * item.quantity)}</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {selectedAddress && (
                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="size-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivering to</p>
                            <p className="text-sm font-medium mt-0.5">{selectedAddress.fullName}</p>
                            <p className="text-xs text-muted-foreground">{addressToString(selectedAddress)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-1.5">
                    <Label>Notes for pharmacy (optional)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions for your order..." rows={2} />
                  </div>
                </div>
              )}

              {/* Step 3: Payment */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">Payment Method</h2>
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cod" | "online")} className="space-y-3">
                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "cod" ? "border-primary bg-primary/[0.03]" : "border-border/60 hover:border-border"}`}>
                      <RadioGroupItem value="cod" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Cash on Delivery</p>
                        <p className="text-xs text-muted-foreground">Pay when your order is delivered</p>
                      </div>
                      <IndianRupee className="size-5 text-muted-foreground" />
                    </label>
                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "online" ? "border-primary bg-primary/[0.03]" : "border-border/60 hover:border-border"}`}>
                      <RadioGroupItem value="online" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Online Payment</p>
                        <p className="text-xs text-muted-foreground">Pay now via Razorpay (UPI, Cards, Netbanking)</p>
                      </div>
                      <CreditCard className="size-5 text-muted-foreground" />
                    </label>
                  </RadioGroup>

                  {paymentMethod === "cod" && (
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                      <p className="font-semibold">Payment on delivery</p>
                      <p className="mt-1">Please keep exact change ready. Our delivery partner will collect ₹{finalTotal.toLocaleString("en-IN")} at the time of delivery.</p>
                    </div>
                  )}

                  {paymentMethod === "online" && (
                    <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                      <div className="flex items-center gap-2 font-semibold">
                        <Lock className="size-3" /> Secure Payment via Razorpay
                      </div>
                      <p className="mt-1">You will be redirected to Razorpay's secure checkout. Supports UPI, Credit/Debit Cards, and Net Banking.</p>
                      <p className="mt-1">If the payment fails or you cancel, you can retry from your order details page.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Order Summary Sidebar */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-foreground">Order Details</h3>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                    <span className="font-medium">{formatCurrency(subtotal + totalDiscount)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST (12%)</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className={`font-medium ${deliveryFee === 0 ? "text-green-600" : ""}`}>
                      {deliveryFee === 0 ? "Free" : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" /> {appliedCoupon.code}
                      </span>
                      <span className="font-medium">-{formatCurrency(appliedCoupon.discount)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-extrabold text-lg text-foreground">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                {deliveryFee > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Add {formatCurrency(500 - subtotal)} more for free delivery
                  </p>
                )}

                {/* Coupon Code */}
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-1.5">
                      <Tag className="size-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-800">{appliedCoupon.code}</span>
                      <span className="text-[10px] text-green-700">applied</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-green-600 hover:text-green-800">
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setAppliedCoupon(null);
                      }}
                      className="flex-1 h-9 text-xs uppercase"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                )}

                {step < 3 ? (
                  <Button
                    className="w-full h-11 text-sm font-semibold gradient-primary text-white shadow-glow rounded-xl"
                    onClick={() => canProceed() && setStep(step + 1)}
                    disabled={!canProceed()}
                  >
                    Continue
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                ) : (
                  <Button
                    className="w-full h-11 text-sm font-semibold gradient-primary text-white shadow-glow rounded-xl"
                    onClick={handlePlaceOrder}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                    {paymentProcessing ? "Processing Payment..." :
                     placing ? "Placing Order..." :
                     paymentMethod === "online" ? `Pay ${formatCurrency(finalTotal)} Securely` :
                     `Place Order · ${formatCurrency(finalTotal)}`}
                  </Button>
                )}

                <div className="flex flex-col gap-2 pt-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-primary shrink-0" />
                    100% Genuine medicines
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="size-3.5 text-primary shrink-0" />
                    Free delivery on orders above ₹500
                  </div>
                  {paymentMethod === "online" && (
                    <div className="flex items-center gap-2">
                      <Lock className="size-3.5 text-primary shrink-0" />
                      Razorpay encrypted payment
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
