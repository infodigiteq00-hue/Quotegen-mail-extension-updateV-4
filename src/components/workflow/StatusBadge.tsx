import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type QuotationStatus } from "@/lib/workflow";

export function StatusBadge({ status, className }: { status: QuotationStatus | string; className?: string }) {
  const key = status as QuotationStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        STATUS_COLORS[key] || "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      {STATUS_LABELS[key] || status.replace(/_/g, " ")}
    </span>
  );
}
