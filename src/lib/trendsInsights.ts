import type { CommercialDocumentRow, QuotationRecordRow } from "./workflow";
import { lineTotal } from "./quotation";
import type { QuotationItem } from "./quotation";

export interface RankedRow {
  label: string;
  value: number;
  sublabel?: string;
  count?: number;
}

export interface TrendsSnapshot {
  topCompanies: RankedRow[];
  topProducts: RankedRow[];
  topEmployees: RankedRow[];
  statusBreakdown: { status: string; count: number }[];
  conversionRate: number;
  totalPipeline: number;
  documentMix: { type: string; count: number }[];
}

const aggregateBy = <T>(
  items: T[],
  keyFn: (t: T) => string,
  valueFn: (t: T) => number,
  subFn?: (t: T) => string
): RankedRow[] => {
  const map = new Map<string, { value: number; count: number; sublabel?: string }>();
  for (const item of items) {
    const k = keyFn(item);
    if (!k) continue;
    const prev = map.get(k) || { value: 0, count: 0, sublabel: subFn?.(item) };
    map.set(k, { value: prev.value + valueFn(item), count: prev.count + 1, sublabel: subFn?.(item) || prev.sublabel });
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, value: v.value, count: v.count, sublabel: v.sublabel }))
    .sort((a, b) => b.value - a.value);
};

export const computeTrendsSnapshot = (
  records: QuotationRecordRow[],
  documents: CommercialDocumentRow[]
): TrendsSnapshot => {

  const topCompanies = aggregateBy(
    records,
    (r) => r.client?.company_name || "Unknown",
    (r) => Number(r.total_amount),
    (r) => r.client?.contact_person || undefined
  ).slice(0, 8);

  const productRows: { name: string; value: number; company: string }[] = [];
  for (const r of records) {
    for (const it of r.quotation_data?.items || []) {
      productRows.push({
        name: it.item_name || "Unnamed",
        value: lineTotal(it as QuotationItem),
        company: r.client?.company_name || "",
      });
    }
  }
  const topProducts = aggregateBy(
    productRows,
    (p) => p.name,
    (p) => p.value,
    (p) => p.company
  ).slice(0, 8);

  const topEmployees = aggregateBy(
    records.filter((r) => r.prepared_by),
    (r) => r.prepared_by!,
    (r) => Number(r.total_amount)
  )
    .map((r) => ({ ...r, sublabel: `${records.filter((x) => x.prepared_by === r.label).length} quotes` }))
    .slice(0, 6);

  const statusMap = new Map<string, number>();
  for (const r of records) {
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
  }
  const statusBreakdown = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

  const converted = records.filter(
    (r) => r.status.startsWith("converted") || r.status === "approved" || r.status === "closed"
  ).length;
  const conversionRate = records.length ? Math.round((converted / records.length) * 100) : 0;

  const docTypeMap = new Map<string, number>();
  for (const d of documents) {
    const label = d.document_type.replace(/_/g, " ");
    docTypeMap.set(label, (docTypeMap.get(label) || 0) + 1);
  }
  const documentMix = [...docTypeMap.entries()].map(([type, count]) => ({ type, count }));

  return {
    topCompanies,
    topProducts,
    topEmployees,
    statusBreakdown,
    conversionRate,
    totalPipeline: records.reduce((s, r) => s + Number(r.total_amount), 0),
    documentMix,
  };
};
