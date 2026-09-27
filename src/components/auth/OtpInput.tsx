import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface OtpInputProps {
  /** Current code value, controlled by the parent. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once every box is filled, so the parent can verify immediately. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  /** Id of the element labelling this group, for screen readers. */
  labelledBy?: string;
  autoFocus?: boolean;
}

/**
 * Six-box one-time-code input.
 *
 * Built from individual inputs (rather than one overlaid field) so each box is
 * a real, focusable control: assistive tech announces the group and position,
 * and mobile browsers raise the numeric keypad through inputMode.
 *
 * Behaviour: the first box focuses on mount, typing advances, Backspace on an
 * empty box steps back and clears it, and pasting a full code fills every box.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  label = "Verification code",
  labelledBy,
  autoFocus = true,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  // Mirror external resets (wrong code / changed identifier) back into the boxes.
  useEffect(() => {
    const inputs = inputsRef.current;
    for (let index = 0; index < length; index++) {
      const el = inputs[index];
      if (!el) continue;
      const expected = value[index] ?? "";
      if (el.value !== expected) el.value = expected;
    }
  }, [value, length]);

  const focusBox = (index: number) => {
    const el = inputsRef.current[index];
    if (!el) return;
    el.focus();
    el.select();
  };

  /** Replace the character at `index`, trimming any gap left behind. */
  const setDigit = (index: number, digit: string) => {
    const chars = value.split("");
    if (digit) chars[index] = digit;
    else chars[index] = "";
    return chars.join("").slice(0, length);
  };

  const handleChange = (index: number, raw: string) => {
    // Keep only the last digit typed, so a fast double-keystroke can't overflow.
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = setDigit(index, digit);
    onChange(next);

    if (digit) {
      if (index < length - 1) focusBox(index + 1);
      if (next.length === length) onComplete?.(next);
      return;
    }

    // Rejecting the character leaves the DOM input holding it while the value
    // prop is unchanged, so the sync effect would not re-run to clear it.
    // Blank the element directly.
    const el = inputsRef.current[index];
    if (el && el.value !== "") el.value = "";
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace") {
      // Clear this box when it holds a digit; otherwise step back and clear
      // the previous one, which is what users expect from a segmented field.
      if (value[index]) {
        onChange(setDigit(index, ""));
        return;
      }
      if (index > 0) {
        event.preventDefault();
        onChange(setDigit(index - 1, ""));
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusBox(index + 1);
      return;
    }

    if (event.key === "Enter" && value.length === length) {
      event.preventDefault();
      onComplete?.(value);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    if (pasted.length === length) onComplete?.(pasted);
    focusBox(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : `${label}, ${length} digits`}
      onPaste={handlePaste}
      className="flex items-center justify-center gap-2 sm:gap-2.5"
    >
      {Array.from({ length }).map((_, index) => {
        const filled = Boolean(value[index]);
        return (
          <input
            key={index}
            data-otp-input={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            // one-time-code on the first box lets iOS/Android offer SMS autofill.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={1}
            disabled={disabled}
            aria-label={`${label}, digit ${index + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              "h-12 w-12 rounded-xl border bg-white/[0.04] text-center text-lg font-semibold text-emerald-50",
              "transition-all duration-150 ease-out sm:h-14 sm:w-14 sm:text-xl",
              "focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-2 focus:ring-offset-emerald-950",
              "disabled:cursor-not-allowed disabled:opacity-60",
              invalid
                ? "border-red-400/70 focus:ring-red-400/60"
                : filled
                  ? "border-emerald-400/50"
                  : "border-white/15 focus:border-emerald-400/60",
            )}
          />
        );
      })}
    </div>
  );
}
