import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DocumentTimeline } from "@/components/workflow/DocumentTimeline";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { ConvertDocumentMenu } from "@/components/workflow/ConvertDocumentMenu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Copy,
  Download,
  Edit,
  GitBranch,
  Mail,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRevision,
  duplicateQuotationRecord,
  getQuotationRecord,
  listDocumentsForQuotation,
  listLifecycleEvents,
  listRevisions,
  updateQuotationStatus,
} from "@/lib/quotationRecords";
import {
  DOCUMENT_LABELS,
  QUOTATION_STATUSES,
  STATUS_LABELS,
  emailShareUrl,
  formatCurrency,
  whatsappShareUrl,
  type CommercialDocumentRow,
  type LifecycleEventRow,
  type QuotationRecordRow,
  type QuotationStatus,
} from "@/lib/workflow";
import { format } from "date-fns";

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<QuotationRecordRow | null>(null);
  const [events, setEvents] = useState<LifecycleEventRow[]>([]);
  const [documents, setDocuments] = useState<CommercialDocumentRow[]>([]);
  const [revisions, setRevisions] = useState<QuotationRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getQuotationRecord(id);
      if (!r) {
        toast.error("Quotation not found");
        setLoading(false);
        return;
      }
      const [ev, docs, revs] = await Promise.all([
        listLifecycleEvents(id),
        listDocumentsForQuotation(id),
        listRevisions(r),
      ]);
      setRecord(r);
      setEvents(ev);
      setDocuments(docs);
      setRevisions(revs);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const onStatusChange = async (status: QuotationStatus) => {
    if (!record) return;
    try {
      await updateQuotationStatus(record.id, status);
      toast.success("Status updated");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center text-muted-foreground">Loading…</main>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <p className="font-medium">Quotation not found</p>
          <Link to="/records" className="text-sm text-primary mt-2 inline-block">
            Back to records
          </Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Link to="/records" className="mt-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-mono font-semibold">{record.quote_no}</h1>
                <StatusBadge status={record.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {record.client?.company_name} · {format(new Date(record.date), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/quote/${record.id}`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            </Link>
            <Link to={`/quote/${record.id}?export=1`}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" /> Export PDF
              </Button>
            </Link>
            <ConvertDocumentMenu record={record} onConverted={load} />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const rev = await createRevision(record);
                  toast.success(`Revision ${rev.quote_no} created`);
                  load();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              <GitBranch className="h-4 w-4 mr-1.5" /> Create revision
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const dup = await duplicateQuotationRecord(record);
                  toast.success(`Duplicated: ${dup.quote_no}`);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              <Copy className="h-4 w-4 mr-1.5" /> Duplicate
            </Button>
            <a href={whatsappShareUrl(record)} target="_blank" rel="noreferrer">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </a>
            <a href={emailShareUrl(record)}>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Mail className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5 border">
              <h2 className="text-sm font-semibold mb-4">Commercial summary</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Client</dt>
                  <dd className="font-medium mt-0.5">{record.client?.company_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Contact</dt>
                  <dd className="mt-0.5">{record.client?.contact_person || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Project</dt>
                  <dd className="mt-0.5">{record.project_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">RFQ ref</dt>
                  <dd className="mt-0.5">{record.reference_rfq || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Subtotal</dt>
                  <dd className="mt-0.5 tabular-nums">{formatCurrency(Number(record.subtotal), record.currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Total</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(Number(record.total_amount), record.currency)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground text-xs mb-1">Update status</dt>
                  <Select value={record.status} onValueChange={(v) => onStatusChange(v as QuotationStatus)}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTATION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </dl>
            </Card>

            <Card className="p-5 border">
              <h2 className="text-sm font-semibold mb-3">Line items ({record.quotation_data?.items?.length || 0})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3 text-right">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(record.quotation_data?.items || []).slice(0, 12).map((it) => (
                      <tr key={it.id} className="border-b border-dashed last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{it.item_name}</div>
                          {it.description && <div className="text-muted-foreground truncate max-w-[280px]">{it.description}</div>}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {it.qty} {it.unit}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{it.unit_price}</td>
                        <td className="py-2 text-right tabular-nums">
                          {(it.qty * it.unit_price * (1 - (it.discount || 0) / 100)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {documents.length > 0 && (
              <Card className="p-5 border">
                <h2 className="text-sm font-semibold mb-3">Linked documents</h2>
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                      <span>
                        <span className="font-medium">{DOCUMENT_LABELS[d.document_type]}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-xs">{d.document_number}</span>
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency(Number(d.total_amount), d.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {revisions.length > 1 && (
              <Card className="p-5 border">
                <h2 className="text-sm font-semibold mb-3">Revision history</h2>
                <ul className="space-y-1 text-sm">
                  {revisions.map((rev) => (
                    <li key={rev.id}>
                      <Link to={`/records/${rev.id}`} className="text-primary hover:underline font-mono">
                        {rev.quote_no}
                      </Link>
                      <StatusBadge status={rev.status} className="ml-2" />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <Card className="p-5 border h-fit lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold mb-4">Lifecycle timeline</h2>
            <DocumentTimeline record={record} events={events} documents={documents} />
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
