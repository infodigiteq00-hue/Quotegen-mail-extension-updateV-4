import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/workflow";
import { TrendingUp, FileText, CheckCircle, Clock, IndianRupee } from "lucide-react";

export function DashboardMetrics({
  metrics,
}: {
  metrics: {
    totalQuotations: number;
    approvalRatio: number;
    convertedInvoices: number;
    pendingQuotations: number;
    totalQuotedValue: number;
    monthlyConversionValue: number;
  };
}) {
  const cards = [
    { label: "Quotations", value: metrics.totalQuotations, icon: FileText, sub: "all time" },
    { label: "Approval ratio", value: `${metrics.approvalRatio}%`, icon: CheckCircle, sub: "approved / converted" },
    { label: "Converted invoices", value: metrics.convertedInvoices, icon: TrendingUp, sub: "downstream docs" },
    { label: "Pending", value: metrics.pendingQuotations, icon: Clock, sub: "active pipeline" },
    { label: "Total quoted", value: formatCurrency(metrics.totalQuotedValue), icon: IndianRupee, sub: "pipeline value" },
    { label: "This month", value: formatCurrency(metrics.monthlyConversionValue), icon: TrendingUp, sub: "new quotes value" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
      {cards.map((c) => (
        <Card key={c.label} className="p-4 border bg-card/80 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
            <c.icon className="h-4 w-4 text-primary/60 shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}
