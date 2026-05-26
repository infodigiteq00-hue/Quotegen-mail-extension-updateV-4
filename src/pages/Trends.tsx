import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { InsightsDashboard } from "@/components/insights/InsightsDashboard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Trends() {
  return (
    <AppShell>
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-primary/5 text-[11px] text-primary mb-3">
              <Sparkles className="h-3 w-3" />
              AI business advisor
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Trends &amp; Insights</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg leading-relaxed">
              Commercial intelligence from your quotations — what sells, who matters, where growth is
              happening, and what to do next. Readable in under a minute.
            </p>
          </div>
          <Link to="/records">
            <Button variant="outline" size="sm">
              View records <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </header>

        <InsightsDashboard />
      </main>
    </AppShell>
  );
}
