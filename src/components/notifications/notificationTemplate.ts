/**
 * Context-aware notification templates.
 *
 * The Admin Message Center only stores a coarse category (`festival`,
 * `health`, `offer`, `announcement`). Two festival messages from different
 * festivals therefore looked identical. This resolver reads the category plus
 * the real title and message body, identifies the actual occasion, and returns
 * the template id the detail view should render. Nothing here invents content:
 * every word on screen comes from the notification itself.
 */

export type NotificationKind =
  | "festival"
  | "health"
  | "offer"
  | "announcement"
  | "wish"
  | "order"
  | "neutral";

export type NotificationTemplateId =
  | "diwali"
  | "holi"
  | "christmas"
  | "ganesh"
  | "eid"
  | "newyear"
  | "navratri"
  | "rakhi"
  | "independence"
  | "republic"
  | "sankranti"
  | "onam"
  | "janmashtami"
  | "gandhi"
  | "festival"
  | "health"
  | "offer"
  | "announcement"
  | "wish"
  | "order"
  | "neutral";

export interface NotificationInput {
  title: string;
  body: string;
  category?: string | null;
  type?: string | null;
}

export interface NotificationTemplate {
  id: NotificationTemplateId;
  kind: NotificationKind;
  /** Short, human label used on the hero badge (e.g. "Diwali Wishes"). */
  label: string;
}

const FESTIVAL_PATTERNS: { id: NotificationTemplateId; label: string; re: RegExp }[] = [
  {
    id: "diwali",
    label: "Diwali Wishes",
    re: /\b(diwali|deepavali|diya|diyas|laxmi\s*puja|lakshmi\s*puja|govardhan)\b|दिवाली|दीपावली|दीये/i,
  },
  {
    id: "holi",
    label: "Holi Hai!",
    re: /\b(holi|hola\s*mohalla|rang\s*barse|gulal|pichkari)\b|होली/i,
  },
  {
    id: "christmas",
    label: "Merry Christmas",
    re: /\b(christmas|xmas|santa|jingle\s*bells|merry\s*christmas)\b|क्रिसमस/i,
  },
  {
    id: "ganesh",
    label: "Ganesh Chaturthi",
    re: /\b(ganesh|ganpati|ganesha|vinayaka|chaturthi|modak)\b|गणेश/i,
  },
  {
    id: "eid",
    label: "Eid Mubarak",
    re: /\b(eid|eid\s*mubarak|ramadan|ramzan|iftar|chaand\s*raat)\b|ईद|रमज़ान|रमजान/i,
  },
  {
    id: "newyear",
    label: "Happy New Year",
    re: /\b(new\s*year|newyear|naya\s*saal|happy\s*20\d\d)\b|नया\s*साल|नववर्ष/i,
  },
  {
    id: "navratri",
    label: "Navratri Wishes",
    re: /\b(navratri|navaratri|navratra|durga\s*puja|dussehra|dasara|dandiya|garba)\b|नवरात्रि|दुर्गा/i,
  },
  {
    id: "rakhi",
    label: "Raksha Bandhan",
    re: /\b(rakhi|raksha\s*bandhan|rakhee)\b|राखी|रक्षाबंधन/i,
  },
  {
    id: "janmashtami",
    label: "Janmashtami",
    re: /\b(janmashtami|krishna\s*janmashtami|gokulashtami|dahi\s*handi)\b|जन्माष्टमी/i,
  },
  {
    id: "onam",
    label: "Onam Wishes",
    re: /\b(onam|pookalam|thiruvonam)\b|ओणम/i,
  },
  {
    id: "sankranti",
    label: "Makar Sankranti",
    re: /\b(makar\s*sankranti|sankranti|pongal|lohri|maghi|kite\s*festival)\b|मकर\s*संक्रांति|पोंगल/i,
  },
  {
    id: "gandhi",
    label: "Gandhi Jayanti",
    re: /\b(gandhi\s*jayanti|gandhi\s*jayanthi|gandhi\s*jaynti|2nd\s*october|october\s*2)\b|गांधी\s*जयंती/i,
  },
  {
    id: "independence",
    label: "Independence Day",
    re: /\b(independence\s*day|15th\s*august|august\s*15|swatantrata\s*diwas)\b|स्वतंत्रता\s*दिवस|आज़ादी/i,
  },
  {
    id: "republic",
    label: "Republic Day",
    re: /\b(republic\s*day|26th\s*january|january\s*26|ganatantra\s*diwas)\b|गणतंत्र\s*दिवस/i,
  },
];

