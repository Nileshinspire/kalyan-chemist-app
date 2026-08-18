import { Doc } from "convex/_generated/dataModel";

/**
 * Check if the current user is an admin
 */
export function isAdmin(user: Doc<"users"> | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Check if the current user is a customer
 */
export function isCustomer(user: Doc<"users"> | null | undefined): boolean {
  return user?.role === "customer" || !user?.role;
}

/**
 * Get user display name or fallback
 */
export function getDisplayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "User";
  return user.name || user.email?.split("@")[0] || "User";
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user: Doc<"users"> | null | undefined): string {
  if (!user?.name) return "U";
  const names = user.name.split(" ");
  if (names.length >= 2) {
    return (names[0][0] + names[1][0]).toUpperCase();
  }
  return names[0][0].toUpperCase();
}

/**
 * Format currency (Indian Rupees)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
