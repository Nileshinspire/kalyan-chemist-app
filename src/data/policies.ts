/* ═══════════════════════════════════════════════════════════════════════════
   Policy content for the footer-linked legal pages.

   Every statement here is grounded in functionality that actually exists in
   this project (Razorpay + Cash on Delivery checkout, prescription
   verification, order tracking, account notification preferences, the
   7-day support window already quoted in Help & Support). No regulatory
   claims, certifications or figures are invented.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface PolicyDoc {
  title: string;
  subtitle: string;
  sections: PolicySection[];
}

export const POLICY_LAST_UPDATED = "September 2026";

export type PolicyId =
  | "privacy"
  | "terms"
  | "shipping"
  | "cancellation"
  | "returns"
  | "prescription"
  | "payment"
  | "disclaimer";

export const POLICIES: Record<PolicyId, PolicyDoc> = {
  privacy: {
    title: "Privacy Policy",
    subtitle:
      "How Kalyan Chemist collects, uses and protects the information you share while using our pharmacy and health services.",
    sections: [
      {
        heading: "Information we collect",
        paragraphs: [
          "We collect only the information needed to run your account and fulfil your orders.",
        ],
        bullets: [
          "Account details such as your name, email address and phone number.",
          "Delivery addresses you save in My Addresses.",
          "Prescriptions you upload through Upload Prescription or My Prescriptions.",
          "Order history, cart contents, invoice details and payment status.",
          "Basic device and usage information required for the service to work reliably.",
        ],
      },
      {
        heading: "How we use your information",
        bullets: [
          "To process, verify and deliver your orders.",
          "To have prescriptions reviewed by our pharmacy team before dispensing.",
          "To provide lab tests, doctor appointments and medicine refill services you request.",
          "To send order, payment and account notifications, and to respond to support requests.",
        ],
      },
      {
        heading: "Payments",
        paragraphs: [
          "Online payments are handled by our payment provider on their secure checkout. Card, UPI and net banking credentials are processed by the payment provider — Kalyan Chemist does not store your full payment credentials.",
        ],
      },
      {
        heading: "Prescriptions",
        paragraphs: [
          "Uploaded prescriptions are used solely to verify and dispense your medicines, and are handled by our pharmacy team. Prescription details are not shared for marketing purposes.",
        ],
      },
      {
        heading: "Communications",
        paragraphs: [
          "We send order and account updates by email, SMS and in-app notifications. You can manage your notification preferences from your account settings. If you contact us on WhatsApp, we use that conversation only to assist you.",
        ],
      },
      {
        heading: "Sharing your information",
        paragraphs: [
          "We do not sell your personal information. Information is shared only with service providers who help us complete your order — such as delivery and payment partners — or where we are required to do so by law.",
        ],
      },
      {
        heading: "Security and retention",
        paragraphs: [
          "We apply reasonable technical and organisational safeguards to protect your data. Account information is retained while your account is active and for as long as needed for order, accounting and legal purposes.",
        ],
      },
      {
        heading: "Your choices",
        bullets: [
          "Review and update your profile and saved addresses from My Account.",
          "Manage notification preferences from your account settings.",
          "Raise any privacy question with our support team from Contact Us.",
        ],
      },
    ],
  },

  terms: {
    title: "Terms & Conditions",
    subtitle:
      "The terms that apply when you browse, order from or use services on the Kalyan Chemist platform.",
    sections: [
      {
        heading: "Acceptance of these terms",
        paragraphs: [
          "By browsing this platform, creating an account or placing an order, you agree to these terms. If you do not agree with them, please do not use the platform.",
        ],
      },
      {
        heading: "Your account",
        bullets: [
          "Provide accurate account, contact and delivery information.",
          "Keep your login credentials confidential and secure.",
          "You are responsible for activity carried out through your account.",
        ],
      },
      {
        heading: "Products and availability",
        paragraphs: [
          "Product information and stock shown on the platform are indicative. If an item becomes unavailable after you order, our team will contact you and the affected item or order will be adjusted, substituted only with your consent, or refunded.",
        ],
      },
      {
        heading: "Prescription medicines",
        paragraphs: [
          "Medicines marked as prescription-only are dispensed strictly against a valid prescription from a registered medical practitioner. Our pharmacist may reject an order if the prescription is invalid, illegible, expired or incomplete, and the order is refunded as per our Cancellation & Refund Policy.",
        ],
      },
      {
        heading: "Pricing, taxes and delivery",
        bullets: [
          "Prices are displayed in Indian Rupees and include applicable taxes as shown on the invoice.",
          "Delivery charges, free-delivery thresholds and any minimum order value are shown before you confirm an order.",
          "Delivery estimates are indicative and may vary with your pincode and other conditions.",
        ],
      },
      {
        heading: "Orders and payment",
        paragraphs: [
          "Orders are confirmed subject to availability and, where applicable, prescription verification. Prepaid orders are processed through our payment provider's secure checkout, and Cash on Delivery is available for eligible orders.",
        ],
      },
      {
        heading: "Health information",
        paragraphs: [
          "Content on this platform — including medicine descriptions and health condition pages — is provided for general information and is not medical advice. Please read our Disclaimer and consult a registered medical practitioner for diagnosis or treatment.",
        ],
      },
      {
        heading: "Acceptable use",
        bullets: [
          "Do not submit false or altered prescriptions.",
          "Do not misuse, disrupt or attempt to gain unauthorised access to the platform.",
          "Do not copy or reuse platform content for commercial purposes without permission.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: [
          "We may update these terms to reflect changes in our services or applicable requirements. The version published on this page applies to your use of the platform.",
        ],
      },
    ],
  },

  shipping: {
    title: "Shipping & Delivery",
    subtitle:
      "How orders are dispatched, what delivery costs, and how to follow your order after it is placed.",
    sections: [
      {
        heading: "Where we deliver",
        paragraphs: [
          "Delivery is available in the serviceable pincodes configured for our store. Serviceability and the estimated delivery time are confirmed at checkout before you pay.",
        ],
      },
      {
        heading: "Delivery charges",
        bullets: [
          "Delivery fees and any free-delivery threshold are shown at checkout.",
          "A minimum order value may apply for free delivery on eligible orders.",
          "Cash on Delivery availability depends on your pincode and order value.",
        ],
      },
      {
        heading: "Order processing",
        paragraphs: [
          "Orders are packed once payment is confirmed (or a Cash on Delivery order is accepted). Orders that include prescription medicines are dispatched only after our pharmacist verifies the prescription.",
        ],
      },
      {
        heading: "Delivery timelines",
        paragraphs: [
          "Indicative timelines are shown at checkout. Actual delivery can vary with your pincode, order volume, weather, public holidays and prescription verification for regulated medicines.",
        ],
      },
      {
        heading: "Tracking your order",
        paragraphs: [
          "Track live status any time from Account → Track Order, or review past orders under Account → My Orders. Order updates are also sent through your account notifications.",
        ],
      },
      {
        heading: "Delivery attempts",
        bullets: [
          "Please keep the phone number on the order reachable — our delivery partner may call you.",
          "Someone at the delivery address should be available to receive the order.",
          "If an order cannot be delivered, our team will contact you to arrange another attempt or process a refund as per our Cancellation & Refund Policy.",
        ],
      },
      {
        heading: "Delays",
        paragraphs: [
          "If an order is unexpectedly delayed, we will notify you using the contact details on your account, and our support team will help you from Contact Us or WhatsApp.",
        ],
      },
    ],
  },

  cancellation: {
    title: "Cancellation & Refund Policy",
    subtitle:
      "When an order can be cancelled, and how refunds are returned to you.",
    sections: [
      {
        heading: "Cancelling an order",
        bullets: [
          "Orders can be cancelled from Account → My Orders before they are dispatched.",
          "Prescription orders cannot be cancelled once the medicine has been dispensed and dispatched.",
          "If the cancel option is not available in your order, contact our support team with your order number.",
        ],
      },
      {
        heading: "Orders cancelled by us",
        paragraphs: [
          "An order may be cancelled by Kalyan Chemist if a product becomes unavailable, if the delivery address is outside our serviceable pincodes, if the prescription is rejected during verification, or if the payment cannot be confirmed. In such cases any amount already paid is refunded.",
        ],
      },
      {
        heading: "Refund eligibility",
        bullets: [
          "Prepaid orders cancelled before dispatch.",
          "Prepaid orders that could not be delivered.",
          "Failed or unconfirmed payments that were debited.",
          "Medicines rejected during prescription verification.",
        ],
      },
      {
        heading: "How refunds are issued",
        paragraphs: [
          "Refunds for prepaid orders are returned to the original payment method through our payment provider. For Cash on Delivery orders, refunds are transferred to a bank account you provide. The time taken for the amount to appear depends on your bank or payment provider.",
        ],
      },
      {
        heading: "Partial refunds",
        paragraphs: [
          "Where only part of an order is affected — for example one unavailable item in a multi-item order — only that item is refunded, and delivery charges are reviewed accordingly.",
        ],
      },
      {
        heading: "How to request help",
        paragraphs: [
          "Raise a cancellation or refund request within 7 days of the order or delivery by contacting our support team from Contact Us or WhatsApp, and include your order or invoice number.",
        ],
      },
    ],
  },

  returns: {
    title: "Return Policy",
    subtitle:
      "Which items can be returned, what is not eligible, and how a return is completed.",
    sections: [
      {
        heading: "Return window",
        paragraphs: [
          "Returns can be requested within 7 days of delivery. Requests are reviewed against the conditions below so that medicine safety is never compromised.",
        ],
      },
      {
        heading: "Eligible returns",
        bullets: [
          "A damaged, expired or leaking product.",
          "A wrong item delivered compared with your order.",
          "A product with a manufacturing defect.",
          "Products returned with the original packaging and seal intact where applicable.",
        ],
      },
      {
        heading: "Not eligible for return",
        bullets: [
          "Medicines that have been opened or consumed.",
          "Temperature-sensitive or refrigerated products once delivered.",
          "Products returned after the 7-day window.",
          "Items purchased during clearance or special promotional sales, unless they arrived damaged or incorrect.",
        ],
      },
      {
        heading: "How to raise a return",
        bullets: [
          "Contact our support team from Contact Us or WhatsApp with your order number.",
          "Share the reason and, where relevant, photographs of the product and packaging.",
          "Our team confirms eligibility and arranges a pickup where the address is serviceable.",
        ],
      },
      {
        heading: "Replacement or refund",
        paragraphs: [
          "Once the returned item is received and verified, we arrange a replacement where available, or a refund as per our Cancellation & Refund Policy.",
        ],
      },
      {
        heading: "Prescription items",
        paragraphs: [
          "Prescription medicines are accepted back only for verified quality issues, in line with our Prescription Policy and applicable pharmacy regulations.",
        ],
      },
    ],
  },

  prescription: {
    title: "Prescription Policy",
    subtitle:
      "How prescription medicines are dispensed on Kalyan Chemist and what a valid prescription must contain.",
    sections: [
      {
        heading: "Prescription-only medicines",
        paragraphs: [
          "Medicines that require a prescription are marked “Rx Required” on the product page and in your cart. These are dispensed only against a valid prescription issued by a registered medical practitioner.",
        ],
      },
      {
        heading: "How to submit a prescription",
        bullets: [
          "Upload a clear photograph or PDF from the Upload Prescription page.",
          "Or submit it later from Account → My Prescriptions.",
          "You can also share it with our pharmacist over WhatsApp when ordering through WhatsApp support.",
        ],
      },
      {
        heading: "Verification by our pharmacist",
        paragraphs: [
          "Every prescription is reviewed by our pharmacy team before the medicine is dispensed. We may contact you if any detail needs clarification. Orders are processed only after verification.",
        ],
      },
      {
        heading: "A valid prescription includes",
        bullets: [
          "The prescribing doctor's name, qualification, registration details and signature.",
          "The patient's name, and the medicine, strength, dosage and duration prescribed.",
          "The date of issue, within its validity period.",
          "Legible handwriting or print — unclear prescriptions cannot be dispensed.",
        ],
      },
      {
        heading: "Rejected prescriptions",
        paragraphs: [
          "If a prescription is invalid, illegible, expired or incomplete, the order cannot be dispensed. Any amount paid for the affected items is refunded as per our Cancellation & Refund Policy.",
        ],
      },
      {
        heading: "No substitution, no misuse",
        paragraphs: [
          "Prescription medicines are dispensed strictly as prescribed. We do not substitute or dispense prescription medicines without a valid prescription, and altered or repeated use of the same prescription is not accepted.",
        ],
      },
      {
        heading: "Privacy",
        paragraphs: [
          "Prescription files are used only for verification, dispensing and record-keeping as described in our Privacy Policy.",
        ],
      },
    ],
  },

  payment: {
    title: "Payment Policy",
    subtitle:
      "The payment methods accepted on Kalyan Chemist and how payments, failures and invoices are handled.",
    sections: [
      {
        heading: "Payment methods accepted",
        bullets: [
          "Online prepaid payment through our payment provider's secure checkout — UPI, credit cards, debit cards and net banking.",
          "Cash on Delivery, where it is available for your pincode and order.",
        ],
      },
      {
        heading: "Secure processing",
        paragraphs: [
          "Prepaid transactions are completed on our payment provider's encrypted checkout. Kalyan Chemist does not store your full card, UPI or net banking credentials.",
        ],
      },
      {
        heading: "Order confirmation",
        paragraphs: [
          "An order is confirmed once the payment is authorised and verified on our side. Cash on Delivery orders are confirmed when the order is accepted.",
        ],
      },
      {
        heading: "Failed or pending payments",
        bullets: [
          "If a payment fails, the order is not confirmed and the amount is not captured.",
          "If an amount is debited but the order was not confirmed, the failed attempt is reconciled and refunded to the original payment method.",
          "You can retry payment from the order page or contact support for help.",
        ],
      },
      {
        heading: "Invoices",
        paragraphs: [
          "An invoice number is generated for every confirmed order and is shown in your order details, with the itemised amounts, applicable taxes and delivery charges.",
        ],
      },
      {
        heading: "Cash on Delivery",
        paragraphs: [
          "Cash on Delivery is payable in cash to the delivery partner at the time of delivery. Availability depends on your pincode and order value, and is shown at checkout.",
        ],
      },
      {
        heading: "Coupons and offers",
        paragraphs: [
          "Coupon codes are subject to their stated eligibility and validity, and only one coupon can be applied to an order unless explicitly stated otherwise.",
        ],
      },
      {
        heading: "Refunds",
        paragraphs: [
          "Refunds for cancelled or returned orders follow our Cancellation & Refund Policy and are returned to the original payment method, or by bank transfer for Cash on Delivery orders.",
        ],
      },
    ],
  },

  disclaimer: {
    title: "Disclaimer",
    subtitle:
      "Important information about the content published on the Kalyan Chemist platform.",
    sections: [
      {
        heading: "Not medical advice",
        paragraphs: [
          "Content on this platform — including medicine descriptions, health condition pages, lab test information and general health articles — is for general awareness only. It is not a diagnosis, prescription or treatment plan, and must not be used as a substitute for professional medical advice.",
        ],
      },
      {
        heading: "Always consult a professional",
        paragraphs: [
          "Consult a registered medical practitioner or our pharmacist before starting, changing or stopping any medicine or health product. Never delay or disregard professional medical advice because of something you read here.",
        ],
      },
      {
        heading: "Prescription medicines",
        paragraphs: [
          "Prescription medicines are dispensed only against a valid prescription from a registered medical practitioner and after verification by our pharmacy team, as described in our Prescription Policy.",
        ],
      },
      {
        heading: "Lab tests and doctor appointments",
        paragraphs: [
          "Lab tests and doctor appointments booked through the platform are delivered by the respective service professionals. Test reports and consultations should always be discussed with a qualified medical professional before acting on them.",
        ],
      },
      {
        heading: "Product information",
        paragraphs: [
          "Product images are indicative. Actual packaging, pack size or formulation may vary between batches. Always read the product label and package insert before use.",
        ],
      },
      {
        heading: "Accuracy of information",
        paragraphs: [
          "We try to keep pricing, stock and product details accurate and up to date, but errors can occur. Where an error is identified, we may correct the information, contact you about the affected order, or cancel and refund it.",
        ],
      },
      {
        heading: "Medical emergencies",
        paragraphs: [
          "This platform is not designed for emergencies. If you have a medical emergency, contact your local emergency services or go to the nearest hospital immediately.",
        ],
      },
      {
        heading: "External links",
        paragraphs: [
          "Any link to a third-party website is provided for convenience only. Kalyan Chemist is not responsible for the content, products or practices of those websites.",
        ],
      },
    ],
  },
};
