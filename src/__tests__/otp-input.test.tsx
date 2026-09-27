import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { normalizeIndianPhone } from "@/lib/phone";

/** Controlled harness so the component sees the value flow a real page gives it. */
function Harness({
  onComplete,
  autoFocus = false,
}: {
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <OtpInput
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      autoFocus={autoFocus}
    />
  );
}

function boxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("[data-otp-input]"));
}

describe("OtpInput", () => {
  it("renders six digit boxes with positional labels", () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
    expect(
      screen.getByLabelText("Verification code, digit 1 of 6"),
    ).toBeInTheDocument();
  });

  it("exposes a numeric keypad and SMS autofill on mobile", () => {
    render(<Harness />);
    const all = boxes();
    expect(all[0].getAttribute("inputmode")).toBe("numeric");
    expect(all[0].getAttribute("autocomplete")).toBe("one-time-code");
    expect(all.every((box) => box.getAttribute("maxlength") === "1")).toBe(true);
  });

  it("advances to the next box as digits are typed", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.change(all[0], { target: { value: "1" } });
    expect(all[0].value).toBe("1");
    fireEvent.change(all[1], { target: { value: "2" } });
    expect(all[1].value).toBe("2");
  });

  it("keeps only the last digit when two are typed into one box", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.change(all[0], { target: { value: "12" } });
    expect(all[0].value).toBe("2");
  });

  it("strips non-numeric input", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.change(all[0], { target: { value: "a" } });
    expect(all[0].value).toBe("");
  });

  it("moves back and clears the previous box on Backspace", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.change(all[0], { target: { value: "1" } });
    fireEvent.change(all[1], { target: { value: "2" } });

    fireEvent.keyDown(all[1], { key: "Backspace" });
    // Box 1 is now empty, so Backspace steps back and clears box 0.
    expect(all[1].value).toBe("");
    fireEvent.keyDown(all[1], { key: "Backspace" });
    expect(all[0].value).toBe("");
  });

  it("fills every box when a full code is pasted", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.paste(all[0], {
      clipboardData: { getData: () => "123456" },
    });
    expect(all.map((box) => box.value).join("")).toBe("123456");
  });

  it("ignores non-numeric characters in a paste", () => {
    render(<Harness />);
    const all = boxes();
    fireEvent.paste(all[0], {
      clipboardData: { getData: () => "12-34 56" },
    });
    expect(all.map((box) => box.value).join("")).toBe("123456");
  });

  it("fires onComplete exactly once when the last digit lands", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const all = boxes();
    "123456".split("").forEach((digit, index) => {
      fireEvent.change(all[index], { target: { value: digit } });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("does not fire onComplete for an incomplete code", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const all = boxes();
    fireEvent.change(all[0], { target: { value: "1" } });
    fireEvent.change(all[1], { target: { value: "2" } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("marks boxes as invalid for assistive tech", () => {
    render(
      <OtpInput value="" onChange={() => {}} invalid labelledBy="x" />,
    );
    expect(boxes()[0]).toHaveAttribute("aria-invalid", "true");
  });
});

describe("normalizeIndianPhone", () => {
  it("normalises the formats a customer may type", () => {
    expect(normalizeIndianPhone("9876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("919876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("+919876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("98765 43210")).toBe("+919876543210");
  });

  it("rejects values that are not usable numbers", () => {
    expect(normalizeIndianPhone("")).toBeNull();
    expect(normalizeIndianPhone("12345")).toBeNull();
  });
});
