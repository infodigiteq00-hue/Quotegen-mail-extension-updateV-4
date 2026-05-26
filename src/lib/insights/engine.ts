import { lineTotal } from "../quotation";
import type { QuotationItem } from "../quotation";
import type { QuotationRecordRow, QuotationStatus } from "../workflow";
import type { BusinessInsight, InsightsSnapshot } from "./types";

const MS_DAY = 86400000;
const PRIMARY_COUNT = 6;

const WON_STATUSES: QuotationStatus[] = [
  "approved",
  "converted_to_po",
  "converted_to_invoice",
  "closed",
];

const isWon = (s: QuotationStatus) => WON_STATUSES.includes(s);

const parseDate = (iso: string) => new Date(iso).getTime();

const daysBetween = (a: string, b: string) =>
  Math.round(Math.abs(parseDate(a) - parseDate(b)) / MS_DAY);

const extractRegion = (address: string): string => {
  if (!address?.trim()) return "Unknown";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0] || "Unknown";
};

const extractCity = (address: string): string => {
  if (!address?.trim()) return "Unknown";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[0] || "Unknown";
};

interface LineRow {
  product: string;
  category: string;
  value: number;
  qty: number;
  discount: number;
  unitPrice: number;
  company: string;
  recordId: string;
  status: QuotationStatus;
  createdAt: string;
  won: boolean;
}

const flattenLines = (records: QuotationRecordRow[]): LineRow[] => {
  const rows: LineRow[] = [];
  for (const r of records) {
    for (const it of r.quotation_data?.items || []) {
      const item = it as QuotationItem;
      rows.push({
        product: item.item_name || "Unnamed",
        category: item.group || "General",
        value: lineTotal(item),
        qty: item.qty || 0,
        discount: item.discount || 0,
        unitPrice: item.unit_price || 0,
        company: r.client?.company_name || "Unknown",
        recordId: r.id,
        status: r.status,
        createdAt: r.created_at,
        won: isWon(r.status),
      });
    }
  }
  return rows;
};

const recentCutoff = (days: number) => Date.now() - days * MS_DAY;

// ─── Analyzers ───────────────────────────────────────────────────────────────

