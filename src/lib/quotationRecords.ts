import type { BrandingSettings, Quotation } from "./quotation";
import {
  type CommercialDocumentRow,
  type LifecycleEventRow,
  type QuotationFilters,
  type QuotationRecordRow,
  type QuotationStatus,
  buildDocumentPayload,
  generateDocumentNumber,
  generateRevisionQuoteNo,
  recordFromQuotation,
  statusAfterConversion,
  type DocumentType,
  DOCUMENT_LABELS,
  RECORD_CATEGORIES,
  type RecordCategoryId,
} from "./workflow";
import { readStore, tick, uid, writeStore } from "./workflowStore";

export { loadSampleWorkflowData } from "./sampleWorkflowData";
export { clearStore as clearWorkflowData } from "./workflowStore";

const applyRecordFilters = (rows: QuotationRecordRow[], filters: QuotationFilters) => {
  let result = [...rows];
  if (filters.status && filters.status !== "all") {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters.dateFrom) result = result.filter((r) => r.date >= filters.dateFrom!);
  if (filters.dateTo) result = result.filter((r) => r.date <= filters.dateTo!);
  if (filters.minAmount != null) result = result.filter((r) => Number(r.total_amount) >= filters.minAmount!);
  if (filters.maxAmount != null) result = result.filter((r) => Number(r.total_amount) <= filters.maxAmount!);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.quote_no.toLowerCase().includes(s) ||
        (r.client?.company_name || "").toLowerCase().includes(s) ||
        (r.client?.contact_person || "").toLowerCase().includes(s) ||
        (r.project_name || "").toLowerCase().includes(s) ||
        (r.reference_rfq || "").toLowerCase().includes(s)
    );
  }
  if (filters.client) {
    const c = filters.client.toLowerCase();
    result = result.filter((r) => (r.client?.company_name || "").toLowerCase().includes(c));
  }
  if (filters.project) {
    const p = filters.project.toLowerCase();
    result = result.filter((r) => (r.project_name || "").toLowerCase().includes(p));
  }
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const listQuotationRecords = async (filters: QuotationFilters = {}): Promise<QuotationRecordRow[]> => {
  await tick();
  const { records } = readStore();
  return applyRecordFilters(records, filters);
};

export const getQuotationRecord = async (id: string): Promise<QuotationRecordRow | null> => {
  await tick();
  const { records } = readStore();
  return records.find((r) => r.id === id) || null;
};

export const saveQuotationRecord = async (
  q: Quotation,
  branding?: BrandingSettings | null,
  existingId?: string | null,
  meta?: Partial<QuotationRecordRow>
): Promise<QuotationRecordRow> => {
  await tick();
  const store = readStore();
  const row = recordFromQuotation(q, branding, meta);
  const now = new Date().toISOString();

  if (existingId) {
    const idx = store.records.findIndex((r) => r.id === existingId);
    if (idx >= 0) {
      const updated: QuotationRecordRow = {
        ...(store.records[idx] as QuotationRecordRow),
        ...row,
        id: existingId,
        updated_at: now,
      };
      store.records[idx] = updated;
      writeStore(store);
      return updated;
    }
  }

  const saved: QuotationRecordRow = {
    ...(row as QuotationRecordRow),
    id: uid(),
    created_at: now,
    updated_at: now,
  };
  store.records.unshift(saved);
  store.events.push({
    id: uid(),
    quotation_id: saved.id,
    document_id: null,
    event_type: "quotation_created",
    title: "Quotation Generated",
    description: `${saved.quote_no} saved to records`,
    metadata: { quote_no: saved.quote_no },
    created_at: now,
  });
  writeStore(store);
  return saved;
};

export const updateQuotationStatus = async (id: string, status: QuotationStatus) => {
  await tick();
  const store = readStore();
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Record not found");
  store.records[idx] = { ...store.records[idx], status, updated_at: new Date().toISOString() };
  store.events.push({
    id: uid(),
    quotation_id: id,
    document_id: null,
    event_type: "status_changed",
    title: `Status → ${status.replace(/_/g, " ")}`,
    description: null,
    metadata: { status },
    created_at: new Date().toISOString(),
  });
  writeStore(store);
  return store.records[idx];
};

export const markExported = async (id: string) => {
  await tick();
  const store = readStore();
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Record not found");
  const now = new Date().toISOString();
  store.records[idx] = { ...store.records[idx], exported_at: now, updated_at: now };
  store.events.push({
    id: uid(),
    quotation_id: id,
    document_id: null,
    event_type: "exported",
    title: "PDF Exported",
    description: "Quotation exported to PDF",
    metadata: {},
    created_at: now,
  });
  writeStore(store);
  return store.records[idx];
};

export const duplicateQuotationRecord = async (source: QuotationRecordRow): Promise<QuotationRecordRow> => {
  const q = { ...source.quotation_data, quote_no: `${source.quote_no}-COPY` };
  return saveQuotationRecord(q, source.branding_snapshot, null, {
    project_name: source.project_name,
    reference_rfq: source.reference_rfq,
    prepared_by: source.prepared_by,
    gst_number: source.gst_number,
    freight: source.freight,
    status: "draft",
  });
};

