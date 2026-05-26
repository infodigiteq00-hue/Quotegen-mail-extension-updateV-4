import type {
  CommercialDocumentRow,
  DocumentLinkRow,
  LifecycleEventRow,
  QuotationRecordRow,
} from "./workflow";

export interface WorkflowStoreData {
  records: QuotationRecordRow[];
  documents: CommercialDocumentRow[];
  events: LifecycleEventRow[];
  links?: DocumentLinkRow[];
}

/** Shared helpers for workflow persistence (data lives in Supabase via workflowDb). */

export const uid = () => crypto.randomUUID();

/** Small delay so UI feels like a save */
export const tick = () => new Promise((r) => setTimeout(r, 120));