function analyzeTopProducts(records: QuotationRecordRow[], lines: LineRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  if (!lines.length) return insights;

  const byCategory = new Map<string, { value: number; count: number; recent: number; prior: number }>();
  const byProduct = new Map<string, { value: number; count: number; companies: Set<string> }>();
  const cutoff90 = recentCutoff(90);
  const cutoff180 = recentCutoff(180);

  for (const l of lines) {
    const cat = byCategory.get(l.category) || { value: 0, count: 0, recent: 0, prior: 0 };
    cat.value += l.value;
    cat.count += 1;
    const t = parseDate(l.createdAt);
    if (t >= cutoff90) cat.recent += l.value;
    else if (t >= cutoff180) cat.prior += l.value;
    byCategory.set(l.category, cat);

    const prod = byProduct.get(l.product) || { value: 0, count: 0, companies: new Set() };
    prod.value += l.value;
    prod.count += 1;
    prod.companies.add(l.company);
    byProduct.set(l.product, prod);
  }

  const totalValue = lines.reduce((s, l) => s + l.value, 0);
  const topCat = [...byCategory.entries()].sort((a, b) => b[1].value - a[1].value)[0];
  if (topCat && totalValue > 0) {
    const pct = Math.round((topCat[1].value / totalValue) * 100);
    if (pct >= 20) {
      insights.push({
        id: "prod-top-category",
        category: "top_products",
        title: `${topCat[0]} leads your quoted portfolio`,
        narrative: `${topCat[0]} generated ${pct}% of total quoted line value across your pipeline — making it one of your strongest commercial categories.`,
        priority: 72 + Math.min(pct, 20),
        trend: topCat[1].recent > topCat[1].prior ? "up" : "neutral",
        metric: { label: "Share of value", value: `${pct}%` },
        confidence: records.length >= 3 ? "high" : "medium",
      });
    }
  }

  const growing = [...byCategory.entries()]
    .filter(([, v]) => v.prior > 0 && v.recent > v.prior * 1.2)
    .sort((a, b) => b[1].recent / b[1].prior - a[1].recent / a[1].prior)[0];
  if (growing) {
    const growthPct = Math.round(((growing[1].recent - growing[1].prior) / growing[1].prior) * 100);
    insights.push({
      id: "prod-growing-category",
      category: "top_products",
      title: `${growing[0]} inquiry momentum is rising`,
      narrative: `${growing[0]} showed roughly ${growthPct}% higher quoted value in recent months compared to the prior period — an emerging category worth prioritizing.`,
      priority: 68,
      trend: "up",
      metric: { label: "Growth signal", value: `+${growthPct}%` },
      actionHint: "Consider stocking or pre-negotiating supply for this category.",
      confidence: "medium",
    });
  }

  const repeatConsumable = [...byProduct.entries()]
    .filter(([, v]) => v.companies.size >= 2 && v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)[0];
  if (repeatConsumable) {
    insights.push({
      id: "prod-repeat-item",
      category: "top_products",
      title: `${repeatConsumable[0]} is a repeat-order favourite`,
      narrative: `${repeatConsumable[0]} appears across multiple customer quotations — a strong signal it behaves like a consumable or standard reorder item.`,
      priority: 58,
      trend: "neutral",
      confidence: "medium",
    });
  }

  const slowCat = [...byCategory.entries()]
    .filter(([, v]) => v.count >= 1)
    .sort((a, b) => a[1].value - b[1].value)[0];
  const fastCat = topCat;
  if (slowCat && fastCat && slowCat[0] !== fastCat[0] && records.length >= 4) {
    insights.push({
      id: "prod-slow-category",
      category: "top_products",
      title: `${slowCat[0]} needs commercial attention`,
      narrative: `${slowCat[0]} contributes the least quoted value in your current pipeline — review pricing, positioning, or whether this category still fits your focus.`,
      priority: 42,
      trend: "down",
      actionHint: "Review margin and inquiry sources for underperforming categories.",
      confidence: "low",
    });
  }

  return insights;
}

function analyzeCustomerPatterns(records: QuotationRecordRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const byCompany = new Map<string, QuotationRecordRow[]>();
  for (const r of records) {
    const name = r.client?.company_name || "Unknown";
    const list = byCompany.get(name) || [];
    list.push(r);
    byCompany.set(name, list);
  }

  for (const [company, quotes] of byCompany) {
    if (quotes.length < 2) continue;
    const sorted = [...quotes].sort((a, b) => parseDate(a.created_at) - parseDate(b.created_at));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i].created_at, sorted[i - 1].created_at));
    }
    const avgGap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    if (avgGap >= 14 && avgGap <= 120) {
      insights.push({
        id: `cust-cycle-${company}`,
        category: "customer_patterns",
        title: `${company} follows a predictable reorder rhythm`,
        narrative: `${company} typically places repeat quotations every ${avgGap} days on average — useful for proactive follow-ups before the next buying window.`,
        priority: 65,
        metric: { label: "Avg reorder cycle", value: `${avgGap} days` },
        actionHint: "Schedule a check-in before the expected reorder window.",
        confidence: quotes.length >= 3 ? "high" : "medium",
      });
    }

    const recent = sorted.filter((q) => parseDate(q.created_at) >= recentCutoff(180));
    const older = sorted.filter((q) => parseDate(q.created_at) < recentCutoff(180));
    if (recent.length && older.length) {
      const recentAvg = recent.reduce((s, q) => s + Number(q.total_amount), 0) / recent.length;
      const olderAvg = older.reduce((s, q) => s + Number(q.total_amount), 0) / older.length;
      if (olderAvg > 0) {
        const change = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
        if (change >= 15) {
          insights.push({
            id: `cust-aov-${company}`,
            category: "customer_patterns",
            title: `${company} is increasing order value`,
            narrative: `${company} has raised average quotation value by ${change}% in recent activity — a sign of deepening engagement or larger project scope.`,
            priority: 70,
            trend: "up",
            metric: { label: "AOV change", value: `+${change}%` },
            confidence: "medium",
          });
        }
      }
    }

    const emergency = quotes.filter(
      (q) =>
        /emergency|urgent|rush|immediate/i.test(q.subject || "") ||
        /emergency|urgent/i.test(q.quotation_data?.terms?.delivery_timeline || "")
    );
    if (emergency.length >= 1) {
      insights.push({
        id: `cust-emergency-${company}`,
        category: "customer_patterns",
        title: `${company} frequently needs fast turnaround`,
        narrative: `${company} has ${emergency.length} quotation${emergency.length > 1 ? "s" : ""} flagged for urgent or emergency delivery — consider offering express terms or dedicated stock for this account.`,
        priority: 55,
        actionHint: "Pre-agree expedited delivery terms for faster conversions.",
        confidence: "medium",
      });
    }
  }

  return insights;
}

