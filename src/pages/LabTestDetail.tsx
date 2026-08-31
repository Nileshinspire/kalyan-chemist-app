import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Clock,
  FlaskConical,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
  Calendar,
  MapPin,
  BadgeCheck,
  User,
  Users,
  Baby,
  Timer,
  Home,
  FileText,
  Info,
  CheckCircle2,
} from "lucide-react";

/* ── FAQ item ── */
interface FAQ {
  question: string;
  answer: string;
}

/* ── Build FAQs from test data ── */
function buildFAQs(
  name: string,
  description: string,
  sampleType?: string,
  fastingRequired?: boolean,
  reportTime?: string,
  homeCollection?: boolean,
): FAQ[] {
  const faqs: FAQ[] = [];
  faqs.push({
    question: `What does the ${name} check?`,
    answer:
      description ||
      `The ${name} is a diagnostic test that helps evaluate specific health parameters. Results should be interpreted by a qualified healthcare professional.`,
  });
  if (sampleType) {
    faqs.push({
      question: "How is the sample collected?",
      answer: `A sample is collected via ${sampleType.toLowerCase()}. A trained phlebotomist will collect the sample at your preferred location or at a partner lab.`,
    });
  } else {
    faqs.push({
      question: "How is the sample collected?",
      answer:
        "A trained phlebotomist will collect the required sample at your preferred location or at a partner laboratory.",
    });
  }
  if (fastingRequired !== undefined) {
    faqs.push({
      question: "Do I need to fast before this test?",
      answer: fastingRequired
        ? "Yes, fasting is required before this test. Please follow the fasting instructions provided at the time of booking."
        : "No special preparation or fasting is required for this test.",
    });
  }
  if (reportTime) {
    faqs.push({
      question: "When will I receive my report?",
      answer: `Your report will be available within ${reportTime}. You can view and download your digital report from your account.`,
    });
  } else {
    faqs.push({
      question: "When will I receive my report?",
      answer:
        "Reports are generally made available according to the configured turnaround time after sample collection. Once your report is uploaded and ready, you can view and download it from your account.",
    });
  }
  faqs.push({
    question: "Can I reschedule my collection appointment?",
    answer:
      "Yes, you can reschedule your appointment by contacting our support team at least 2 hours before your scheduled collection time.",
  });
  if (homeCollection !== undefined) {
    faqs.push({
      question: homeCollection
        ? "Is home sample collection available?"
        : "Is home sample collection available for this test?",
      answer: homeCollection
        ? "Yes, home sample collection is available for this test. A trained phlebotomist will visit your location."
        : "Home sample collection is not available for this test. You will need to visit a partner laboratory.",
    });
  }
  return faqs;
}

