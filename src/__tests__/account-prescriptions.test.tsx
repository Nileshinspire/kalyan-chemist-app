import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const now = Date.now();

const prescriptions = [
  {
    _id: "rx-approved",
    userId: "user1",
    patientName: "Asha",
    doctorName: "Rao",
    prescriptionDate: now - 5 * 24 * 60 * 60 * 1000,
    createdAt: now - 4 * 24 * 60 * 60 * 1000,
    fileName: "asha-rx.jpg",
    fileType: "image/jpeg",
    fileSize: 12345,
    status: "approved",
    auditLog: "[]",
    fileUrl: "https://files.example/asha-rx.jpg",
    expiresAt: now + 100 * 24 * 60 * 60 * 1000,
    expired: false,
    relatedOrders: [
      {
        _id: "order-123456",
        invoiceNumber: "INV-1001",
        status: "delivered",
        createdAt: now,
      },
    ],
  },
  {
    _id: "rx-rejected",
    userId: "user1",
    patientName: "Asha",
    doctorName: undefined,
    prescriptionDate: undefined,
    createdAt: now - 2 * 24 * 60 * 60 * 1000,
    fileName: "old-rx.pdf",
    fileType: "application/pdf",
    fileSize: 54321,
    status: "rejected",
    rejectionReason: "Doctor signature is missing",
    auditLog: "[]",
    fileUrl: "https://files.example/old-rx.pdf",
    expiresAt: now + 100 * 24 * 60 * 60 * 1000,
    expired: false,
    relatedOrders: [],
  },
];

let mockRows: typeof prescriptions = prescriptions;

vi.mock("convex/react", () => ({
  useQuery: () => mockRows,
  useMutation: () => vi.fn().mockResolvedValue({ success: true }),
}));

import AccountPrescriptions from "@/pages/account/AccountPrescriptions";

const renderPage = () =>
  render(
    <MemoryRouter>
      <AccountPrescriptions />
    </MemoryRouter>,
  );

describe("My Prescriptions (history)", () => {
  it("shows every uploaded prescription with status, fields and order id", () => {
    mockRows = prescriptions;
    renderPage();

    expect(screen.getByRole("heading", { name: /my prescriptions/i })).toBeTruthy();
    expect(screen.getByText("asha-rx.jpg")).toBeTruthy();
    expect(screen.getByText("old-rx.pdf")).toBeTruthy();

    // Statuses are the three customer-facing states (the summary tiles repeat
    // the label, so at least one badge each must be present).
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);

    expect(screen.getByText(/doctor signature is missing/i)).toBeTruthy();
    expect(screen.getByText("Doctor not provided")).toBeTruthy();
    expect(screen.getByText(/rx date: not provided/i)).toBeTruthy();
    expect(screen.getAllByText(/uploaded:/i)).toHaveLength(2);
    expect(screen.getAllByText("Asha")).toHaveLength(2);
    expect(screen.getByText(/order INV-1001/i)).toBeTruthy();
  });

  it("offers view and download but no upload affordance", () => {
    mockRows = prescriptions;
    const { container } = renderPage();

    expect(screen.getAllByRole("button", { name: /^view$/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /download/i })).toHaveLength(2);

    // No upload button, no upload form, no file input anywhere on the page.
    expect(screen.queryByRole("button", { name: /upload/i })).toBeNull();
    expect(screen.queryByText(/upload prescription/i)).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/upload your first prescription/i)).toBeNull();
  });

  it("shows only the clean empty state when nothing has been uploaded", () => {
    mockRows = [];
    const { container } = renderPage();

    expect(screen.getByText("No prescriptions uploaded yet.")).toBeTruthy();
    expect(
      screen.getByText("Your uploaded prescriptions will appear here."),
    ).toBeTruthy();

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
