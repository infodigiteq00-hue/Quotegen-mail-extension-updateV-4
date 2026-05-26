import type {
  CommercialDocumentRow,
  LifecycleEventRow,
  QuotationRecordRow,
} from "./workflow";

const STORAGE_KEY = "quotegen_workflow_v1";

export interface WorkflowStoreData {
  records: QuotationRecordRow[];
  documents: CommercialDocumentRow[];
  events: LifecycleEventRow[];
}

const emptyStore = (): WorkflowStoreData => ({
  records: [],
  documents: [],
  events: [],
});

export const readStore = (): WorkflowStoreData => {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return JSON.parse(raw) as WorkflowStoreData;
  } catch {
    return emptyStore();
  }
};

export const writeStore = (data: WorkflowStoreData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const replaceStore = (data: WorkflowStoreData) => {
  writeStore(data);
};

export const clearStore = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const uid = () => crypto.randomUUID();

/** Small delay so UI feels like a save (demo polish) */
export const tick = () => new Promise((r) => setTimeout(r, 120));
