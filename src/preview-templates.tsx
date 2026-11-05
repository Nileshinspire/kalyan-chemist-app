import { createRoot } from "react-dom/client";
import "./index.css";
import { NotificationMessage, type NotificationMessageData } from "@/components/notifications/NotificationMessage";

const fixtures: { name: string; data: NotificationMessageData; expect: string }[] = [
  {
    name: "health",
    expect: "health",
    data: {
      _id: "p1",
      type: "system",
      category: "health",
      campaignId: "c1",
      title: "Stay hydrated through the summer",
      body: "Water is the simplest way to keep your body cool and your energy steady.\n\nCarry a bottle when you step out, sip through the day, and add lemon or coconut water if plain water feels boring. Elderly family members and children need extra attention on hot days.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "diwali",
    expect: "diwali",
    data: {
      _id: "p2",
      type: "promo",
      category: "festival",
      campaignId: "c2",
      title: "Happy Diwali",
      body: "May the festival of lights bring health, happiness and prosperity to you and your family.\n\nWishing you a safe, bright and joyful Diwali from all of us at Kalyan Chemist.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "holi",
    expect: "holi",
    data: {
      _id: "p3",
      type: "promo",
      category: "festival",
      campaignId: "c3",
      title: "happy holi",
      body: "enjoy color full holi",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "christmas",
    expect: "christmas",
    data: {
      _id: "p4",
      type: "promo",
      category: "festival",
      campaignId: "c4",
      title: "Merry Christmas",
      body: "Wishing you and your family a warm, healthy and joyful Christmas.\n\nThank you for trusting us with your family's health through the year.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "offer",
    expect: "offer",
    data: {
      _id: "p5",
      type: "promo",
      category: "offer",
      campaignId: "c5",
      title: "Special offer on health essentials",
      body: "Your saved offers are live in the app. Browse the offer section to see what applies to your cart.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "announcement",
    expect: "announcement",
    data: {
      _id: "p6",
      type: "system",
      category: "announcement",
      campaignId: "c6",
      title: "Store timings update",
      body: "Our delivery support desk will be unavailable between 2:00 PM and 4:00 PM today for a scheduled system update.\n\nOrders placed during this window will be confirmed as soon as service resumes.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "order",
    expect: "order",
    data: {
      _id: "p7",
      type: "order_status",
      title: "Out for Delivery",
      body: "Your order is on its way. Please keep your phone reachable for the delivery partner.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "neutral",
    expect: "neutral",
    data: {
      _id: "p8",
      type: "system",
      title: "A note from Kalyan Chemist",
      body: "Thank you for being with us. Your prescriptions, refills and orders are all in one place in your account.",
      createdAt: Date.now(),
      imageUrl: null,
    },
  },
  {
    name: "image",
    expect: "festival",
    data: {
      _id: "p9",
      type: "promo",
      category: "festival",
      campaignId: "c9",
      title: "Festive greeting",
      body: "A greeting with a real uploaded image.",
      createdAt: Date.now(),
      imageUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1f5d3a"/><circle cx="320" cy="180" r="90" fill="#fbbf24"/></svg>`,
        ),
    },
  },
];

function Preview() {
  return (
    <div className="mx-auto max-w-md space-y-8 bg-slate-100 p-4">
      {fixtures.map(({ name, data }) => (
        <section key={name} data-fixture={name}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{name}</p>
          <div className="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden rounded-2xl border border-slate-300 bg-white p-0 shadow-xl">
            <NotificationMessage notification={data} />
            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