function analyzeKeyCustomers(records: QuotationRecordRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  if (!records.length) return insights;

  const byCompany = new Map<string, number>();
  for (const r of records) {
    const name = r.client?.company_name || "Unknown";
    byCompany.set(name, (byCompany.get(name) || 0) + Number(r.total_amount));
  }

  const ranked = [...byCompany.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  const top3 = ranked.slice(0, 3);
  const top3Share = total > 0 ? Math.round((top3.reduce((s, [, v]) => s + v, 0) / total) * 100) : 0;

  if (top3.length >= 2 && top3Share >= 50) {
    insights.push({
      id: "cust-concentration",
      category: "key_customers",
      title: `${top3.length} customers drive most of your pipeline`,
      narrative: `${top3.map(([n]) => n).join(", ")} contribute ${top3Share}% of your total quoted value — focus relationship management on these accounts.`,
      priority: 78,
      metric: { label: "Top accounts share", value: `${top3Share}%` },
      confidence: "high",
    });
  }

  const recentCut = recentCutoff(60);
  const growthCandidates = ranked
    .map(([name, value]) => {
      const companyRecords = records.filter((r) => r.client?.company_name === name);
      const recent = companyRecords.filter((r) => parseDate(r.created_at) >= recentCut);
      const prior = companyRecords.filter((r) => parseDate(r.created_at) < recentCut);
      const recentVal = recent.reduce((s, r) => s + Number(r.total_amount), 0);
      const priorVal = prior.reduce((s, r) => s + Number(r.total_amount), 0);
      return { name, value, recentVal, priorVal, recentCount: recent.length };
    })
    .filter((c) => c.recentCount >= 1 && c.recentVal > c.priorVal)
    .sort((a, b) => b.recentVal - a.recentVal)[0];

  if (growthCandidates && growthCandidates.recentVal > 0) {
    insights.push({
      id: "cust-fast-growing",
      category: "key_customers",
      title: `${growthCandidates.name} is gaining momentum`,
      narrative: `${growthCandidates.name} has become one of your more active accounts recently, with fresh quotations adding to pipeline value.`,
      priority: 74,
      trend: "up",
      confidence: "medium",
    });
  }

  const dormant = ranked
    .map(([name]) => {
      const companyRecords = records.filter((r) => r.client?.company_name === name);
      const last = companyRecords.sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at))[0];
      const daysSince = last ? Math.round((Date.now() - parseDate(last.created_at)) / MS_DAY) : 0;
      const historical = companyRecords.reduce((s, r) => s + Number(r.total_amount), 0);
      return { name, daysSince, historical, lastStatus: last?.status };
    })
    .filter((d) => d.daysSince >= 60 && d.historical > 0)
    .sort((a, b) => b.historical - a.historical)[0];

  if (dormant) {
    insights.push({
      id: "cust-dormant",
      category: "key_customers",
      title: `${dormant.name} hasn't quoted in ${dormant.daysSince}+ days`,
      narrative: `${dormant.name} was historically active but has had no new quotations in over ${dormant.daysSince} days — a high-potential account to re-engage.`,
      priority: 76,
      trend: "down",
      actionHint: "Send a check-in or share relevant product updates.",
      confidence: "high",
    });
  }

  return insights;
}