export const createRevision = async (source: QuotationRecordRow): Promise<QuotationRecordRow> => {
  const nextRev = source.revision_number + 1;
  const baseNo = source.quote_no.replace(/-R\d+$/, "");
  const q = {
    ...source.quotation_data,
    quote_no: generateRevisionQuoteNo(baseNo, nextRev),
  };
  const saved = await saveQuotationRecord(q, source.branding_snapshot, null, {
    parent_id: source.parent_id || source.id,
    revision_number: nextRev,
    project_name: source.project_name,
    reference_rfq: source.reference_rfq,
    prepared_by: source.prepared_by,
    gst_number: source.gst_number,
    freight: source.freight,
    status: "revised",
  });
  const store = readStore();
  store.events.push({
    id: uid(),
    quotation_id: source.id,
    document_id: null,
    event_type: "revision_created",
    title: `Revision ${nextRev} Created`,
    description: saved.quote_no,
    metadata: { revision_id: saved.id, quote_no: saved.quote_no },
    created_at: new Date().toISOString(),
  });
  writeStore(store);
  await updateQuotationStatus(source.id, "revised");
  return saved;
};

export const convertToDocument = async (
  record: QuotationRecordRow,
  documentType: DocumentType
): Promise<CommercialDocumentRow> => {
  await tick();
  const store = readStore();
  const docNumber = generateDocumentNumber(documentType);
  const docPayload = buildDocumentPayload(record.quotation_data, record.freight);
  const now = new Date().toISOString();

  const doc: CommercialDocumentRow = {
    id: uid(),
    document_type: documentType,
    document_number: docNumber,
    source_quotation_id: record.id,
    parent_document_id: null,
    status: "draft",
    document_data: docPayload,
    subtotal: docPayload.subtotal as number,
    tax_amount: docPayload.tax_amount as number,
    freight: docPayload.freight as number,
    total_amount: docPayload.total_amount as number,
    currency: docPayload.currency as string,
    client: record.client,
    created_at: now,
    updated_at: now,
  };

  store.documents.unshift(doc);
  store.events.push({
    id: uid(),
    quotation_id: record.id,
    document_id: doc.id,
    event_type: "document_converted",
    title: `${DOCUMENT_LABELS[documentType]} Generated`,
    description: `${docNumber} created from ${record.quote_no}`,
    metadata: { document_type: documentType, document_number: docNumber },
    created_at: now,
  });
  writeStore(store);
  await updateQuotationStatus(record.id, statusAfterConversion(documentType));
  return doc;
};

export const listAllCommercialDocuments = async (): Promise<CommercialDocumentRow[]> => {
  await tick();
  const { documents } = readStore();
  return [...documents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const listDocumentsByCategory = async (categoryId: RecordCategoryId): Promise<CommercialDocumentRow[]> => {
  const cat = RECORD_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat?.documentTypes) return [];
  const docs = await listAllCommercialDocuments();
  return docs.filter((d) => cat.documentTypes!.includes(d.document_type));
};

export const getRecordCategoryCounts = async (): Promise<Record<RecordCategoryId, number>> => {
  await tick();
  const store = readStore();
  const counts = {} as Record<RecordCategoryId, number>;
  for (const cat of RECORD_CATEGORIES) {
    if (cat.id === "quotations") {
      counts.quotations = store.records.length;
    } else if (cat.documentTypes) {
      counts[cat.id] = store.documents.filter((d) => cat.documentTypes!.includes(d.document_type)).length;
    }
  }
  return counts;
};

export const getQuotationQuoteNo = (id: string): string | null => {
  const rec = readStore().records.find((r) => r.id === id);
  return rec?.quote_no ?? null;
};

export const listDocumentsForQuotation = async (quotationId: string): Promise<CommercialDocumentRow[]> => {
  await tick();
  const { documents } = readStore();
  return documents
    .filter((d) => d.source_quotation_id === quotationId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const listLifecycleEvents = async (quotationId: string): Promise<LifecycleEventRow[]> => {
  await tick();
  const { events } = readStore();
  return events
    .filter((e) => e.quotation_id === quotationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};

export const getDashboardMetrics = async () => {
  const records = await listQuotationRecords();
  const store = readStore();
  const approved = records.filter((r) => r.status === "approved" || r.status.startsWith("converted"));
  const pending = records.filter((r) => ["draft", "sent", "under_discussion", "revised"].includes(r.status));
  const totalQuoted = records.reduce((s, r) => s + Number(r.total_amount), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thisMonth = records.filter((r) => r.created_at >= monthStart);
  const monthValue = thisMonth.reduce((s, r) => s + Number(r.total_amount), 0);

  const convertedInvoices = store.documents.filter((d) =>
    ["sales_invoice", "purchase_invoice", "proforma_invoice"].includes(d.document_type)
  );

  return {
    totalQuotations: records.length,
    approvalRatio: records.length ? Math.round((approved.length / records.length) * 100) : 0,
    convertedInvoices: convertedInvoices.length,
    pendingQuotations: pending.length,
    rejectedQuotations: records.filter((r) => r.status === "rejected").length,
    totalQuotedValue: totalQuoted,
    monthlyConversionValue: monthValue,
  };
};

export const listRevisions = async (record: QuotationRecordRow): Promise<QuotationRecordRow[]> => {
  await tick();
  const rootId = record.parent_id || record.id;
  const { records } = readStore();
  return records
    .filter((r) => r.id === rootId || r.parent_id === rootId)
    .sort((a, b) => a.revision_number - b.revision_number);
};
