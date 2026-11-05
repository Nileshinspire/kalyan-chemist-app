import { describe, expect, it } from "vitest";
import {
  isLoadableImageUrl,
  resolveNotificationTemplate,
} from "@/components/notifications/notificationTemplate";

const resolve = (title: string, body = "", category?: string, type?: string) =>
  resolveNotificationTemplate({ title, body, category, type }).id;

describe("notification template selection", () => {
  it("matches the actual festival, not just the festival category", () => {
    const cases: [string, string][] = [
      ["Happy Diwali", "diwali"],
      ["happy holi", "holi"],
      ["Merry Christmas", "christmas"],
      ["Ganesh Chaturthi wishes", "ganesh"],
      ["Eid Mubarak", "eid"],
      ["Happy New Year", "newyear"],
      ["Happy Navratri", "navratri"],
      ["Happy Raksha Bandhan", "rakhi"],
      ["Happy Independence Day", "independence"],
      ["Happy Republic Day", "republic"],
      ["Happy Makar Sankranti", "sankranti"],
      ["Onam greetings", "onam"],
      ["Janmashtami wishes", "janmashtami"],
      ["happy gandhi jaynti", "gandhi"],
    ];
    for (const [title, expected] of cases) {
      expect(resolve(title, "", "festival"), title).toBe(expected);
    }
  });

  it("falls back to the generic festive template for an unknown occasion", () => {
    expect(resolve("Season's greetings", "From our family to yours", "festival")).toBe("festival");
  });

  it("keeps an offer an offer even when the text mentions health", () => {
    expect(resolve("Special offer on health essentials", "Save on your cart", "offer")).toBe("offer");
  });

  it("keeps an announcement an announcement", () => {
    expect(
      resolve("Store timings update", "Service desk unavailable this afternoon", "announcement"),
    ).toBe("announcement");
  });

  it("detects health content without a category", () => {
    expect(resolve("Stay hydrated this summer", "Drink enough water through the day")).toBe("health");
  });

  it("detects offers and notices from content", () => {
    expect(resolve("Weekend deal", "Flat savings on your next order")).toBe("offer");
    expect(resolve("Delivery update", "Orders may be delayed today")).toBe("announcement");
  });

  it("gives order updates their own layout", () => {
    expect(resolve("Out for Delivery", "Your order is on its way", undefined, "order_status")).toBe("order");
    expect(resolve("Refill due", "Time to refill your monthly medicine", undefined, "refill_reminder")).toBe("order");
  });

  it("uses the neutral template when nothing matches", () => {
    expect(resolve("A note from Kalyan Chemist", "Thank you for being with us.")).toBe("neutral");
  });

  it("never treats a share page as an image", () => {
    expect(isLoadableImageUrl("https://example.com/banner.jpg")).toBe(true);
    expect(isLoadableImageUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(
      isLoadableImageUrl("https://example.com/happy-navratri-background_177783632.htm#x"),
    ).toBe(false);
    expect(isLoadableImageUrl("/local/banner.png")).toBe(false);
    expect(isLoadableImageUrl(null)).toBe(false);
  });
});
