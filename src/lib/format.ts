export function getTodayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency ?? "INR",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function toHeadlineSourceLabel(source: string | null): string {
  if (!source) {
    return "Source unavailable";
  }

  try {
    const url = new URL(source.startsWith("http") ? source : `https://${source}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return source.replace(/^www\./, "");
  }
}

export function formatSummarySource(value: string | null): string {
  if (!value) {
    return "summary";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
