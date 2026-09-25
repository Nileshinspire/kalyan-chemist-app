import { Link } from "react-router";
import { HelpCircle, MessageCircle } from "lucide-react";
import InfoPage from "@/components/layout/InfoPage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ═══════════════════════════════════════════════════════════════════════════
   FAQs — dedicated footer-linked page.
   Every answer describes functionality that exists in this project: order
   tracking, prescription upload + pharmacist verification, Razorpay/COD
   checkout, lab tests, doctor appointments, medicine refill and account
   notifications. No capability is promised that the app does not have.
   ═══════════════════════════════════════════════════════════════════════════ */

const FAQ_GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Orders & Delivery",
    items: [
      {
        q: "How do I track my order?",
        a: "Sign in and open Account → Track Order to follow the live status of an active order. Past orders, invoices and their status are listed under Account → My Orders.",
      },
      {
        q: "How long does delivery take?",
        a: "An estimated delivery time is shown at checkout once you enter your pincode. Actual delivery can vary with your location, order volume and prescription verification for regulated medicines.",
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "Contact our support team as soon as possible. If the order has not been dispatched yet, we can usually update the address. Once it is out for delivery, the address cannot be changed.",
      },
      {
        q: "What are the delivery charges?",
        a: "Delivery fees and any free-delivery threshold are calculated for your pincode and shown on the checkout summary before you confirm the order.",
      },
      {
        q: "Why was my order cancelled?",
        a: "An order may be cancelled if an item went out of stock, if the delivery address is outside our serviceable pincodes, if a payment could not be confirmed, or if a prescription was rejected during verification. Any amount already paid is refunded.",
      },
    ],
  },
  {
    title: "Medicines & Prescriptions",
    items: [
      {
        q: "What does “Rx Required” mean?",
        a: "It means the medicine is a prescription-only medicine. It is dispensed only against a valid prescription issued by a registered medical practitioner and verified by our pharmacy team.",
      },
      {
        q: "How do I upload my prescription?",
        a: "Use the Upload Prescription page, or sign in and go to Account → My Prescriptions. You can upload a clear photograph or a PDF. You can also share it on WhatsApp when ordering through our WhatsApp support.",
      },
      {
        q: "How long does prescription verification take?",
        a: "Our pharmacist reviews each prescription before dispensing. If any detail is unclear, we contact you using the phone number or email on your account, so processing can take a little longer than an over-the-counter order.",
      },
      {
        q: "Can I order medicines without a prescription?",
        a: "Yes — over-the-counter products and general healthcare items can be ordered freely. Prescription-only medicines cannot be dispensed without a valid, verified prescription.",
      },
      {
        q: "Will you substitute a medicine I ordered?",
        a: "No. Prescription medicines are dispensed exactly as prescribed. If an item is unavailable, our team contacts you with options before processing anything.",
      },
    ],
  },
  {
    title: "Payments & Refunds",
    items: [
      {
        q: "Which payment methods are accepted?",
        a: "You can pay online through our secure payment provider using UPI, credit cards, debit cards or net banking. Cash on Delivery is available for eligible pincodes and order values.",
      },
      {
        q: "My payment failed but the amount was debited. What now?",
        a: "A failed payment does not confirm the order. Failed attempts are reconciled and any debited amount is returned to the original payment method. If it does not reflect, contact support with your order reference.",
      },
      {
        q: "How long do refunds take?",
        a: "Refunds are issued to the original payment method through our payment provider. The time taken to reflect depends on your bank or payment provider. Cash on Delivery refunds are transferred to a bank account you provide.",
      },
      {
        q: "Can I cancel my order?",
        a: "Orders can be cancelled from Account → My Orders before they are dispatched. Prescription orders cannot be cancelled once the medicine has been dispensed and dispatched.",
      },
      {
        q: "Where can I find my invoice?",
        a: "Every confirmed order generates an invoice number with an itemised breakdown. Open the order from Account → My Orders to view it.",
      },
    ],
  },
  {
    title: "Lab Tests & Doctor Appointments",
    items: [
      {
        q: "How do I book a lab test?",
        a: "Open the Lab Tests section from the footer or the homepage, choose the test or category you need and follow the booking steps. Booked tests are listed under Account → My Lab Tests.",
      },
      {
        q: "Where do I find my lab reports?",
        a: "Reports are available under Account → Lab Reports once they are ready.",
      },
      {
        q: "How do I book a doctor appointment?",
        a: "Use the Doctor Appointments page to choose a doctor and a slot. Your bookings are listed under Account → My Appointments, where you can also view appointment details.",
      },
      {
        q: "Do lab tests and appointments need a prescription?",
        a: "Most lab tests can be booked directly. Some tests may need a doctor's advice, and a consultation can help you choose the right test.",
      },
    ],
  },
  {
    title: "Refills & Your Account",
    items: [
      {
        q: "What is Medicine Refill?",
        a: "Medicine Refill helps you reorder medicines you take regularly. Set up a refill from the Medicine Refill page and manage your refills any time from your account.",
      },
      {
        q: "How do I update my profile or addresses?",
        a: "Sign in and open My Account to update your profile details, and use My Addresses to add, edit or remove delivery addresses.",
      },
      {
        q: "How do I manage notifications?",
        a: "Your account notification preferences let you control alerts such as order updates and reminders. Recent alerts are available under Account → Notifications.",
      },
      {
        q: "I forgot my password. What should I do?",
        a: "Use the sign-in page and choose the password reset option, or sign in with an email OTP / phone OTP where available. If you still cannot get in, contact our support team.",
      },
    ],
  },
  {
    title: "Returns & Support",
    items: [
      {
        q: "Can I return a product?",
        a: "Returns can be requested within 7 days of delivery for damaged, expired, incorrect or defective items with the original packaging intact. Opened medicines and temperature-sensitive products cannot be returned. See our Return Policy for full details.",
      },
      {
        q: "How do I contact Kalyan Chemist?",
        a: "You can call us, email us, or chat with our pharmacist on WhatsApp. Our Contact Us page lists every channel along with our support hours.",
      },
      {
        q: "Is my prescription information kept private?",
        a: "Yes. Prescriptions are used only to verify and dispense your medicines. See our Privacy Policy for details on what we collect and how it is handled.",
      },
      {
        q: "Do you deliver in my area?",
        a: "Enter your pincode at checkout to confirm serviceability, delivery charges and the estimated delivery time for your address.",
      },
    ],
  },
];

export default function Faqs() {
  return (
    <InfoPage
      badge="Help Centre"
      badgeIcon={<HelpCircle className="size-3" aria-hidden="true" />}
      title="Frequently Asked Questions"
      subtitle="Answers about orders, prescriptions, payments, lab tests, appointments, refills and returns at Kalyan Chemist."
    >
      <div className="space-y-8">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {group.title}
            </h2>
            <Accordion
              type="multiple"
              className="mt-2 rounded-2xl border border-border/60 bg-card px-5"
            >
              {group.items.map((item, index) => (
                <AccordionItem
                  key={item.q}
                  value={`${group.title}-${index}`}
                  className="border-border/50"
                >
                  <AccordionTrigger className="py-4 text-left text-[13px] font-semibold leading-snug hover:no-underline hover:text-primary sm:text-sm">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>

      {/* Still need help */}
      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Didn&apos;t find your answer?
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Our support team can look into your specific order or account.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/contact-us"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Contact Support
          </Link>
          <Link
            to="/account/help-support"
            className="inline-flex items-center rounded-xl border border-border/70 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Help & Support
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
