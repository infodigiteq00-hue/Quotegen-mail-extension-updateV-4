import { supabase } from "@/integrations/primary/client";
import type { BrandingSettings, Client, Quotation } from "./quotation";
import type {
  CommercialDocumentRow,
  DocumentLinkRow,
  DocumentType,
  LifecycleEventRow,
  QuotationRecordRow,
  QuotationStatus,
} from "./workflow";

const num = (v: unknown) => Number(v ?? 0);

type DbQuotationRecord = {
  id: string;
  quote_no: string;
  parent_id: string | null;
  revision_number: number;
  date: string;
  valid_until: string | null;
  subject: string | null;
  client: Client;
  project_name: string | null;
  reference_rfq: string | null;
  prepared_by: string | null;
  gst_number: string | null;
  status: string;
  subtotal: number | string;
  tax_amount: number | string;
  freight: number | string;
  total_amount: number | string;
  currency: string;
  payment_terms: string | null;
  delivery_terms: string | null;
  quotation_data: Quotation;
  branding_snapshot: BrandingSettings | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbCommercialDocument = {
  id: string;
  document_type: string;
  document_number: string;
  source_quotation_id: string;
  parent_document_id: string | null;
  status: string;
  document_data: Record<string, unknown>;
  subtotal: number | string;
  tax_amount: number | string;
  freight: number | string;
  total_amount: number | string;
  currency: string;
  client: Client;
  created_at: string;
  updated_at: string;
};

type DbLifecycleEvent = {
  id: string;
  quotation_id: string | null;
  document_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const toQuotationRecordRow = (row: DbQuotationRecord): QuotationRecordRow => ({
  id: row.id,
  quote_no: row.quote_no,
  parent_id: row.parent_id,
  revision_number: row.revision_number,
  date: row.date,
  valid_until: row.valid_until,
  subject: row.subject,
  client: row.client ?? ({} as Client),
  project_name: row.project_name,
  reference_rfq: row.reference_rfq,
  prepared_by: row.prepared_by,
  gst_number: row.gst_number,
  status: row.status as QuotationStatus,
  subtotal: num(row.subtotal),
  tax_amount: num(row.tax_amount),
  freight: num(row.freight),
  total_amount: num(row.total_amount),
  currency: row.currency,
  payment_terms: row.payment_terms,
  delivery_terms: row.delivery_terms,
  quotation_data: row.quotation_data,
  branding_snapshot: row.branding_snapshot,
  exported_at: row.exported_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const toCommercialDocumentRow = (row: DbCommercialDocument): CommercialDocumentRow => ({
  id: row.id,
  document_type: row.document_type as DocumentType,
  document_number: row.document_number,
  source_quotation_id: row.source_quotation_id,
  parent_document_id: row.parent_document_id,
  status: row.status,
  document_data: row.document_data ?? {},
  subtotal: num(row.subtotal),
  tax_amount: num(row.tax_amount),
  freight: num(row.freight),
  total_amount: num(row.total_amount),
  currency: row.currency,
  client: row.client ?? ({} as Client),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const toLifecycleEventRow = (row: DbLifecycleEvent): LifecycleEventRow => ({
  id: row.id,
  quotation_id: row.quotation_id,
  document_id: row.document_id,
  event_type: row.event_type,
  title: row.title,
  description: row.description,
  metadata: row.metadata ?? {},
  created_at: row.created_at,
});

export const quotationRecordToDb = (
  row: Omit<QuotationRecordRow, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }
) => ({
  id: row.id,
  quote_no: row.quote_no,
  parent_id: row.parent_id,
  revision_number: row.revision_number,
  date: row.date,
  valid_until: row.valid_until,
  subject: row.subject,
  client: row.client,
  project_name: row.project_name,
  reference_rfq: row.reference_rfq,
  prepared_by: row.prepared_by,
  gst_number: row.gst_number,
  status: row.status,
  subtotal: row.subtotal,
  tax_amount: row.tax_amount,
  freight: row.freight,
  total_amount: row.total_amount,
  currency: row.currency,
  payment_terms: row.payment_terms,
  delivery_terms: row.delivery_terms,
  quotation_data: row.quotation_data,
  branding_snapshot: row.branding_snapshot,
  exported_at: row.exported_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const commercialDocumentToDb = (
  row: Omit<CommercialDocumentRow, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }
) => ({
  id: row.id,
  document_type: row.document_type,
  document_number: row.document_number,
  source_quotation_id: row.source_quotation_id,
  parent_document_id: row.parent_document_id,
  status: row.status,
  document_data: row.document_data,
  subtotal: row.subtotal,
  tax_amount: row.tax_amount,
  freight: row.freight,
  total_amount: row.total_amount,
  currency: row.currency,
  client: row.client,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const lifecycleEventToDb = (
  row: Omit<LifecycleEventRow, "created_at"> & { created_at?: string }
) => ({
  id: row.id,
  quotation_id: row.quotation_id,
  document_id: row.document_id,
  event_type: row.event_type,
  title: row.title,
  description: row.description,
  metadata: row.metadata,
  created_at: row.created_at,
});

export const documentLinkToDb = (row: Omit<DocumentLinkRow, "created_at"> & { created_at?: string }) => ({
  id: row.id,
  source_type: row.source_type,
  source_id: row.source_id,
  target_type: row.target_type,
  target_id: row.target_id,
  link_type: row.link_type,
  created_at: row.created_at,
});

export const fetchAllQuotationRecords = async (): Promise<QuotationRecordRow[]> => {
  const { data, error } = await supabase
    .from("quotation_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as DbQuotationRecord[]).map(toQuotationRecordRow);
};

export const fetchQuotationRecordById = async (id: string): Promise<QuotationRecordRow | null> => {
  const { data, error } = await supabase.from("quotation_records").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toQuotationRecordRow(data as DbQuotationRecord) : null;
};

export const upsertQuotationRecord = async (row: QuotationRecordRow): Promise<QuotationRecordRow> => {
  const payload = quotationRecordToDb(row);
  const { data, error } = await supabase
    .from("quotation_records")
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return toQuotationRecordRow(data as DbQuotationRecord);
};

export const insertLifecycleEvent = async (event: LifecycleEventRow): Promise<void> => {
  const { error } = await supabase.from("lifecycle_events").insert(lifecycleEventToDb(event));
  if (error) throw error;
};

export const updateQuotationRecordFields = async (
  id: string,
  fields: Partial<QuotationRecordRow>
): Promise<QuotationRecordRow> => {
  const existing = await fetchQuotationRecordById(id);
  if (!existing) throw new Error("Record not found");
  const merged = { ...existing, ...fields, id, updated_at: new Date().toISOString() };
  return upsertQuotationRecord(merged);
};

export const fetchAllCommercialDocuments = async (): Promise<CommercialDocumentRow[]> => {
  const { data, error } = await supabase
    .from("commercial_documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as DbCommercialDocument[]).map(toCommercialDocumentRow);
};

export const insertCommercialDocument = async (doc: CommercialDocumentRow): Promise<CommercialDocumentRow> => {
  const { data, error } = await supabase
    .from("commercial_documents")
    .insert(commercialDocumentToDb(doc))
    .select("*")
    .single();
  if (error) throw error;
  return toCommercialDocumentRow(data as DbCommercialDocument);
};

export const insertDocumentLink = async (link: DocumentLinkRow): Promise<void> => {
  const { error } = await supabase.from("document_links").insert(documentLinkToDb(link));
  if (error) throw error;
};

export const fetchLifecycleEventsForQuotation = async (quotationId: string): Promise<LifecycleEventRow[]> => {
  const { data, error } = await supabase
    .from("lifecycle_events")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as DbLifecycleEvent[]).map(toLifecycleEventRow);
};

export const bulkInsertWorkflowData = async (payload: {
  records: QuotationRecordRow[];
  documents: CommercialDocumentRow[];
  events: LifecycleEventRow[];
  links?: DocumentLinkRow[];
}): Promise<void> => {
  if (payload.records.length) {
    const { error } = await supabase
      .from("quotation_records")
      .upsert(payload.records.map((r) => quotationRecordToDb(r)));
    if (error) throw error;
  }
  if (payload.documents.length) {
    const { error } = await supabase
      .from("commercial_documents")
      .upsert(payload.documents.map((d) => commercialDocumentToDb(d)));
    if (error) throw error;
  }
  if (payload.links?.length) {
    const { error } = await supabase
      .from("document_links")
      .upsert(payload.links.map((l) => documentLinkToDb(l)));
    if (error) throw error;
  }
  if (payload.events.length) {
    const { error } = await supabase
      .from("lifecycle_events")
      .upsert(payload.events.map((e) => lifecycleEventToDb(e)));
    if (error) throw error;
  }
};

/** PostgREST requires a filter on delete — matches all real UUID rows */
const DELETE_ALL_FILTER = "00000000-0000-0000-0000-000000000000";

export const clearAllWorkflowData = async (): Promise<void> => {
  const { error: eventsError } = await supabase.from("lifecycle_events").delete().neq("id", DELETE_ALL_FILTER);
  if (eventsError) throw eventsError;
  const { error: linksError } = await supabase.from("document_links").delete().neq("id", DELETE_ALL_FILTER);
  if (linksError) throw linksError;
  const { error: docsError } = await supabase.from("commercial_documents").delete().neq("id", DELETE_ALL_FILTER);
  if (docsError) throw docsError;
  const { error: recordsError } = await supabase.from("quotation_records").delete().neq("id", DELETE_ALL_FILTER);
  if (recordsError) throw recordsError;
};