function analyzeRegional(records: QuotationRecordRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const byRegion = new Map<string, { value: number; count: number; cities: Set<string> }>();
  const byCity = new Map<string, { value: number; count: number }>();

  for (const r of records) {
    const region = extractRegion(r.client?.address || "");
    const city = extractCity(r.client?.address || "");
    const amt = Number(r.total_amount);
    const reg = byRegion.get(region) || { value: 0, count: 0, cities: new Set() };
    reg.value += amt;
    reg.count += 1;
    reg.cities.add(city);
    byRegion.set(region, reg);
    const c = byCity.get(city) || { value: 0, count: 0 };
    c.value += amt;
    c.count += 1;
    byCity.set(city, c);
  }

  const topRegion = [...byRegion.entries()].sort((a, b) => b[1].value - a[1].value)[0];
  if (topRegion && records.length >= 2) {
    const total = records.reduce((s, r) => s + Number(r.total_amount), 0);
    const pct = total > 0 ? Math.round((topRegion[1].value / total) * 100) : 0;
    insights.push({
      id: "reg-top-zone",
      category: "regional",
      title: `${topRegion[0]} is your strongest industrial zone`,
      narrative: `Quotations linked to ${topRegion[0]} (${[...topRegion[1].cities].slice(0, 3).join(", ")}) represent ${pct}% of pipeline value — your core geographic market.`,
      priority: 64,
      metric: { label: "Regional share", value: `${pct}%` },
      confidence: byRegion.size >= 2 ? "high" : "medium",
    });
  }

  const topCities = [...byCity.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 2);
  if (topCities.length >= 2) {
    insights.push({
      id: "reg-city-density",
      category: "regional",
      title: `${topCities[0][0]} and ${topCities[1][0]} lead inquiry density`,
      narrative: `Most quotation activity clusters around ${topCities[0][0]} and ${topCities[1][0]} — consider regional stocking or local service partnerships.`,
      priority: 52,
      confidence: "medium",
    });
  }

  return insights;
}

function analyzeTeamPerformance(records: QuotationRecordRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const byRep = new Map<string, { total: number; won: number; count: number; values: number[] }>();

  for (const r of records) {
    const rep = r.prepared_by || "Unassigned";
    const row = byRep.get(rep) || { total: 0, won: 0, count: 0, values: [] };
    row.total += Number(r.total_amount);
    row.count += 1;
    row.values.push(Number(r.total_amount));
    if (isWon(r.status)) row.won += 1;
    byRep.set(rep, row);
  }

  const repStats = [...byRep.entries()]
    .filter(([, v]) => v.count >= 1)
    .map(([name, v]) => ({
      name,
      conversion: v.count ? Math.round((v.won / v.count) * 100) : 0,
      avgDeal: v.count ? Math.round(v.total / v.count) : 0,
      count: v.count,
      won: v.won,
    }));

  const topConverter = [...repStats].filter((r) => r.won > 0).sort((a, b) => b.conversion - a.conversion)[0];
  if (topConverter && topConverter.won >= 1) {
    insights.push({
      id: "team-top-converter",
      category: "team_performance",
      title: `${topConverter.name} leads on quotation conversions`,
      narrative: `Quotations prepared by ${topConverter.name} show the strongest win rate (${topConverter.conversion}% conversion) — a useful benchmark for sharing best practices across the team.`,
      priority: 60,
      trend: "up",
      metric: { label: "Win rate", value: `${topConverter.conversion}%` },
      confidence: repStats.length >= 2 ? "medium" : "low",
    });
  }

  const highValueThreshold = 500000;
  const highValue = records.filter((r) => Number(r.total_amount) >= highValueThreshold);
  const highValueWon = highValue.filter((r) => isWon(r.status));
  if (highValue.length >= 1) {
    const rate = Math.round((highValueWon.length / highValue.length) * 100);
    insights.push({
      id: "team-high-value",
      category: "team_performance",
      title: `Large projects (₹5L+) show ${rate}% conversion`,
      narrative: `Quotations above ₹5 lakh represent your high-stakes deals — ${highValueWon.length} of ${highValue.length} have converted or been approved.`,
      priority: 58,
      metric: { label: "Large-deal win rate", value: `${rate}%` },
      confidence: highValue.length >= 2 ? "medium" : "low",
    });
  }

  return insights;
}

