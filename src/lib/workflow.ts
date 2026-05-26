import type { BrandingSettings, Client, Quotation } from "./quotation";
import { computeTotals } from "./quotation";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "under_discussion"
  | "revised"
  | "approved"
  | "converted_to_po"
  | "converted_to_invoice"
  | "closed"
  | "rejected";

export type DocumentType =
  | "sales_invoice"
  | "purchase_invoice"
  | "purchase_order"
  | "proforma_invoice"
  | "delivery_challan"
  | "work_order"
  | "dispatch_document";

export const QUOTATION_STATUSES: QuotationStatus[] = [
  "draft",
  "sent",
  "under_discussion",
  "revised",
  "approved",
  "converted_to_po",
  "converted_to_invoice",
  "closed",
  "rejected",
];

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  under_discussion: "Under Discussion",
  revised: "Revised",
  approved: "Approved",
  converted_to_po: "Converted to PO",
  converted_to_invoice: "Converted to Invoice",
  closed: "Closed",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  under_discussion: "bg-amber-50 text-amber-800 border-amber-200",
  revised: "bg-violet-50 text-violet-700 border-violet-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  converted_to_po: "bg-indigo-50 text-indigo-700 border-indigo-200",
  converted_to_invoice: "bg-teal-50 text-teal-700 border-teal-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export const DOCUMENT_TYPES: DocumentType[] = [
  "sales_invoice",
  "purchase_invoice",
  "purchase_order",
  "proforma_invoice",
  "delivery_challan",
  "work_order",
  "dispatch_document",
];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  sales_invoice: "Sales Invoice",
  purchase_invoice: "Purchase Invoice",
  purchase_order: "Purchase Order",
  proforma_invoice: "Proforma Invoice",
  delivery_challan: "Delivery Challan",
  work_order: "Work Order",
  dispatch_document: "Dispatch Document",
};

/** Records dashboard category tabs */
export type RecordCategoryId =
  | "quotations"
  | "invoices"
  | "purchase_orders"
  | "proforma"
  | "delivery_challans"
  | "work_orders"
  | "dispatch";

export const RECORD_CATEGORIES: {
  id: RecordCategoryId;
  label: string;
  shortLabel: string;
  documentTypes: DocumentType[] | null;
}[] = [
  { id: "quotations", label: "Quotations", shortLabel: "Quotes", documentTypes: null },
  {
    id: "invoices",
    label: "Invoices",
    shortLabel: "Invoices",
    documentTypes: ["sales_invoice", "purchase_invoice"],
  },
  { id: "purchase_orders", label: "Purchase Orders", shortLabel: "POs", documentTypes: ["purchase_order"] },
  { id: "proforma", label: "Proforma Invoices", shortLabel: "Proforma", documentTypes: ["proforma_invoice"] },
  { id: "delivery_challans", label: "Delivery Challans", shortLabel: "Challans", documentTypes: ["delivery_challan"] },
  { id: "work_orders", label: "Work Orders", shortLabel: "Work Orders", documentTypes: ["work_order"] },
  { id: "dispatch", label: "Dispatch", shortLabel: "Dispatch", documentTypes: ["dispatch_document"] },
];

const DOC_PREFIX: Record<DocumentType, string> = {
  sales_invoice: "INV",
  purchase_invoice: "PI",
  purchase_order: "PO",
  proforma_invoice: "PFI",
  delivery_challan: "DC",
  work_order: "WO",
  dispatch_document: "DSP",
};

