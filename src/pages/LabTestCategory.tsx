import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, X, SlidersHorizontal, ShoppingCart, Check, FlaskConical, Beaker, Heart, Shield, Stethoscope, Pill, Activity, Calendar, MapPin, Clock, AlertTriangle, Loader2 } from "lucide-react";

/* ── Types ── */
interface IncludedTest {
  name: string;
  description: string;
}
interface LabTestItem {
  id: string;
  name: string;
  type: "single" | "package";
  includedTests: IncludedTest[];
  includedTestCount: number;
  basePrice: number;
  discountedPrice?: number;
  badges?: string[];
  bestPriceEver?: boolean;
  reportGuaranteeHours?: number;
  promotionalText?: string;
  icon?: string;
  _isFromDB?: boolean;
  _convexId?: string;
}
interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  items: LabTestItem[];
}

/* ── Category Data (all 29 categories) ── */
const ALL_CATEGORIES: CategoryData[] = [
  {
    id: "full-body",
    name: "Full Body Checkup",
    slug: "full-body",
    description: "Comprehensive health checkups covering all major organ systems.",
    items: [],
  },
  {
    id: "diabetes",
    name: "Diabetes",
    slug: "diabetes",
    description: "Tests to screen, monitor, and manage diabetes and pre-diabetic conditions.",
    items: [],
  },
  {
    id: "heart",
    name: "Heart",
    slug: "heart",
    description: "Cardiac screening to assess heart health and cardiovascular risk factors.",
    items: [],
  },
  {
    id: "blood",
    name: "Blood Studies",
    slug: "blood",
    description: "Detailed blood analysis to evaluate health and detect blood disorders.",
    items: [],
  },
  {
    id: "vitamin",
    name: "Vitamin",
    slug: "vitamin",
    description: "Essential vitamin panels to detect deficiencies affecting energy and immunity.",
    items: [],
  },
  {
    id: "thyroid",
    name: "Thyroid",
    slug: "thyroid",
    description: "Complete thyroid screening for hypothyroidism and hyperthyroidism.",
    items: [],
  },
  {
    id: "kidney",
    name: "Kidney",
    slug: "kidney",
    description: "Kidney function assessment to detect early kidney damage and disease.",
    items: [],
  },
  {
    id: "liver",
    name: "Liver",
    slug: "liver",
    description: "Liver function evaluation to detect hepatitis, fatty liver, and liver conditions.",
    items: [],
  },
  {
    id: "womens-health",
    name: "Women's Health",
    slug: "womens-health",
    description: "Health screening tailored for women covering hormonal, reproductive, and wellness markers.",
    items: [],
  },
  {
    id: "senior-citizen",
    name: "Senior Citizen",
    slug: "senior-citizen",
    description: "Specialised screening for seniors covering age-related and chronic conditions.",
    items: [],
  },
  {
    id: "tax-saver",
    name: "Tax Saver",
    slug: "tax-saver",
    description: "Preventive health checkup eligible for tax benefits under Section 80D.",
    items: [],
  },
  {
    id: "fever",
    name: "Fever",
    slug: "fever",
    description: "Tests to identify the cause of persistent or recurring fever.",
    items: [],
  },
  {
    id: "hormone",
    name: "Hormone Screening",
    slug: "hormone",
    description: "Comprehensive hormone panel to evaluate endocrine function and imbalances.",
    items: [],
  },
  {
    id: "hairfall",
    name: "Hairfall",
    slug: "hairfall",
    description: "Diagnostic tests to identify the root cause of excessive hair loss.",
    items: [],
  },
  {
    id: "dengue",
    name: "Dengue",
    slug: "dengue",
    description: "Tests for early detection and monitoring of dengue fever infection.",
    items: [],
  },
  {
    id: "bone-joint",
    name: "Bone and Joint",
    slug: "bone-joint",
    description: "Tests to evaluate bone health, joint inflammation, and musculoskeletal conditions.",
    items: [],
  },
  {
    id: "allergy",
    name: "Allergy",
    slug: "allergy",
    description: "Comprehensive allergy testing to identify triggers for various allergies.",
    items: [],
  },
  {
    id: "sexual-wellness",
    name: "Sexual Wellness",
    slug: "sexual-wellness",
    description: "Confidential screening for sexual health and reproductive wellness.",
    items: [],
  },
  {
    id: "immunity",
    name: "Immunity",
    slug: "immunity",
    description: "Evaluate immune system strength and identify factors affecting body defence.",
    items: [],
  },
  {
    id: "fever-infection",
    name: "Fever and Infection",
    slug: "fever-infection",
    description: "Tests to identify the specific cause of fever and systemic infections.",
    items: [],
  },
  {
    id: "reproductive",
    name: "Reproductive & Fertility Tests",
    slug: "reproductive",
    description: "Comprehensive fertility evaluation for reproductive health assessment.",
    items: [],
  },
  {
    id: "cancer-screening",
    name: "Cancer Screening",
    slug: "cancer-screening",
    description: "Early cancer detection markers to identify risk factors.",
    items: [],
  },
  {
    id: "hepatitis",
    name: "Hepatitis Screening",
    slug: "hepatitis",
    description: "Comprehensive hepatitis screening for A, B, and C virus infections.",
    items: [],
  },
  {
    id: "lungs",
    name: "Lungs",
    slug: "lungs",
    description: "Respiratory health assessment to evaluate lung function.",
    items: [],
  },
  {
    id: "weight",
    name: "Weight Management",
    slug: "weight",
    description: "Metabolic and hormonal tests to identify causes of weight issues.",
    items: [],
  },
  {
    id: "iron",
    name: "Iron Studies",
    slug: "iron",
    description: "Detailed iron assessment to diagnose deficiency and overload conditions.",
    items: [],
  },
  {
    id: "covid",
    name: "Covid 19",
    slug: "covid",
    description: "COVID-19 testing and post-infection health assessment.",
    items: [],
  },
  {
    id: "pcod",
    name: "PCOD Screening",
    slug: "pcod",
    description: "Hormonal screening to diagnose and evaluate PCOS.",
    items: [],
  },
  {
    id: "healthy-2024",
    name: "Healthy 2024",
    slug: "healthy-2024",
    description: "Comprehensive preventive health checkup for the new year.",
    items: [],
  },
];