function analyzeConversion(records: QuotationRecordRow[], lines: LineRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  if (!records.length) return insights;

  const won = records.filter((r) => isWon(r.status)).length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const rate = Math.round((won / records.length) * 100);

  insights.push({
    id: "conv-overall-rate",
    category: "conversion",
    title: `${rate}% of quotations reach approval or conversion`,
    narrative: `Your quote-to-win ratio sits at ${rate}% across ${records.length} quotations${rejected ? `, with ${rejected} rejected` : ""} — the baseline for measuring commercial effectiveness.`,
    priority: rate >= 40 ? 55 : 68,
    trend: rate >= 40 ? "up" : "neutral",
    metric: { label: "Conversion rate", value: `${rate}%` },
    confidence: records.length >= 5 ? "high" : "medium",
  });

  const byCategory = new Map<string, { total: number; won: number }>();
  for (const l of lines) {
    const cat = byCategory.get(l.category) || { total: 0, won: 0 };
    cat.total += 1;
    if (l.won) cat.won += 1;
    byCategory.set(l.category, cat);
  }

  const bestCat = [...byCategory.entries()]
    .filter(([, v]) => v.total >= 2)
    .map(([name, v]) => ({ name, rate: Math.round((v.won / v.total) * 100), total: v.total }))
    .sort((a, b) => b.rate - a.rate)[0];

  if (bestCat && bestCat.rate > 0) {
    insights.push({
      id: "conv-best-category",
      category: "conversion",
      title: `${bestCat.name} shows the strongest approval signal`,
      narrative: `Line items in ${bestCat.name} appear most often in won quotations — indicating stronger buyer confidence in this category.`,
      priority: 62,
      trend: "up",
      metric: { label: "Category win signal", value: `${bestCat.rate}%` },
      confidence: "medium",
    });
  }

  const rejectedWithFreight = records.filter(
    (r) => r.status === "rejected" && Number(r.freight) > 0
  );
  if (rejectedWithFreight.length >= 1) {
    insights.push({
      id: "conv-freight-rejection",
      category: "conversion",
      title: "Freight cost may be affecting deal closure",
      narrative: `${rejectedWithFreight.length} rejected quotation${rejectedWithFreight.length > 1 ? "s" : ""} included freight charges — review freight presentation or consider absorbed-freight options for competitive deals.`,
      priority: 66,
      actionHint: "Compare freight terms on won vs lost deals.",
      confidence: "medium",
    });
  }

  const fastDelivery = records.filter((r) => {
    const timeline = r.quotation_data?.terms?.delivery_timeline || r.delivery_terms || "";
    return /week|days|immediate|urgent/i.test(timeline) && isWon(r.status);
  });
  if (fastDelivery.length >= 1) {
    insights.push({
      id: "conv-fast-delivery",
      category: "conversion",
      title: "Shorter delivery timelines correlate with wins",
      narrative: `Quotations with aggressive delivery commitments show higher closure rates — speed remains a competitive lever in your market.`,
      priority: 54,
      trend: "up",
      confidence: "low",
    });
  }

  return insights;
}

