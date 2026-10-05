// Parity check: src/lib/deliveryFee.ts (client, used by Cart + Checkout) must
// equal the delivery-fee calculation in src/convex/orders.ts (server) for
// every scenario. Run: bun qa/fee-parity.ts
import { computeDeliveryFee, type PublicDeliveryConfig } from "../src/lib/deliveryFee";

type Config = {
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  pincodes: { pincode: string; isActive: boolean; deliveryFee?: number }[];
};

// Verbatim copy of the server logic from src/convex/orders.ts
// (orders.create and orders.createDirectOrder — both identical):
//
//   let deliveryFee = 49;
//   if (dc) {
//     const pinMatch = pincode ? dc.pincodes.find((p) => p.pincode === pincode && p.isActive) : undefined;
//     const fee = pinMatch?.deliveryFee ?? dc.defaultDeliveryFee;
//     deliveryFee = subtotal >= dc.freeDeliveryThreshold ? 0 : fee;
//   } else if (subtotal >= 500) {
//     deliveryFee = 0;
//   }
function serverFee(dc: Config | null, subtotal: number, pincode?: string): number {
  let deliveryFee = 49;
  if (dc) {
    const pinMatch = pincode ? dc.pincodes.find((p) => p.pincode === pincode && p.isActive) : undefined;
    const fee = pinMatch?.deliveryFee ?? dc.defaultDeliveryFee;
    deliveryFee = subtotal >= dc.freeDeliveryThreshold ? 0 : fee;
  } else if (subtotal >= 500) {
    deliveryFee = 0;
  }
  return deliveryFee;
}

// Server extracts the pincode from the shipping-address string:
//   args.shippingAddress.match(/\b(\d{6})\b/)?.[1]
function extractPincode(shippingAddress?: string): string | undefined {
  return shippingAddress?.match(/\b(\d{6})\b/)?.[1];
}

const liveConfig: Config = {
  // Actual production delivery_config (deliveryConfig:getPublic)
  defaultDeliveryFee: 0,
  freeDeliveryThreshold: 500,
  pincodes: [{ pincode: "421306", area: "kalyan (E)", isActive: true } as any],
};

const paidConfig: Config = {
  defaultDeliveryFee: 49,
  freeDeliveryThreshold: 500,
  pincodes: [{ pincode: "421306", area: "kalyan (E)", isActive: true } as any],
};

const pincodeOverrideConfig: Config = {
  defaultDeliveryFee: 30,
  freeDeliveryThreshold: 200,
  pincodes: [
    { pincode: "421306", area: "kalyan (E)", isActive: true, deliveryFee: 70 } as any,
    { pincode: "400001", area: "mumbai", isActive: false, deliveryFee: 99 } as any,
  ],
};

const configs: [string, Config | null][] = [
  ["live (fee 0, threshold 500)", liveConfig],
  ["paid (fee 49, threshold 500)", paidConfig],
  ["pincode overrides (fee 30, threshold 200, pin 421306→70, 400001 inactive)", pincodeOverrideConfig],
  ["no config row (server 49/500 fallback)", null],
];

const subtotals = [0, 1, 99, 199, 200, 299, 499, 500, 501, 999, 1000, 5000];
const addresses: (string | undefined)[] = [
  undefined,
  // Typical addressToString output (pincode at the end)
  "Ravi Kumar, Flat 102, MG Road, Kalyan (E), Maharashtra, 421306",
  "Shop 4, Link Road, Mumbai, Maharashtra, 400001", // inactive pincode override
  "Somewhere without a pincode field",
  "Weird pincode spacing, 421 306", // regex must not match either side
];

let failures = 0;
let checks = 0;
for (const [name, cfg] of configs) {
  for (const sub of subtotals) {
    for (const addr of addresses) {
      checks++;
      const client = computeDeliveryFee(cfg as PublicDeliveryConfig | null, sub, addr);
      const server = serverFee(cfg, sub, extractPincode(addr));
      if (client !== server) {
        failures++;
        console.error(`MISMATCH [${name}] subtotal=${sub} addr=${JSON.stringify(addr)}: client=${client} server=${server}`);
      }
    }
  }
}

// Loading state (query not yet resolved): never flash the stale ₹49 fee.
checks++;
if (computeDeliveryFee(undefined, 100) !== 0) {
  failures++;
  console.error("MISMATCH [loading] expected 0 while config query is undefined");
}

// Live-config spot checks required by QA:
// below threshold and above threshold must BOTH be ₹0 (defaultDeliveryFee=0),
// and Cart (no address) must equal Checkout (address with the served pincode).
checks++;
if (computeDeliveryFee(liveConfig, 100) !== 0) { failures++; console.error("live below-threshold expected 0"); }
checks++;
if (computeDeliveryFee(liveConfig, 1000) !== 0) { failures++; console.error("live above-threshold expected 0"); }
checks++;
if (computeDeliveryFee(liveConfig, 100) !== computeDeliveryFee(liveConfig, 100, "Kalyan, 421306")) {
  failures++; console.error("Cart (no address) and Checkout (pincode address) disagree on live config");
}
// Nonzero-fee config: threshold behavior preserved exactly as configured.
checks++;
if (computeDeliveryFee(paidConfig, 499) !== 49 || computeDeliveryFee(paidConfig, 500) !== 0) {
  failures++; console.error("paid config threshold behavior mismatch (expected 49/0)");
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures}/${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS: ${checks} parity checks (client helper === server formula)`);
