import { describe, expect, it } from "vitest";
import { brandLogoStatus } from "@/convex/brandEnrichment";

/**
 * `brandLogoStatus` is what the admin Brands list shows per row, and it
 * delegates to the same rule the logo repair pass acts on.
 */
describe("brandLogoStatus", () => {
  it("reports a brand with no stored logo as missing", () => {
    expect(brandLogoStatus("Denver", null)).toBe("missing");
    expect(brandLogoStatus("Denver", undefined)).toBe("missing");
    expect(brandLogoStatus("Denver", "   ")).toBe("missing");
  });

  it("reports a stored value that is not an image URL as broken", () => {
    expect(brandLogoStatus("Cipla", "not-a-url")).toBe("broken");
    expect(brandLogoStatus("Cipla", "/uploads/cipla.png")).toBe("broken");
  });

  it("accepts a logo file that carries the brand's own name", () => {
    expect(
      brandLogoStatus(
        "Cipla",
        "https://commons.wikimedia.org/wiki/Special:FilePath/Cipla%20logo.svg?width=300",
      ),
    ).toBe("ok");
    expect(
      brandLogoStatus(
        "Volini",
        "https://volini.com/wp-content/themes/volini/dist/images/logo/volini-logo.webp",
      ),
    ).toBe("ok");
  });

  it("flags an image whose file name names a different brand", () => {
    // `revital` (a Shiseido product line) was left holding Shiseido's own
    // corporate logo by an older, looser resolver.
    expect(
      brandLogoStatus(
        "revital",
        "https://commons.wikimedia.org/wiki/Special:FilePath/Shiseido%20logo.svg?width=300",
      ),
    ).toBe("mismatch");
  });

  it("flags a generic file name even when the logo itself is fine", () => {
    // Mankind's own website serves its logo as a file called `logo.svg`. The
    // status is a prompt to re-check, and re-checking resolves it — the pipeline
    // keeps the image rather than replacing it with an invented one.
    expect(
      brandLogoStatus(
        "Mankind",
        "https://www.mankindpharma.com/wp-content/themes/mankind/assets/images/logos/logo.svg",
      ),
    ).toBe("mismatch");
  });

  it("treats a name with no distinctive word as ok", () => {
    expect(brandLogoStatus("The", "https://example.com/logo.svg")).toBe("ok");
  });
});
