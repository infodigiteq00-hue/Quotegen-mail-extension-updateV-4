import { CheckCircle2, Circle, FileOutput, GitBranch, Mail, Send } from "lucide-react";
import type { CommercialDocumentRow, LifecycleEventRow, QuotationRecordRow } from "@/lib/workflow";
import { DOCUMENT_LABELS } from "@/lib/workflow";
import { format } from "date-fns";

const iconFor = (type: string) => {
  if (type.includes("export")) return FileOutput;
  if (type.includes("revision")) return GitBranch;
  if (type.includes("sent") || type.includes("email")) return Mail;
  if (type.includes("convert") || type.includes("document")) return Send;
  if (type.includes("approved")) return CheckCircle2;
  return Circle;
};

export function DocumentTimeline({
  record,
  events,
  documents,
}: {
  record: QuotationRecordRow;
  events: LifecycleEventRow[];
  documents: CommercialDocumentRow[];
}) {
  const seed = [
    record.reference_rfq
      ? { title: "RFQ Received", description: record.reference_rfq, at: record.created_at, type: "rfq" }
      : null,
    { title: "Quotation Generated", description: record.quote_no, at: record.created_at, type: "quotation_created" },
  ].filter(Boolean) as { title: string; description?: string; at: string; type: string }[];

  const fromEvents = events.map((e) => ({
    title: e.title,
    description: e.description || undefined,
    at: e.created_at,
    type: e.event_type,
  }));

  const fromDocs = documents.map((d) => ({
    title: DOCUMENT_LABELS[d.document_type] || d.document_type,
    description: d.document_number,
    at: d.created_at,
    type: "document_converted",
  }));

  const timeline = [...seed, ...fromEvents, ...fromDocs]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .filter((item, idx, arr) => arr.findIndex((x) => x.title === item.title && x.at === item.at) === idx);

  return (
    <div className="relative pl-6 space-y-0">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {timeline.map((item, i) => {
        const Icon = iconFor(item.type);
        const isLast = i === timeline.length - 1;
        return (
          <div key={`${item.title}-${item.at}-${i}`} className="relative pb-6 last:pb-0">
            <div
              className={`absolute -left-6 top-0.5 h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center ${
                isLast ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
            </div>
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
              <p className="text-[10px] text-muted-foreground/70 mt-1">{format(new Date(item.at), "dd MMM yyyy · HH:mm")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
