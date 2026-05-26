import { useMemo, useState } from "react";
import { InsightCard } from "./InsightCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeBusinessInsights } from "@/lib/insights";
import { formatCurrency } from "@/lib/workflow";
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, Users, FileText } from "lucide-react";

export function InsightsDashboard() {
  const snapshot = useMemo(() => computeBusinessInsights(), []);
  const [showMore, setShowMore] = useState(false);

  const { primary, more, pulse } = snapshot;

  return (
    <div className="space-y-8">
      {/* Pulse strip — glanceable in 5 seconds */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border bg-card/90 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pipeline</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{formatCurrency(pulse.pipelineValue)}</p>
            </div>
            <TrendingUp className="h-4 w-4 text-primary/50" />
          </div>
        </Card>
        <Card className="p-4 border bg-card/90 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win rate</p>
              <p className="text-xl font-semibold mt-1 tabular-nums text-emerald-600">{pulse.conversionRate}%</p>
            </div>
            <Sparkles className="h-4 w-4 text-primary/50" />
          </div>
        </Card>
        <Card className="p-4 border bg-card/90 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active accounts</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{pulse.activeCustomers}</p>
            </div>
            <Users className="h-4 w-4 text-primary/50" />
          </div>
        </Card>
        <Card className="p-4 border bg-card/90 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quotations</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{pulse.quoteCount}</p>
            </div>
            <FileText className="h-4 w-4 text-primary/50" />
          </div>
        </Card>
      </div>

      {/* Primary insights — max 6 */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold">What matters right now</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {primary.length} prioritized insight{primary.length !== 1 ? "s" : ""} from your quotation history
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {primary.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} featured={i === 0} />
          ))}
        </div>
      </section>

      {/* Expandable additional insights */}
      {more.length > 0 && (
        <section>
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed h-10 text-muted-foreground hover:text-foreground"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? (
              <>
                Hide additional insights <ChevronUp className="h-4 w-4 ml-1.5" />
              </>
            ) : (
              <>
                View {more.length} more insight{more.length !== 1 ? "s" : ""}{" "}
                <ChevronDown className="h-4 w-4 ml-1.5" />
              </>
            )}
          </Button>

          {showMore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {more.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-[11px] text-center text-muted-foreground">
        Insights refresh from your quotation records · grounded in commercial data, not estimates
      </p>
    </div>
  );
}
