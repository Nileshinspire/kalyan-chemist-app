import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router";
import {
  beginProductTransition,
  useProductTransitionVeil,
} from "@/lib/product-transition";

const veilOn = () =>
  document.documentElement.classList.contains("product-transition");

/** Stands in for the app shell: opens the veil on click, lifts it on commit. */
function Listing() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        beginProductTransition();
        navigate("/products/dolo-650");
      }}
    >
      open
    </button>
  );
}

function ProductPage() {
  return <div>product page</div>;
}

function App() {
  useProductTransitionVeil();
  return (
    <Routes>
      <Route path="/" element={<Listing />} />
      <Route path="/products/:slug" element={<ProductPage />} />
    </Routes>
  );
}

describe("product navigation transition veil", () => {
  beforeEach(() => {
    document.documentElement.className = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.className = "";
  });

  it("is closed before any product navigation starts", () => {
    expect(veilOn()).toBe(false);
  });

  it("hides the previous page the moment a product click starts", () => {
    beginProductTransition();
    expect(veilOn()).toBe(true);
  });

  it("lifts the veil once the product route commits", async () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(getByText("open"));

    // The committed route is on screen and the old page is no longer veiled.
    expect(getByText("product page")).toBeTruthy();
    expect(veilOn()).toBe(false);
  });

  it("lifts the veil on a fallback timer when no navigation commits", () => {
    vi.useFakeTimers();
    beginProductTransition();
    expect(veilOn()).toBe(true);

    vi.advanceTimersByTime(10_000);

    expect(veilOn()).toBe(false);
  });

  it("leaves the veil closed for navigation that never started a product transition", () => {
    // Nothing armed the veil, so a plain render/commit must not leave one open.
    render(
      <MemoryRouter initialEntries={["/products/dolo-650"]}>
        <App />
      </MemoryRouter>,
    );
    expect(veilOn()).toBe(false);
  });
});