function analyzePricing(lines: LineRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const priceByProduct = new Map<string, { prices: number[]; discounts: number[]; companies: Set<string> }>();
  for (const l of lines) {
    if (!l.unitPrice) continue;
    const row = priceByProduct.get(l.product) || { prices: [], discounts: [], companies: new Set() };
    row.prices.push(l.unitPrice);
    row.discounts.push(l.discount);
    row.companies.add(l.company);
    priceByProduct.set(l.product, row);
  }

  for (const [product, data] of priceByProduct) {
    if (data.companies.size < 2 || data.prices.length < 2) continue;
    const min = Math.min(...data.prices);
    const max = Math.max(...data.prices);
    const variance = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
    if (variance >= 8) {
      insights.push({
        id: `price-inconsistent-${product}`,
        category: "pricing",
        title: `${product} is quoted at inconsistent rates`,
        narrative: `Unit prices for ${product} vary by up to ${variance}% across customers — standardizing pricing could protect margins and reduce negotiation friction.`,
        priority: 64,
        actionHint: "Review price list alignment for this SKU.",
        confidence: "high",
      });
      break;
    }
  }

  const highDiscount = [...priceByProduct.entries()]
    .map(([product, data]) => ({
      product,
      avgDisc: data.discounts.length
        ? data.discounts.reduce((s, d) => s + d, 0) / data.discounts.length
        : 0,
    }))
    .filter((p) => p.avgDisc >= 8)
    .sort((a, b) => b.avgDisc - a.avgDisc)[0];

  if (highDiscount) {
    insights.push({
      id: "price-high-discount",
      category: "pricing",
      title: `Repeated discounts above ${Math.round(highDiscount.avgDisc)}% on ${highDiscount.product}`,
      narrative: `Average discounts on ${highDiscount.product} are running high — tightening discount approval could improve realized margins.`,
      priority: 61,
      trend: "down",
      metric: { label: "Avg discount", value: `${Math.round(highDiscount.avgDisc)}%` },
      confidence: "medium",
    });
  }

  const categoryValue = new Map<string, { recent: number; prior: number }>();
  const c90 = recentCutoff(90);
  const c180 = recentCutoff(180);
  for (const l of lines) {
    const row = categoryValue.get(l.category) || { recent: 0, prior: 0 };
    const t = parseDate(l.createdAt);
    if (t >= c90) row.recent += l.unitPrice * l.qty;
    else if (t >= c180) row.prior += l.unitPrice * l.qty;
    categoryValue.set(l.category, row);
  }

  const declining = [...categoryValue.entries()]
    .filter(([, v]) => v.prior > 0 && v.recent < v.prior * 0.85)
    .sort((a, b) => a[1].recent / a[1].prior - b[1].recent / b[1].prior)[0];

  if (declining) {
    const drop = Math.round(((declining[1].prior - declining[1].recent) / declining[1].prior) * 100);
    insights.push({
      id: "price-declining-category",
      category: "pricing",
      title: `Average quoted value is softening in ${declining[0]}`,
      narrative: `List values in ${declining[0]} have declined roughly ${drop}% period-over-period — check for competitive pressure or discount creep.`,
      priority: 59,
      trend: "down",
      confidence: "low",
    });
  }

  return insights;
}