const HEALTH_RE =
  /\b(health|healthy|wellness|wellbeing|immune|immunity|vitamin|vitamins|nutrition|hydrat\w*|dengue|malaria|monsoon|diabetes|blood\s*pressure|bp|heart|cardiac|cholesterol|yoga|sleep|skin|hair|dental|oral|vaccin\w*|checkup|check-up|screening|preventive|prevention|symptom|fever|cold|cough|allergy|asthma|thyroid|pregnan\w*|child\s*care|elder\w*|first\s*aid|sunscreen|protein|calcium|iron)\b|स्वास्थ्य|सेहत/i;

const OFFER_RE =
  /\b(offer|offers|discount|sale|flat\s*\d|%\s*off|percent\s*off|cashback|coupon|deal|deals|save|saving|savings|free\s*delivery|combo|bogo|promo\s*code|limited\s*period|special\s*price)\b|छूट|ऑफर/i;

const ANNOUNCEMENT_RE =
  /\b(announcement|notice|important|update|advisory|informing|inform|closed|closure|holiday\s*hours|timings|timing|schedule|maintenance|outage|service\s*update|delay|delayed|suspended|resume|opening|reopen)\b|सूचना|सूचित/i;

const WISH_RE =
  /\b(wish|wishes|wishing|congratulat\w*|birthday|anniversary|greetings|celebrat\w*|shubhkamnaye\w*|badhai)\b|बधाई|शुभकामनाएं|जन्मदिन/i;

const ORDER_RE = /\border\b|refund|deliver|dispatch|shipment|prescription\s*approved|out\s*for\s*delivery|prepared|packed/i;

/**
 * Pick the most specific template for a notification.
 *
 * Category is a hint, the text decides the details: a "festival" message that
 * says Christmas gets the Christmas template, while a festival message with no
 * recognisable occasion gets the generic (still premium) festive fallback.
 */
export function resolveNotificationTemplate(
  input: NotificationInput,
): NotificationTemplate {
  const text = `${input.title}\n${input.body}`;
  const category = (input.category ?? "").toLowerCase();
  const type = (input.type ?? "").toLowerCase();

  // Explicit festival content wins even when the category is generic — the
  // actual occasion is what the template should match.
  for (const festival of FESTIVAL_PATTERNS) {
    if (festival.re.test(text)) {
      return { id: festival.id, kind: "festival", label: festival.label };
    }
  }

  // The admin-chosen category is the strongest signal for non-festival
  // messages — an "offer" that mentions health essentials must stay an offer,
  // not turn into a health tip.
  if (category === "festival") {
    return { id: "festival", kind: "festival", label: "Festive Wishes" };
  }
  if (category === "health") {
    return { id: "health", kind: "health", label: "Health Awareness" };
  }
  if (category === "offer") {
    return { id: "offer", kind: "offer", label: "Special Offer" };
  }
  if (category === "announcement") {
    return { id: "announcement", kind: "announcement", label: "Important Notice" };
  }

  // Transactional notifications keep their own layout. Only treat them as
  // order updates when the text really is about an order/refund.
  if ((type === "order_status" || type === "refill_reminder") && ORDER_RE.test(text)) {
    return {
      id: "order",
      kind: "order",
      label: type === "refill_reminder" ? "Refill Reminder" : "Order Update",
    };
  }

  // No category (or a generic one): read the actual content.
  if (HEALTH_RE.test(text)) {
    return { id: "health", kind: "health", label: "Health Awareness" };
  }

  if (OFFER_RE.test(text)) {
    return { id: "offer", kind: "offer", label: "Special Offer" };
  }

  if (ANNOUNCEMENT_RE.test(text)) {
    return { id: "announcement", kind: "announcement", label: "Important Notice" };
  }

  if (WISH_RE.test(text)) {
    return { id: "wish", kind: "wish", label: "With Warm Wishes" };
  }

  if (type === "order_status" || type === "refill_reminder") {
    return {
      id: "order",
      kind: "order",
      label: type === "refill_reminder" ? "Refill Reminder" : "Order Update",
    };
  }

  return { id: "neutral", kind: "neutral", label: "Message" };
}

/** Web-page extensions: campaigns sometimes store a share page, not an image file. */
const NON_IMAGE_PATH = /\.(?:html?|xhtml|php|asp|aspx|jsp|jspx|cfm)$/i;

/**
 * True only for URLs an <img> can actually render. A pasted gallery/share page
 * (e.g. ".../happy-navratri-background_177783632.htm") is not an image, so the
 * card falls back to its designed banner instead of a broken image box.
 */
export function isLoadableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim();
  if (/^data:image\//i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return !NON_IMAGE_PATH.test(new URL(value).pathname);
  } catch {
    return false;
  }
}
