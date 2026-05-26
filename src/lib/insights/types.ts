/** Insight categories aligned with product spec — extensible for future AI features */
export type InsightCategory =
  | "top_products"
  | "customer_patterns"
  | "key_customers"
  | "regional"
  | "team_performance"
  | "conversion"
  | "pricing"
  | "predictive";

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  top_products: "Products",
  customer_patterns: "Buying patterns",
  key_customers: "Key accounts",
  regional: "Regional",
  team_performance: "Team",
  conversion: "Conversion",
  pricing: "Pricing",
  predictive: "Recommendations",
};

export type InsightTrend = "up" | "down" | "neutral";

export type InsightConfidence = "high" | "medium" | "low";

export interface BusinessInsight {
  id: string;
  category: InsightCategory;
  /** Short headline — scannable in 2 seconds */
  title: string;
  /** Business meaning — the advisor narrative */
  narrative: string;
  /** Higher = shown in primary dashboard (0–100) */
  priority: number;
  trend?: InsightTrend;
  metric?: { label: string; value: string };
  actionHint?: string;
  confidence: InsightConfidence;
}

export interface InsightsSnapshot {
  generatedAt: string;
  recordCount: number;
  primary: BusinessInsight[];
  more: BusinessInsight[];
  /** Quick pulse metrics for header strip */
  pulse: {
    pipelineValue: number;
    conversionRate: number;
    activeCustomers: number;
    quoteCount: number;
  };
}