export const generateDocumentNumber = (type: DocumentType) => {
  const prefix = DOC_PREFIX[type];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${new Date().getFullYear()}-${n}`;
};

export const generateRevisionQuoteNo = (baseQuoteNo: string, revision: number) => {
  const stripped = baseQuoteNo.replace(/-R\d+$/, "");
  return `${stripped}-R${revision}`;
};

export const statusAfterConversion = (type: DocumentType): QuotationStatus => {
  if (type === "purchase_order") return "converted_to_po";
  if (type === "sales_invoice" || type === "purchase_invoice" || type === "proforma_invoice") {
    return "converted_to_invoice";
  }
  return "approved";
};

export interface QuotationRecordRow {
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
  status: QuotationStatus;
  subtotal: number;
  tax_amount: number;
  freight: number;
  total_amount: number;
  currency: string;
  payment_terms: string | null;
  delivery_terms: string | null;
  quotation_data: Quotation;
  branding_snapshot: BrandingSettings | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialDocumentRow {
  id: string;
  document_type: DocumentType;
  document_number: string;
  source_quotation_id: string;
  parent_document_id: string | null;
  status: string;
  document_data: Record<string, unknown>;
  subtotal: number;
  tax_amount: number;
  freight: number;
  total_amount: number;
  currency: string;
  client: Client;
  created_at: string;
  updated_at: string;
}

export interface LifecycleEventRow {
  id: string;
  quotation_id: string | null;
  document_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type DocumentLinkType = "converted_from" | "revision_of";

export interface DocumentLinkRow {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  link_type: DocumentLinkType;
  created_at: string;
}

export function buildConversionDocumentLink(
  quotationId: string,
  documentId: string,
  id?: string,
  createdAt?: string,
): DocumentLinkRow {
  const now = createdAt ?? new Date().toISOString();
  return {
    id: id ?? crypto.randomUUID(),
    source_type: "quotation_record",
    source_id: quotationId,
    target_type: "commercial_document",
    target_id: documentId,
    link_type: "converted_from",
    created_at: now,
  };
}

export function buildRevisionDocumentLink(
  sourceQuotationId: string,
  revisionQuotationId: string,
  id?: string,
  createdAt?: string,
): DocumentLinkRow {
  const now = createdAt ?? new Date().toISOString();
  return {
    id: id ?? crypto.randomUUID(),
    source_type: "quotation_record",
    source_id: sourceQuotationId,
    target_type: "quotation_record",
    target_id: revisionQuotationId,
    link_type: "revision_of",
    created_at: now,
  };
}

export interface QuotationFilters {
  search?: string;
  status?: QuotationStatus | "all";
  client?: string;
  project?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const recordFromQuotation = (
  q: Quotation,
  branding?: BrandingSettings | null,
  extras?: Partial<QuotationRecordRow>
): Omit<QuotationRecordRow, "id" | "created_at" | "updated_at"> => {
  const { subtotal, tax } = computeTotals(q);
  const freight = extras?.freight ?? 0;
  return {
    quote_no: q.quote_no,
    parent_id: extras?.parent_id ?? null,
    revision_number: extras?.revision_number ?? 0,
    date: q.date,
    valid_until: q.valid_until || null,
    subject: q.subject || null,
    client: q.client,
    project_name: extras?.project_name ?? null,
    reference_rfq: extras?.reference_rfq ?? null,
    prepared_by: extras?.prepared_by ?? null,
    gst_number: extras?.gst_number ?? null,
    status: extras?.status ?? "draft",
    subtotal,
    tax_amount: tax,
    freight,
    total_amount: subtotal + tax + freight,
    currency: q.currency,
    payment_terms: q.terms.payment_terms || null,
    delivery_terms: q.terms.delivery_terms || null,
    quotation_data: q,
    branding_snapshot: branding ?? null,
    exported_at: extras?.exported_at ?? null,
  };
};

export const buildDocumentPayload = (q: Quotation, freight = 0) => {
  const { subtotal, tax } = computeTotals(q);
  return {
    subject: q.subject,
    items: q.items,
    terms: q.terms,
    notes: q.notes,
    tax_percent: q.tax_percent,
    layout: q.layout,
    custom_columns: q.custom_columns,
    subtotal,
    tax_amount: tax,
    freight,
    total_amount: subtotal + tax + freight,
    currency: q.currency,
    payment_terms: q.terms.payment_terms,
    delivery_terms: q.terms.delivery_terms,
    source_quote_no: q.quote_no,
  };
};

export const formatCurrency = (amount: number, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

export const whatsappShareUrl = (record: QuotationRecordRow) => {
  const text = encodeURIComponent(
    `Quotation ${record.quote_no} for ${record.client.company_name || record.client.contact_person}\nTotal: ${formatCurrency(record.total_amount, record.currency)}\nValid until: ${record.valid_until || "—"}`
  );
  const phone = (record.client.phone || "").replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
};

export const emailShareUrl = (record: QuotationRecordRow) => {
  const subject = encodeURIComponent(`Quotation ${record.quote_no} — ${record.client.company_name}`);
  const body = encodeURIComponent(
    `Dear ${record.client.contact_person || "Sir/Madam"},\n\nPlease find our quotation ${record.quote_no} for your review.\nTotal: ${formatCurrency(record.total_amount, record.currency)}\n\nRegards`
  );
  return `mailto:${record.client.email || ""}?subject=${subject}&body=${body}`;
};