/* ── Category slug map ── */
const SLUG_MAP: Record<string, string> = {};
ALL_CATEGORIES.forEach((c) => { SLUG_MAP[c.slug] = c.id; });

/* ── Test icon per type ── */
function TestIcon({ type }: { type: "single" | "package" }) {
  if (type === "package") {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#0a3d2e]/10">
        <Beaker className="size-7 text-[#0a3d2e]" />
      </div>
    );
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50">
      <FlaskConical className="size-7 text-blue-500" />
    </div>
  );
}

/* ── Mobile Filter Drawer ── */
function FilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Filters</h3>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="size-5 text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function LabTestCategory() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  const categoryData = useMemo(() => {
    if (!category) return null;
    const id = SLUG_MAP[category];
    return ALL_CATEGORIES.find((c) => c.id === id) || null;
  }, [category]);
  /* DB lab tests for this category — single source of truth */
  const dbTests = useQuery(
    api.labTests.listByCategory,
    category ? { categorySlug: category } : "skip"
  );

  /* Map DB tests to display items — ONLY from DB */
  const effectiveCategoryData = useMemo(() => {
    if (!categoryData) return null;
    const dbItems: LabTestItem[] = (dbTests || []).map((t) => ({
      id: t._id,
      name: t.name,
      type: t.type,
      includedTests: t.includedTestIds.map((id) => ({
        name: id,
        description: "",
      })),
      includedTestCount: t.includedTestCount,
      basePrice: t.originalPrice,
      discountedPrice: t.discountedPrice || undefined,
      bestPriceEver: t.bestPriceEver || undefined,
      reportGuaranteeHours: t.reportGuaranteeHours || undefined,
      promotionalText: t.promotionalText || undefined,
      _isFromDB: true,
      _convexId: t._id,
    }));
    return { ...categoryData, items: dbItems };
  }, [categoryData, dbTests]);

  /* Filters */
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [testFilters, setTestFilters] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  /* Cart (local state since lab tests aren't products) */
  const [cartItems, setCartItems] = useState<Set<string>>(new Set());

  /* Booking modal */
  const [bookingTest, setBookingTest] = useState<LabTestItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState<"home" | "lab">("home");
  const [bookingAddress, setBookingAddress] = useState("");
  const [bookingPincode, setBookingPincode] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingError, setBookingError] = useState("");
  const createBooking = useMutation(api.labTests.createBooking);



  const toggleTestFilter = useCallback((testName: string) => {
    setTestFilters((prev) => {
      const next = new Set(prev);
      if (next.has(testName)) next.delete(testName);
      else next.add(testName);
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setTypeFilters(new Set());
    setTestFilters(new Set());
  }, []);

  const toggleCart = useCallback((itemId: string) => {
    setCartItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  /* Compute unique "Must Have Tests" from category items */
  const availableTests = useMemo(() => {
    if (!effectiveCategoryData) return [];
    const testMap = new Map<string, string>();
    effectiveCategoryData.items.forEach((item) => {
      item.includedTests.forEach((t) => {
        if (!testMap.has(t.name)) testMap.set(t.name, t.description);
      });
    });
    return Array.from(testMap.entries()).map(([name, description]) => ({ name, description }));
  }, [effectiveCategoryData]);

  /* Toggle type filter — mutually exclusive radio behavior */
  const toggleTypeFilter = useCallback((type: string) => {
    setTypeFilters((prev) => {
      if (prev.has(type)) {
        // Clicking the already-selected type deselects it → return to All Tests
        return new Set();
      }
      // Selecting a type replaces any other selected type
      return new Set([type]);
    });
  }, []);

  /* Filtered items */
  const filteredItems = useMemo(() => {
    if (!effectiveCategoryData) return [];
    let items = effectiveCategoryData.items;

    // If typeFilters has entries, show only those types; otherwise show all
    if (typeFilters.size > 0) {
      items = items.filter((i) => typeFilters.has(i.type));
    }

    if (testFilters.size > 0) {
      items = items.filter((i) =>
        Array.from(testFilters).every((f) =>
          i.includedTests.some((t) => t.name === f)
        )
      );
    }

    return items;
  }, [effectiveCategoryData, typeFilters, testFilters]);

  if (!effectiveCategoryData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">Category not found.</p>
          <button onClick={() => navigate("/lab-tests")} className="mt-4 text-sm text-[#0a3d2e] font-semibold hover:underline">
            Back to Lab Tests
          </button>
        </div>
      </div>
    );
  }

  /* Booking handlers */
  /* Body scroll lock when modal open */
  useEffect(() => {
    if (bookingTest) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [bookingTest]);

  const openBookingModal = useCallback((item: LabTestItem) => {
    setBookingTest(item);
    setBookingError("");
    setBookingTime("");
    setBookingAddress("");
    setBookingPincode("");
    setBookingNotes("");
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setBookingDate(d.toISOString().split("T")[0]);
  }, []);

  const closeBookingModal = useCallback(() => {
    setBookingTest(null);
    setBookingError("");
  }, []);

  const handleBookingSubmit = useCallback(async () => {
    if (!bookingTest) return;
    if (!bookingDate || !bookingTime || !bookingAddress.trim() || !bookingPincode.trim()) {
      setBookingError("Please fill in all required fields.");
      return;
    }
    if (bookingPincode.trim().length < 6) {
      setBookingError("Please enter a valid 6-digit pincode.");
      return;
    }
    try {
      const testId = bookingTest._convexId as any;
      await createBooking({
        testId,
        collectionDate: bookingDate,
        timeSlot: bookingTime,
        collectionType: bookingType,
        address: bookingAddress.trim(),
        pincode: bookingPincode.trim(),
        notes: bookingNotes.trim() || undefined,
      });
      setBookingTest(null);
      setBookingError("");
      setCartItems((prev) => {
        const next = new Set(prev);
        next.delete(bookingTest.id);
        return next;
      });
    } catch (err: any) {
      setBookingError(err?.message || "Failed to book. Please try again.");
    }
  }, [bookingTest, bookingDate, bookingTime, bookingType, bookingAddress, bookingPincode, bookingNotes, createBooking]);

  const TIME_SLOTS = [
    "07:00 AM - 09:00 AM",
    "09:00 AM - 11:00 AM",
    "11:00 AM - 01:00 PM",
    "01:00 PM - 03:00 PM",
    "03:00 PM - 05:00 PM",
    "05:00 PM - 07:00 PM",
  ];

  const sidebarContent = (
    <>
      {/* Type of Tests — mutually exclusive radio behavior */}
      <div className="mb-6">
        <h4 className="mb-3 text-sm font-bold text-gray-900">Type of Tests</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="testType"
              checked={typeFilters.has("single")}
              onChange={() => toggleTypeFilter("single")}
              className="size-4 border-gray-300 text-[#0a3d2e] accent-[#0a3d2e]"
            />
            <span className="text-sm text-gray-700">Single Tests</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="testType"
              checked={typeFilters.has("package")}
              onChange={() => toggleTypeFilter("package")}
              className="size-4 border-gray-300 text-[#0a3d2e] accent-[#0a3d2e]"
            />
            <span className="text-sm text-gray-700">Package Tests</span>
          </label>
        </div>
      </div>

      {/* Must Have Tests */}
      {availableTests.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-gray-900">Must Have Tests</h4>
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {availableTests.map((t) => (
              <label key={t.name} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testFilters.has(t.name)}
                  onChange={() => toggleTestFilter(t.name)}
                  className="size-4 rounded border-gray-300 text-[#0a3d2e] accent-[#0a3d2e]"
                />
                <span className="text-sm text-gray-700">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        {/* Back */}
        <button
          onClick={() => navigate("/lab-tests")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Health Check
        </button>

        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {effectiveCategoryData.name} <span className="text-gray-400 font-normal">({filteredItems.length})</span>
          </h1>
          {/* Mobile filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            <SlidersHorizontal className="size-4" />
            Filters
          </button>
        </div>

        {/* All Tests indicator — only visible when no type filter is active */}
        {typeFilters.size === 0 && (
          <div className="mb-5">
            <button
              onClick={() => setTypeFilters(new Set())}
              className="inline-flex items-center rounded-full bg-[#0a3d2e] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              All Tests
            </button>
          </div>
        )}

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-[240px] shrink-0">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Filters</h3>
                {(typeFilters.size > 0 || testFilters.size > 0) && (
                  <button onClick={clearAllFilters} className="text-xs font-semibold text-[#0a3d2e] hover:underline">
                    Clear All
                  </button>
                )}
              </div>
              {sidebarContent}
            </div>
          </aside>

          {/* Mobile filter drawer */}
          <FilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)}>
            <div className="mb-4 flex items-center justify-between">
              {(typeFilters.size > 0 || testFilters.size > 0) && (
                <button onClick={clearAllFilters} className="text-xs font-semibold text-[#0a3d2e] hover:underline">
                  Clear All
                </button>
              )}
            </div>
            {sidebarContent}
            <button
              onClick={() => setFilterOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#0a3d2e] py-3 text-sm font-bold text-white hover:bg-[#082f23] transition-colors"
            >
              Show {filteredItems.length} Results
            </button>
          </FilterDrawer>

          {/* Test Grid */}
          <div className="flex-1 min-w-0">
            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <FlaskConical className="mx-auto size-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  {typeFilters.size > 0 || testFilters.size > 0
                    ? "No tests match your selected filters."
                    : "No lab tests available in this category yet."}
                </p>
                {(typeFilters.size > 0 || testFilters.size > 0) && (
                  <button onClick={clearAllFilters} className="mt-3 text-sm font-semibold text-[#0a3d2e] hover:underline">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((item) => {
                  const inCart = cartItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-all hover:shadow-md hover:border-gray-300 cursor-pointer"
                      onClick={(e) => {
                        if (
                          item._isFromDB &&
                          item._convexId &&
                          !(e.target as HTMLElement).closest('button')
                        ) {
                          navigate(`/lab-tests/test/${item._convexId}`);
                        }
                      }}
                    >
                      {/* Header row: icon + name */}
                      <div className="flex items-start gap-2.5 mb-1.5">
                        <TestIcon type={item.type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.type === "package" && (
                              <span className="inline-flex items-center rounded bg-[#0a3d2e] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                                Package
                              </span>
                            )}
                            <h3 className="text-[13px] font-bold text-gray-900 leading-tight">{item.name}</h3>
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-500">{item.includedTestCount} Test{item.includedTestCount > 1 ? "s" : ""} Included</p>
                        </div>
                      </div>

                      {/* Best Price Ever badge — only when Admin enables */}
                      {item.bestPriceEver && (
                        <div className="mb-1">
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            BEST PRICE EVER!
                          </span>
                        </div>
                      )}

                      {/* Report Guarantee — only when Admin configures */}
                      {item.reportGuaranteeHours && item.reportGuaranteeHours > 0 && (
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            <Clock className="size-2.5" />
                            {item.reportGuaranteeHours}-Hour Report Guarantee
                          </span>
                        </div>
                      )}

                      {/* Promotional text */}
                      {item.promotionalText && (
                        <p className="mb-1 text-[11px] font-semibold text-[#0a3d2e]">{item.promotionalText}</p>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                        <div>
                          {(() => {
                            const bp = item.basePrice;
                            const dp = item.discountedPrice;
                            const hasDiscount = dp != null && dp > 0 && dp < bp;
                            const validPrice = bp != null && bp > 0;
                            const pct = hasDiscount ? Math.round(((bp - dp) / bp) * 100) : 0;
                            if (!validPrice) {
                              return <span className="text-[13px] text-gray-400 italic">Price not available</span>;
                            }
                            return (
                              <>
                                <span className="text-[15px] font-extrabold text-gray-900">
                                  ₹{(hasDiscount ? dp : bp).toLocaleString("en-IN")}
                                </span>
                                {hasDiscount && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] text-gray-400 line-through">
                                      ₹{bp.toLocaleString("en-IN")}
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-600">
                                      {pct}% off
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item._isFromDB && item._convexId && item.basePrice > 0) {
                              openBookingModal(item);
                            }
                          }}
                          disabled={item._isFromDB && item.basePrice <= 0}
                          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                            inCart
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item._isFromDB && item.basePrice <= 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-[#0a3d2e] text-white hover:bg-[#082f23]"
                          }`}
                        >
                          {inCart ? (
                            <span className="flex items-center gap-1.5">
                              <Check className="size-4" />
                              Added
                            </span>
                          ) : (
                            "Add"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating cart indicator */}
      {cartItems.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => navigate("/cart")}
            className="flex items-center gap-2.5 rounded-full bg-[#0a3d2e] px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#082f23] transition-colors"
          >
            <ShoppingCart className="size-5" />
            <span>{cartItems.size} item{cartItems.size > 1 ? "s" : ""}</span>
          </button>
        </div>
      )}

      {/* Booking Modal */}
      {bookingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Book Test</h2>
                <p className="text-sm text-gray-500 mt-0.5">{bookingTest.name}</p>
              </div>
              <button onClick={closeBookingModal} className="flex size-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <X className="size-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{bookingTest.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{bookingTest.includedTestCount} test{bookingTest.includedTestCount > 1 ? "s" : ""} included</p>
                </div>
                {bookingTest.basePrice > 0 ? (
                  <p className="text-lg font-extrabold text-[#0a3d2e]">₹{(bookingTest.discountedPrice != null && bookingTest.discountedPrice > 0 && bookingTest.discountedPrice < bookingTest.basePrice ? bookingTest.discountedPrice : bookingTest.basePrice).toLocaleString("en-IN")}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Price not available</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Collection Type *</label>
                <div className="flex gap-3">
                  <button onClick={() => setBookingType("home")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${bookingType === "home" ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <MapPin className="size-4 inline mr-1.5" />Home Collection
                  </button>
                  <button onClick={() => setBookingType("lab")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${bookingType === "lab" ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <FlaskConical className="size-4 inline mr-1.5" />Visit Lab
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2"><Calendar className="size-4 inline mr-1.5" />Preferred Date *</label>
                <input type="date" value={bookingDate} min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} onChange={(e) => setBookingDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2"><Clock className="size-4 inline mr-1.5" />Preferred Time Slot *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button key={slot} onClick={() => setBookingTime(slot)} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-medium transition-colors ${bookingTime === slot ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{slot}</button>
                  ))}
                </div>
              </div>
              {bookingType === "home" && (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2"><MapPin className="size-4 inline mr-1.5" />Collection Address *</label>
                  <textarea value={bookingAddress} onChange={(e) => setBookingAddress(e.target.value)} placeholder="Enter full address with landmark" rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none resize-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Pincode *</label>
                <input type="text" value={bookingPincode} onChange={(e) => setBookingPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" maxLength={6} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Special Instructions (optional)</label>
                <input type="text" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="Any special instructions" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              {bookingError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                  <AlertTriangle className="size-4 shrink-0" />{bookingError}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
              <button onClick={handleBookingSubmit} disabled={!bookingDate || !bookingTime || !bookingAddress.trim() || !bookingPincode.trim()} className="w-full rounded-xl bg-[#0a3d2e] py-3.5 text-sm font-bold text-white hover:bg-[#082f23] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Calendar className="size-4" />Confirm Booking{bookingTest.basePrice > 0 ? ` — ₹${(bookingTest.discountedPrice && bookingTest.discountedPrice > 0 && bookingTest.discountedPrice < bookingTest.basePrice ? bookingTest.discountedPrice : bookingTest.basePrice).toLocaleString("en-IN")}` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
