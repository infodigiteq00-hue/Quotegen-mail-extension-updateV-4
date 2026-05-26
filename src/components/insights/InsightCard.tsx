import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  INSIGHT_CATEGORY_LABELS,
  type BusinessInsight,
  type InsightCategory,
} from "@/lib/insights";
import {
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  MapPin,
  Minus,
  Package,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const CATEGORY_ICONS: Record<InsightCategory, typeof Package> = {
  top_products: Package,
  customer_patterns: RefreshCw,
  key_customers: Users,
  regional: MapPin,
  team_performance: Target,
  conversion: TrendingUp,
  pricing: Wallet,
  predictive: Lightbulb,
};

const CATEGORY_ACCENT: Record<InsightCategory, string> = {
  top_products: "from-blue-500/10 to-blue-500/5 border-blue-200/60",
  customer_patterns: "from-violet-500/10 to-violet-500/5 border-violet-200/60",
  key_customers: "from-emerald-500/10 to-emerald-500/5 border-emerald-200/60",
  regional: "from-amber-500/10 to-amber-500/5 border-amber-200/60",
  team_performance: "from-indigo-500/10 to-indigo-500/5 border-indigo-200/60",
  conversion: "from-teal-500/10 to-teal-500/5 border-teal-200/60",
  pricing: "from-rose-500/10 to-rose-500/5 border-rose-200/60",
  predictive: "from-primary/12 to-primary/5 border-primary/25",
};

const TrendBadge = ({ trend }: { trend?: BusinessInsight["trend"] }) => {
  if (!trend || trend === "neutral") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const up = trend === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
        up ? "text-emerald-600" : "text-amber-600"
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
    </span>
  );
};

export function InsightCard({ insight, featured }: { insight: BusinessInsight; featured?: boolean }) {
  const Icon = CATEGORY_ICONS[insight.category];
  const accent = CATEGORY_ACCENT[insight.category];

  return (
    <Card
      className={cn(
        "relative overflow-hidden border bg-gradient-to-br p-5 transition-shadow hover:shadow-md",
        accent,
        featured && "ring-1 ring-primary/20 shadow-glow"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary))_0%,transparent_50%)]"
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-background/80 border flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {INSIGHT_CATEGORY_LABELS[insight.category]}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {insight.metric && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">{insight.metric.label}</p>
              <p className="text-sm font-semibold tabular-nums">{insight.metric.value}</p>
            </div>
          )}
          <TrendBadge trend={insight.trend} />
        </div>
      </div>

      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
        {insight.title}
      </h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{insight.narrative}</p>

      {insight.actionHint && (
        <p className="text-xs text-primary/90 mt-3 pt-3 border-t border-border/60 font-medium">
          → {insight.actionHint}
        </p>
      )}
    </Card>
  );
}
