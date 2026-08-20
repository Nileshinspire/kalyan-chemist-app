// Minimal vitest setup for jsdom environment
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  // Clean up any DOM changes between tests
});
