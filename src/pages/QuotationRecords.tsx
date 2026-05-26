import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardMetrics } from "@/components/workflow/DashboardMetrics";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { ConvertDocumentMenu } from "@/components/workflow/ConvertDocumentMenu";
import { RecordCategoryTabs } from "@/components/workflow/RecordCategoryTabs";
import { CommercialDocumentsTable } from "@/components/workflow/CommercialDocumentsTable";
import { QuotationRecordsMobileList } from "@/components/workflow/QuotationRecordsMobileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Copy,
  Download,
  Edit,
  Eye,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearWorkflowData,
  duplicateQuotationRecord,
  getDashboardMetrics,
  getRecordCategoryCounts,
  listDocumentsByCategory,
  listQuotationRecords,
  loadSampleWorkflowData,
} from "@/lib/quotationRecords";
import {
  QUOTATION_STATUSES,
  STATUS_LABELS,
  emailShareUrl,
  formatCurrency,
  whatsappShareUrl,
  type CommercialDocumentRow,
  type QuotationFilters,
  type QuotationRecordRow,
  type RecordCategoryId,
} from "@/lib/workflow";
import { format } from "date-fns";

export default function QuotationRecords() {
  const [records, setRecords] = useState<QuotationRecordRow[]>([]);
  const [documents, setDocuments] = useState<CommercialDocumentRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<RecordCategoryId, number>>({} as Record<RecordCategoryId, number>);
  const [activeCategory, setActiveCategory] = useState<RecordCategoryId>("quotations");
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getDashboardMetrics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [filters, setFilters] = useState<QuotationFilters>({ status: "all", search: "" });

  const quoteNoById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of records) m[r.id] = r.quote_no;
    return m;
  }, [records]);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, m, counts] = await Promise.all([
        listQuotationRecords(filters),
        getDashboardMetrics(),
        getRecordCategoryCounts(),
      ]);
      setRecords(rows);
      setMetrics(m);
      setCategoryCounts(counts);
      if (activeCategory !== "quotations") {
        setDocuments(await listDocumentsByCategory(activeCategory));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load records");
    }
    setLoading(false);
  };

  const loadCategory = async (cat: RecordCategoryId) => {
    setActiveCategory(cat);
    if (cat === "quotations") {
      setDocuments([]);
    } else {
      setDocuments(await listDocumentsByCategory(cat));
    }
    const counts = await getRecordCategoryCounts();
    setCategoryCounts(counts);
  };

  useEffect(() => {
    load();
  }, [filters.status, filters.dateFrom, filters.dateTo]);

  const filtered = useMemo(() => {
    if (!filters.search && !filters.client && !filters.project) return records;
    const s = (filters.search || "").toLowerCase();
    const c = (filters.client || "").toLowerCase();
    const p = (filters.project || "").toLowerCase();
    return records.filter((r) => {
      const matchSearch =
        !s ||
        r.quote_no.toLowerCase().includes(s) ||
        (r.client?.company_name || "").toLowerCase().includes(s) ||
        (r.project_name || "").toLowerCase().includes(s);
      const matchClient = !c || (r.client?.company_name || "").toLowerCase().includes(c);
      const matchProject = !p || (r.project_name || "").toLowerCase().includes(p);
      return matchSearch && matchClient && matchProject;
    });
  }, [records, filters.search, filters.client, filters.project]);

  const filteredDocs = useMemo(() => {
    if (!filters.search) return documents;
    const s = filters.search.toLowerCase();
    return documents.filter(
      (d) =>
        d.document_number.toLowerCase().includes(s) ||
        (d.client?.company_name || "").toLowerCase().includes(s) ||
        (quoteNoById[d.source_quotation_id] || "").toLowerCase().includes(s)
    );
  }, [documents, filters.search, quoteNoById]);

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      await loadSampleWorkflowData();
      toast.success("Sample data loaded into your workspace");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load sample data");
    }
    setLoadingSample(false);
  };

  const handleClear = async () => {
    if (!confirm("Clear all quotation records from the database? This cannot be undone.")) return;
    try {
      await clearWorkflowData();
      toast.success("All records cleared");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to clear records");
    }
  };

  const handleDuplicate = async (record: QuotationRecordRow) => {
    try {
      const dup = await duplicateQuotationRecord(record);
      toast.success(`Duplicated as ${dup.quote_no}`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  return (
    <AppShell>
      <main className="page-main space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Quotation Records</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track, search, and convert quotations — saved to your workspace database.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleLoadSample} disabled={loadingSample}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {loadingSample ? "Loading…" : "Load sample data"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1.5" /> Clear
            </Button>
            <Link to="/">
              <Button className="bg-gradient-primary text-primary-foreground border-0 shadow-glow">
                <Plus className="h-4 w-4 mr-1.5" /> New quotation
              </Button>
            </Link>
          </div>
        </div>

        {metrics && <DashboardMetrics metrics={metrics} />}

        <Card className="w-full p-4 border bg-card/60 backdrop-blur space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 w-full">
            <div className="md:col-span-2 xl:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quote no, company, project…"
                className="pl-9"
                value={filters.search || ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            {activeCategory === "quotations" && (
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as QuotationFilters["status"] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {QUOTATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="date"
              placeholder="From"
              value={filters.dateFrom || ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            />
            <Input
              type="date"
              placeholder="To"
              value={filters.dateTo || ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </Card>

        <Card className="w-full border overflow-hidden shadow-sm">
          <RecordCategoryTabs
            active={activeCategory}
            counts={categoryCounts}
            onChange={(cat) => {
              void loadCategory(cat);
            }}
          />
          {activeCategory !== "quotations" ? (
            <CommercialDocumentsTable
              documents={filteredDocs}
              quoteNoById={quoteNoById}
              loading={loading}
            />
          ) : loading ? (
            <div className="px-4 py-16 text-center text-muted-foreground text-sm">Loading records…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="font-medium">No quotations yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Load sample data to explore the workflow, or create a quote and click Save.
              </p>
              <Button variant="outline" size="sm" onClick={handleLoadSample} disabled={loadingSample}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Load sample data
              </Button>
            </div>
          ) : (
          <>
          <QuotationRecordsMobileList
            records={filtered}
            onDuplicate={handleDuplicate}
            onConverted={load}
          />
          <div className="hidden md:block table-scroll">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-[11px] font-medium tracking-wide text-muted-foreground">
                  <th className="w-[11%] px-5 py-3 font-medium">Quote</th>
                  <th className="w-[22%] px-5 py-3 font-medium">Client</th>
                  <th className="w-[18%] px-5 py-3 font-medium">Project</th>
                  <th className="w-[11%] px-5 py-3 font-medium">Date</th>
                  <th className="w-[12%] px-5 py-3 font-medium text-right">Amount</th>
                  <th className="w-[14%] px-5 py-3 font-medium">Status</th>
                  <th className="w-[12%] px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link to={`/records/${r.id}`} className="font-mono font-medium hover:text-primary">
                          {r.quote_no}
                        </Link>
                        {r.revision_number > 0 && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">R{r.revision_number}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium truncate">{r.client?.company_name || "—"}</div>
                        <p className="text-xs text-muted-foreground truncate">{r.client?.contact_person}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground truncate">{r.project_name || "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.date), "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium tabular-nums">
                        {formatCurrency(Number(r.total_amount), r.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/records/${r.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Link to={`/quote/${r.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" onClick={() => handleDuplicate(r)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Link to={`/quote/${r.id}?export=1`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Export PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <ConvertDocumentMenu record={r} onConverted={load} size="icon" />
                          <a href={whatsappShareUrl(r)} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <a href={emailShareUrl(r)}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Email">
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          </>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