/* ── Price Display Component ── */
function PriceDisplay({
  basePrice,
  discountedPrice,
}: {
  basePrice: number;
  discountedPrice?: number;
}) {
  const hasDiscount =
    discountedPrice != null && discountedPrice > 0 && discountedPrice < basePrice;
  const validPrice = basePrice != null && basePrice > 0;
  const pct = hasDiscount
    ? Math.round(((basePrice - discountedPrice!) / basePrice) * 100)
    : 0;

  if (!validPrice) {
    return (
      <p className="text-gray-400 italic text-sm">Price not available</p>
    );
  }
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-gray-900">
          ₹{(hasDiscount ? discountedPrice! : basePrice).toLocaleString("en-IN")}
        </span>
        {hasDiscount && (
          <>
            <span className="text-sm text-gray-400 line-through">
              ₹{basePrice.toLocaleString("en-IN")}
            </span>
            <span className="text-sm font-bold text-emerald-600">
              {pct}% off
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/* ── MAIN PAGE ── */
/* ════════════════════════════════════════════════════ */

export default function LabTestDetail() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedIncluded, setExpandedIncluded] = useState<number | null>(null);

  /* ── Fetch the test ── */
  const test = useQuery(
    api.labTests.get,
    testId ? { id: testId as Id<"lab_tests"> } : "skip",
  );

  /* ── Fetch related packages in same category ── */
  const categoryTests = useQuery(
    api.labTests.listByCategory,
    test ? { categorySlug: test.categorySlug } : "skip",
  );
  const relatedPackages =
    categoryTests?.filter(
      (t) => t.type === "package" && t._id !== test?._id,
    ) ?? [];

  /* ── Booking mutation ── */
  const createBooking = useMutation(api.labTests.createBooking);

  /* ── Loading state ── */
  if (test === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[#0a3d2e] border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Loading test details…</p>
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (test === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <FlaskConical className="mx-auto size-12 text-gray-300 mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Test Not Found
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            The lab test you are looking for does not exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/lab-tests")}
            className="rounded-lg bg-[#0a3d2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#082f23] transition-colors"
          >
            Browse Lab Tests
          </button>
        </div>
      </div>
    );
  }

  const faqs = buildFAQs(
    test.name,
    test.description,
    test.sampleType,
    test.fastingRequired,
    test.reportTime,
    test.homeCollectionAvailable,
  );

  const validPrice = test.originalPrice > 0;
  const hasDiscount =
    test.discountedPrice > 0 && test.discountedPrice < test.originalPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Breadcrumb ── */}
        <button
          onClick={() =>
            navigate(`/lab-tests/${test.categorySlug}`)
          }
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to {test.categoryName}
        </button>

        {/* ── Two-Column Layout ── */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* ═══ LEFT COLUMN — Booking Card ═══ */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6">
                  {/* Test Name */}
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-2">
                    {test.name}
                  </h1>

                  {/* Also Known As */}
                  {test.includedTestIds.length > 0 &&
                    test.includedTestIds.some((id) => id.length > 0) && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Also Known As
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {test.includedTestIds.join(", ")}
                        </p>
                      </div>
                    )}

                  {/* Quick Info */}
                  <div className="space-y-2.5 mb-5">
                    {test.reportGuaranteeHours &&
                      test.reportGuaranteeHours > 0 && (
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Timer className="size-3.5 text-blue-600" />
                          </div>
                          <p className="text-sm text-gray-700">
                            Earliest reports available within{" "}
                            <span className="font-semibold text-blue-700">
                              {test.reportGuaranteeHours} hours
                            </span>
                          </p>
                        </div>
                      )}
                    {test.reportTime && !test.reportGuaranteeHours && (
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Timer className="size-3.5 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-700">
                          Report within{" "}
                          <span className="font-semibold">{test.reportTime}</span>
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                        <FlaskConical className="size-3.5 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-700">
                        {test.fastingRequired
                          ? "Fasting required"
                          : "No preparation required"}
                      </p>
                    </div>
                    {test.homeCollectionAvailable && (
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                          <Home className="size-3.5 text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-700">
                          Home sample collection available
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-5 pb-5 border-b border-gray-100">
                    <PriceDisplay
                      basePrice={test.originalPrice}
                      discountedPrice={
                        hasDiscount ? test.discountedPrice : undefined
                      }
                    />
                    {/* Best Price Ever */}
                    {test.bestPriceEver && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                        BEST PRICE EVER!
                      </span>
                    )}
                  </div>

                  {/* Book Test CTA */}
                  <button
                    onClick={() => {
                      if (validPrice) {
                        navigate(
                          `/lab-tests/${test.categorySlug}?book=${test._id}`,
                        );
                      }
                    }}
                    disabled={!validPrice}
                    className="w-full rounded-xl bg-[#0a3d2e] py-3.5 text-sm font-bold text-white hover:bg-[#082f23] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {validPrice ? "Book Test" : "Price not available"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — Detailed Information ═══ */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* ── Tests Included ── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FlaskConical className="size-5 text-[#0a3d2e]" />
                Tests Included ({test.includedTestCount})
              </h2>
              {test.includedTestIds.length > 0 ? (
                <div className="space-y-2">
                  {test.includedTestIds.map((testName, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedIncluded(
                          expandedIncluded === idx ? null : idx,
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-4 text-[#0a3d2e] shrink-0" />
                        <span className="text-sm font-medium text-gray-800">
                          {testName || `Test ${idx + 1}`}
                        </span>
                      </div>
                      {expandedIncluded === idx ? (
                        <ChevronUp className="size-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-gray-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{test.name}</p>
              )}
            </div>

            {/* ── Quick Links ── */}
            {relatedPackages.length > 0 && (
              <div className="flex gap-4">
                <a
                  href="#related-packages"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a3d2e]/5 px-4 py-2 text-sm font-medium text-[#0a3d2e] hover:bg-[#0a3d2e]/10 transition-colors"
                >
                  <FileText className="size-4" />
                  Related Packages ({relatedPackages.length})
                </a>
                <a
                  href="#faqs"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Info className="size-4" />
                  FAQs
                </a>
              </div>
            )}

            {/* ── About ── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">About</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {test.sampleType && (
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <FlaskConical className="size-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Sample Type
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {test.sampleType}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <Users className="size-4 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Gender
                    </p>
                    <p className="text-sm font-medium text-gray-800">Both</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <Baby className="size-4 text-gray-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Age Group
                    </p>
                    <p className="text-sm font-medium text-gray-800">
                      7 years &amp; above
                    </p>
                  </div>
                </div>
                {test.reportTime && (
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <Clock className="size-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Report Time
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {test.reportTime}
                      </p>
                    </div>
                  </div>
                )}
                {test.homeCollectionAvailable !== undefined && (
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <Home className="size-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Home Collection
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {test.homeCollectionAvailable
                          ? "Available"
                          : "Not Available"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Test Overview ── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Test Overview
              </h2>

              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                    What is this test?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {test.description ||
                      `The ${test.name} is a diagnostic test used to evaluate specific health parameters. It helps healthcare professionals assess your condition and guide further treatment if needed.`}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                    Why is this test done?
                  </h3>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 size-1.5 rounded-full bg-[#0a3d2e] shrink-0" />
                      To screen for specific health conditions
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 size-1.5 rounded-full bg-[#0a3d2e] shrink-0" />
                      To monitor ongoing treatment or medication effectiveness
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 size-1.5 rounded-full bg-[#0a3d2e] shrink-0" />
                      As part of a preventive health check-up
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 size-1.5 rounded-full bg-[#0a3d2e] shrink-0" />
                      When recommended by a healthcare professional
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                    What do the results mean?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Results should be interpreted by a qualified healthcare
                    professional in the context of your health and other test
                    results. Abnormal values may indicate the need for further
                    evaluation or treatment.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                    Preparation
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {test.fastingRequired
                      ? "Fasting is required before this test. Please follow the specific fasting instructions provided at the time of booking."
                      : "No special preparation or fasting is required for this test."}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">
                    Sample Collection
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {test.sampleType
                      ? `A trained phlebotomist collects a ${test.sampleType.toLowerCase()} sample from your preferred location or at a partner laboratory.`
                      : "A trained phlebotomist will collect the required sample at your preferred location or at a partner laboratory."}
                  </p>
                </div>
              </div>
            </div>

            {/* ── FAQs ── */}
            <div id="faqs" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">FAQs</h2>
              <div className="space-y-2">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-100 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedFaq(expandedFaq === idx ? null : idx)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-800 pr-2">
                        {faq.question}
                      </span>
                      {expandedFaq === idx ? (
                        <ChevronUp className="size-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {expandedFaq === idx && (
                      <div className="px-4 pb-3">
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Related Packages ── */}
            {relatedPackages.length > 0 && (
              <div
                id="related-packages"
                className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Related Packages
                </h2>
                <div className="space-y-3">
                  {relatedPackages.map((pkg) => {
                    const pkgHasDiscount =
                      pkg.discountedPrice > 0 &&
                      pkg.discountedPrice < pkg.originalPrice;
                    const pkgValid = pkg.originalPrice > 0;
                    return (
                      <div
                        key={pkg._id}
                        className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() =>
                          navigate(`/lab-tests/test/${pkg._id}`)
                        }
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {pkg.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {pkg.includedTestCount} Tests Included
                          </p>
                        </div>
                        <div className="text-right">
                          {pkgValid ? (
                            <p className="text-sm font-extrabold text-[#0a3d2e]">
                              ₹
                              {(pkgHasDiscount
                                ? pkg.discountedPrice
                                : pkg.originalPrice
                              ).toLocaleString("en-IN")}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              Price not available
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Trust Section ── */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Why Book With Us
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-[#0a3d2e]/5 flex items-center justify-center shrink-0">
                    <Shield className="size-4 text-[#0a3d2e]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Secure Sample Collection
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Safe and hygienic collection process
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-[#0a3d2e]/5 flex items-center justify-center shrink-0">
                    <User className="size-4 text-[#0a3d2e]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Certified Phlebotomist
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Trained and verified professionals
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-[#0a3d2e]/5 flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-[#0a3d2e]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Digital Reports
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Access reports online anytime
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-[#0a3d2e]/5 flex items-center justify-center shrink-0">
                    <BadgeCheck className="size-4 text-[#0a3d2e]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Secure Booking
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Your data is safe with us
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
