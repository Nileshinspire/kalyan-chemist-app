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
    relatedOrders: [],
  },
];

vi.mock("convex/react", () => ({
  useQuery: () => prescriptions,
  useMutation: () => vi.fn().mockResolvedValue({ success: true }),
}));

import AccountPrescriptions from "@/pages/account/AccountPrescriptions";

describe("My Prescriptions", () => {
  it("shows every prescription with its status and rejection reason", () => {
    render(
      <MemoryRouter>
        <AccountPrescriptions />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /my prescriptions/i })).toBeTruthy();
    expect(screen.getByText("asha-rx.jpg")).toBeTruthy();
    expect(screen.getByText("old-rx.pdf")).toBeTruthy();
    expect(screen.getByText(/doctor signature is missing/i)).toBeTruthy();
    expect(screen.getByText("Doctor not provided")).toBeTruthy();
    expect(screen.getByText(/order INV-1001/i)).toBeTruthy();
    expect(screen.getByText(/valid until/i)).toBeTruthy();
  });

  it("offers view, download and re-upload actions", () => {
    render(
      <MemoryRouter>
        <AccountPrescriptions />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /upload new prescription/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^view$/i })).toHaveLength(2);

    const downloads = screen.getAllByRole("link", { name: /download/i });
    expect(downloads).toHaveLength(2);
    expect(downloads[1].getAttribute("download")).toBe("old-rx.pdf");

    const reupload = screen.getAllByRole("button", { name: /re-upload/i });
    expect(reupload).toHaveLength(1);
  });
});
