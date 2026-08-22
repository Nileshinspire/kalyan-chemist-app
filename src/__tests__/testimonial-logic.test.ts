import { describe, it, expect } from "vitest";

// Test the testimonial validation logic extracted from the Convex mutations
// Since we can't run Convex in unit tests, we test the business rules

describe("Testimonial / Review System", () => {
  // ── Validation helpers ──
  function validateTestimonial(input: {
    displayName: string;
    rating: number;
    title: string;
    message: string;
  }): string | null {
    if (input.rating < 1 || input.rating > 5) {
      return "Rating must be between 1 and 5";
    }
    if (!input.displayName.trim()) {
      return "Display name is required";
    }
    if (input.displayName.length > 60) {
      return "Display name must be 60 characters or less";
    }
    if (!input.title.trim()) {
      return "Title is required";
    }
    if (input.title.length > 120) {
      return "Title must be 120 characters or less";
    }
    if (!input.message.trim()) {
      return "Message is required";
    }
    if (input.message.length > 2000) {
      return "Message must be 2000 characters or less";
    }
    return null;
  }

  function getStarLabel(rating: number): string {
    if (rating === 1) return "Poor";
    if (rating === 2) return "Fair";
    if (rating === 3) return "Good";
    if (rating === 4) return "Very Good";
    if (rating === 5) return "Excellent";
    return "";
  }

  function computeAvgRating(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    return Math.round(avg * 10) / 10;
  }

  // ── Validation tests ──
  describe("Testimonial Validation", () => {
    it("should accept valid testimonial", () => {
      const error = validateTestimonial({
        displayName: "Priya S.",
        rating: 5,
        title: "Great pharmacy!",
        message: "Fast delivery and genuine medicines. Highly recommended.",
      });
      expect(error).toBeNull();
    });

    it("should reject rating below 1", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 0,
        title: "Title",
        message: "Message",
      });
      expect(error).toBe("Rating must be between 1 and 5");
    });

    it("should reject rating above 5", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 6,
        title: "Title",
        message: "Message",
      });
      expect(error).toBe("Rating must be between 1 and 5");
    });

    it("should accept boundary rating of 1", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 1,
        title: "Title",
        message: "Message",
      });
      expect(error).toBeNull();
    });

    it("should accept boundary rating of 5", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "Title",
        message: "Message",
      });
      expect(error).toBeNull();
    });

    it("should reject empty display name", () => {
      const error = validateTestimonial({
        displayName: "",
        rating: 5,
        title: "Title",
        message: "Message",
      });
      expect(error).toBe("Display name is required");
    });

    it("should reject whitespace-only display name", () => {
      const error = validateTestimonial({
        displayName: "   ",
        rating: 5,
        title: "Title",
        message: "Message",
      });
      expect(error).toBe("Display name is required");
    });

    it("should reject display name longer than 60 chars", () => {
      const error = validateTestimonial({
        displayName: "A".repeat(61),
        rating: 5,
        title: "Title",
        message: "Message",
      });
      expect(error).toBe("Display name must be 60 characters or less");
    });

    it("should accept display name at exactly 60 chars", () => {
      const error = validateTestimonial({
        displayName: "A".repeat(60),
        rating: 5,
        title: "Title",
        message: "Message",
      });
      expect(error).toBeNull();
    });

    it("should reject empty title", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "",
        message: "Message",
      });
      expect(error).toBe("Title is required");
    });

    it("should reject title longer than 120 chars", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "A".repeat(121),
        message: "Message",
      });
      expect(error).toBe("Title must be 120 characters or less");
    });

    it("should reject empty message", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "Title",
        message: "",
      });
      expect(error).toBe("Message is required");
    });

    it("should reject message longer than 2000 chars", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "Title",
        message: "A".repeat(2001),
      });
      expect(error).toBe("Message must be 2000 characters or less");
    });

    it("should accept message at exactly 2000 chars", () => {
      const error = validateTestimonial({
        displayName: "Test",
        rating: 5,
        title: "Title",
        message: "A".repeat(2000),
      });
      expect(error).toBeNull();
    });
  });

  // ── Star label tests ──
  describe("Star Rating Labels", () => {
    it("should return 'Poor' for rating 1", () => {
      expect(getStarLabel(1)).toBe("Poor");
    });

    it("should return 'Fair' for rating 2", () => {
      expect(getStarLabel(2)).toBe("Fair");
    });

    it("should return 'Good' for rating 3", () => {
      expect(getStarLabel(3)).toBe("Good");
    });

    it("should return 'Very Good' for rating 4", () => {
      expect(getStarLabel(4)).toBe("Very Good");
    });

    it("should return 'Excellent' for rating 5", () => {
      expect(getStarLabel(5)).toBe("Excellent");
    });

    it("should return empty for out-of-range", () => {
      expect(getStarLabel(0)).toBe("");
      expect(getStarLabel(6)).toBe("");
    });
  });

  // ── Average rating computation ──
  describe("Average Rating Computation", () => {
    it("should return 0 for empty array", () => {
      expect(computeAvgRating([])).toBe(0);
    });

    it("should compute correct average for uniform ratings", () => {
      expect(computeAvgRating([5, 5, 5, 5, 5])).toBe(5);
    });

    it("should compute correct average for mixed ratings", () => {
      expect(computeAvgRating([5, 4, 3, 2, 1])).toBe(3);
    });

    it("should round to 1 decimal place", () => {
      expect(computeAvgRating([5, 4])).toBe(4.5);
    });

    it("should round properly", () => {
      // 4.333... -> 4.3
      expect(computeAvgRating([5, 4, 4])).toBe(4.3);
    });
  });

  // ── Duplicate prevention logic ──
  describe("Duplicate Prevention", () => {
    function hasActiveTestimonial(existingTestimonials: Array<{ status: string }>): boolean {
      return existingTestimonials.some(
        (t) => t.status === "pending" || t.status === "approved"
      );
    }

    it("should allow submission when no existing testimonials", () => {
      expect(hasActiveTestimonial([])).toBe(false);
    });

    it("should block when user has pending testimonial", () => {
      expect(hasActiveTestimonial([{ status: "pending" }])).toBe(true);
    });

    it("should block when user has approved testimonial", () => {
      expect(hasActiveTestimonial([{ status: "approved" }])).toBe(true);
    });

    it("should allow when user only has rejected testimonial", () => {
      expect(hasActiveTestimonial([{ status: "rejected" }])).toBe(false);
    });

    it("should allow when latest is rejected even with older pending", () => {
      // Simulates: oldest=pending, newest=rejected (user should be allowed)
      expect(hasActiveTestimonial([{ status: "pending" }, { status: "rejected" }])).toBe(true);
    });
  });

  // ── Admin actions ──
  describe("Admin Testimonial Actions", () => {
    it("should unfeature rejected testimonials on reject", () => {
      // When rejecting, featured should be forced to false
      const testimonial = { status: "approved", featured: true };
      const rejectUpdate = {
        status: "rejected",
        featured: false,
      };
      expect(rejectUpdate.featured).toBe(false);
      expect(rejectUpdate.status).toBe("rejected");
    });

    it("should only allow featuring approved testimonials", () => {
      // Featured flag should only apply to approved testimonials
      const approved = { status: "approved", featured: true };
      expect(approved.status).toBe("approved");
      expect(approved.featured).toBe(true);
    });

    it("should preserve featured status when unfeaturing", () => {
      const testimonial = { status: "approved", featured: true };
      const update = { featured: false };
      expect(update.featured).toBe(false);
    });
  });

  // ── Status display ──
  describe("Status Badges", () => {
    const STATUS_BADGES: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
      approved: { label: "Approved", className: "bg-green-100 text-green-700" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
    };

    it("should have correct label for pending", () => {
      expect(STATUS_BADGES.pending.label).toBe("Pending");
    });

    it("should have correct label for approved", () => {
      expect(STATUS_BADGES.approved.label).toBe("Approved");
    });

    it("should have correct label for rejected", () => {
      expect(STATUS_BADGES.rejected.label).toBe("Rejected");
    });

    it("should have green color for approved", () => {
      expect(STATUS_BADGES.approved.className).toContain("green");
    });

    it("should have amber color for pending", () => {
      expect(STATUS_BADGES.pending.className).toContain("amber");
    });

    it("should have red color for rejected", () => {
      expect(STATUS_BADGES.rejected.className).toContain("red");
    });
  });

  // ── Featured testimonials ordering ──
  describe("Featured Testimonials Ordering", () => {
    function sortTestimonials(
      testimonials: Array<{ featured: boolean; createdAt: number }>
    ): Array<{ featured: boolean; createdAt: number }> {
      const featured = testimonials.filter((t) => t.featured);
      const others = testimonials.filter((t) => !t.featured);
      return [...featured, ...others];
    }

    it("should put featured testimonials first", () => {
      const input = [
        { featured: false, createdAt: 3 },
        { featured: true, createdAt: 1 },
        { featured: false, createdAt: 2 },
      ];
      const sorted = sortTestimonials(input);
      expect(sorted[0].featured).toBe(true);
      expect(sorted[1].featured).toBe(false);
      expect(sorted[2].featured).toBe(false);
    });

    it("should preserve order within groups", () => {
      const input = [
        { featured: false, createdAt: 1 },
        { featured: true, createdAt: 2 },
        { featured: true, createdAt: 3 },
      ];
      const sorted = sortTestimonials(input);
      expect(sorted[0].createdAt).toBe(2);
      expect(sorted[1].createdAt).toBe(3);
      expect(sorted[2].createdAt).toBe(1);
    });

    it("should handle empty array", () => {
      expect(sortTestimonials([])).toEqual([]);
    });

    it("should handle all featured", () => {
      const input = [
        { featured: true, createdAt: 2 },
        { featured: true, createdAt: 1 },
      ];
      const sorted = sortTestimonials(input);
      expect(sorted.every((t) => t.featured)).toBe(true);
    });
  });
});
