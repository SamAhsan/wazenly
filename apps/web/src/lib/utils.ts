import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date, pattern = "MMM d, yyyy"): string {
  return format(new Date(date), pattern);
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy HH:mm");
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    CONNECTED: "bg-green-100 text-green-700",
    DISCONNECTED: "bg-red-100 text-red-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    RUNNING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    DRAFT: "bg-gray-100 text-gray-700",
    SCHEDULED: "bg-purple-100 text-purple-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    ACTIVE: "bg-green-100 text-green-700",
    INACTIVE: "bg-gray-100 text-gray-700",
    OPEN: "bg-blue-100 text-blue-700",
    RESOLVED: "bg-green-100 text-green-700",
    BOT: "bg-purple-100 text-purple-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
