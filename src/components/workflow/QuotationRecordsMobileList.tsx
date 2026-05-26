import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Copy,
  Download,
  Edit,
  Eye,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { ConvertDocumentMenu } from "@/components/workflow/ConvertDocumentMenu";
import {
  emailShareUrl,
  formatCurrency,
  whatsappShareUrl,
  type QuotationRecordRow,
} from "@/lib/workflow";

export function QuotationRecordsMobileList({
  records,
  onDuplicate,
  onConverted,
}: {
  records: QuotationRecordRow[];
  onDuplicate: (record: QuotationRecordRow) => void;
  onConverted: () => void;
}) {
  return (
    <ul className="md:hidden divide-y">
      {records.map((r) => (
        <li key={r.id}>
          <Card className="m-3 p-4 border bg-card/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/records/${r.id}`} className="font-mono font-semibold text-sm hover:text-primary">
                  {r.quote_no}
                </Link>
                {r.revision_number > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">R{r.revision_number}</span>
                )}
                <p className="font-medium text-sm mt-1 truncate">{r.client?.company_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{r.client?.contact_person}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-medium truncate mt-0.5">{r.project_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="mt-0.5 whitespace-nowrap">{format(new Date(r.date), "dd MMM yyyy")}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold tabular-nums mt-0.5">
                  {formatCurrency(Number(r.total_amount), r.currency)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-1 pt-1 border-t">
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
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" onClick={() => onDuplicate(r)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Link to={`/quote/${r.id}?export=1`}>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Export PDF">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <ConvertDocumentMenu record={r} onConverted={onConverted} size="icon" />
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
          </Card>
        </li>
      ))}
    </ul>
  );
}
