import { format, formatDistanceToNowStrict } from "date-fns";

/** Prices are stored in minor units (paise). */
export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

export function formatDate(ms: number): string {
  return format(new Date(ms), "EEE, MMM d, yyyy");
}

export function formatDateTime(ms: number): string {
  return format(new Date(ms), "MMM d, yyyy · h:mm a");
}

export function formatRelative(ms: number): string {
  return formatDistanceToNowStrict(new Date(ms), { addSuffix: true });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Human labels for order statuses. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};