function analyzePredictive(records: QuotationRecordRow[], lines: LineRow[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const byCompany = new Map<string, QuotationRecordRow[]>();
  for (const r of records) {
    const name = r.client?.company_name || "Unknown";
    const list = byCompany.get(name) || [];
    list.push(r);
    byCompany.set(name, list);
  }

  for (const [company, quotes] of byCompany) {
    if (quotes.length < 2) continue;
    const sorted = [...quotes].sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
    const last = sorted[0];
    const prev = sorted[1];
    const gap = daysBetween(last.created_at, prev.created_at);
    const daysSinceLast = Math.round((Date.now() - parseDate(last.created_at)) / MS_DAY);
    if (daysSinceLast >= gap * 0.75 && daysSinceLast <= gap * 1.25 && gap >= 20) {
      insights.push({
        id: `pred-reorder-${company}`,
        category: "predictive",
        title: `${company} may be nearing a reorder window`,
        narrative: `Based on a typical ${gap}-day cycle, ${company} could be due for their next inquiry — a timely follow-up may capture the order.`,
        priority: 80,
        actionHint: "Reach out with a proactive quotation or stock check.",
        confidence: "medium",
      });
      break;
    }
  }

  const productFreq = new Map<string, number>();
  const recentLines = lines.filter((l) => parseDate(l.createdAt) >= recentCutoff(60));
  for (const l of recentLines) {
    productFreq.set(l.product, (productFreq.get(l.product) || 0) + 1);
  }
  const hotProduct = [...productFreq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hotProduct && hotProduct[1] >= 2) {
    insights.push({
      id: "pred-restock",
      category: "predictive",
      title: `Consider restocking ${hotProduct[0]}`,
      narrative: `${hotProduct[0]} appeared in ${hotProduct[1]} recent quotations — demand signals suggest keeping inventory or supplier capacity ready.`,
      priority: 72,
      actionHint: "Verify stock levels or lead times with suppliers.",
      confidence: "medium",
    });
  }

  const catFreq = new Map<string, number>();
  for (const l of recentLines) {
    catFreq.set(l.category, (catFreq.get(l.category) || 0) + 1);
  }
  const risingCat = [...catFreq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (risingCat && risingCat[1] >= 2) {
    insights.push({
      id: "pred-rising-category",
      category: "predictive",
      title: `Inquiry frequency is rising for ${risingCat[0]}`,
      narrative: `${risingCat[0]} is appearing more often in recent RFQs — consider dedicating more sales focus or marketing to this category.`,
      priority: 68,
      trend: "up",
      confidence: "medium",
    });
  }

  const wonCategories = new Map<string, number>();
  for (const l of lines.filter((l) => l.won)) {
    wonCategories.set(l.category, (wonCategories.get(l.category) || 0) + 1);
  }
  const bestWon = [...wonCategories.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestWon && bestWon[1] >= 1) {
    insights.push({
      id: "pred-focus-category",
      category: "predictive",
      title: `Double down on ${bestWon[0]} — strongest conversion category`,
      narrative: `Won deals cluster in ${bestWon[0]} — shifting commercial focus here could improve overall win rates.`,
      priority: 66,
      confidence: "low",
    });
  }

  return insights;
}

const dedupeInsights = (insights: BusinessInsight[]): BusinessInsight[] => {
  const seen = new Set<string>();
  return insights.filter((i) => {
    const key = `${i.category}:${i.title.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Main entry — aggregates all analyzers and ranks insights for the dashboard */
export const computeBusinessInsights = (records: QuotationRecordRow[]): InsightsSnapshot => {
  const lines = flattenLines(records);

  const all = dedupeInsights([
    ...analyzeTopProducts(records, lines),
    ...analyzeCustomerPatterns(records),
    ...analyzeKeyCustomers(records),
    ...analyzeRegional(records),
    ...analyzeTeamPerformance(records),
    ...analyzeConversion(records, lines),
    ...analyzePricing(lines),
    ...analyzePredictive(records, lines),
  ]).sort((a, b) => b.priority - a.priority);

  const won = records.filter((r) => isWon(r.status)).length;
  const conversionRate = records.length ? Math.round((won / records.length) * 100) : 0;
  const companies = new Set(records.map((r) => r.client?.company_name).filter(Boolean));

  if (all.length === 0 && records.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      recordCount: 0,
      primary: [
        {
          id: "empty-state",
          category: "predictive",
          title: "Your business advisor is ready",
          narrative:
            "Save quotations in Records to unlock product trends, customer patterns, regional intelligence, and predictive recommendations.",
          priority: 100,
          confidence: "high",
          actionHint: "Load sample data from Records to explore insights instantly.",
        },
      ],
      more: [],
      pulse: { pipelineValue: 0, conversionRate: 0, activeCustomers: 0, quoteCount: 0 },
    };
  }

  if (all.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      primary: [
        {
          id: "sparse-data",
          category: "predictive",
          title: "Building your insight profile",
          narrative: `You have ${records.length} quotation${records.length === 1 ? "" : "s"} — add more records to unlock category trends, customer cycles, and conversion intelligence.`,
          priority: 100,
          confidence: "medium",
          actionHint: "Continue quoting to strengthen pattern detection.",
        },
      ],
      more: [],
      pulse: {
        pipelineValue: records.reduce((s, r) => s + Number(r.total_amount), 0),
        conversionRate,
        activeCustomers: companies.size,
        quoteCount: records.length,
      },
    };
  }

  const primary = all.slice(0, PRIMARY_COUNT);
  const more = all.slice(PRIMARY_COUNT);

  return {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    primary,
    more,
    pulse: {
      pipelineValue: records.reduce((s, r) => s + Number(r.total_amount), 0),
      conversionRate,
      activeCustomers: companies.size,
      quoteCount: records.length,
    },
  };
};
