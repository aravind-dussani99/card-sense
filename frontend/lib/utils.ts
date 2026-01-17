import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function padDateValue(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = padDateValue(date.getMonth() + 1);
  const day = padDateValue(date.getDate());
  return `${year}-${month}-${day}`;
}

export function getMonthToDateRange(): { from: string; to: string } {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: formatDateInput(startOfMonth),
    to: formatDateInput(today),
  };
}
