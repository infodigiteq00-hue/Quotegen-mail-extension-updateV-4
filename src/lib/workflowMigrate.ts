import type { WorkflowStoreData } from "./workflowStore";
import { bulkInsertWorkflowData, fetchAllQuotationRecords } from "./workflowDb";

const LEGACY_STORAGE_KEY = "quotegen_workflow_v1";
let migrationPromise: Promise<void> | null = null;

/** One-time upload of browser-local workflow data when Supabase is still empty */
export const migrateLegacyWorkflowStore = (): Promise<void> => {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    if (typeof window === "undefined") return;
    const existing = await fetchAllQuotationRecords();
    if (existing.length > 0) return;
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as WorkflowStoreData;
      if (!data.records?.length) return;
      await bulkInsertWorkflowData(data);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* keep legacy data if migration fails */
    }
  })();
  return migrationPromise;
};
