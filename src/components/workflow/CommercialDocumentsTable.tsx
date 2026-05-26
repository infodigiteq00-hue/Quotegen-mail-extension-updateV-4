import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_LABELS,
  formatCurrency,
  type CommercialDocumentRow,
} from "@/lib/workflow";

export function CommercialDocumentsTable({
  documents,
  quoteNoById,
  loading,
  emptyMessage,
}: {
  documents: CommercialDocumentRow[];
  quoteNoById: Record<string, string>;
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="px-5 py-16 text-center text-muted-foreground text-sm w-full">Loading documents…</div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="px-5 py-16 text-center w-full">
        <p className="font-medium text-sm">{emptyMessage || "No documents in this category yet"}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Convert a quotation using &quot;Convert to&quot; to create one here.
        </p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-[11px] font-medium tracking-wide text-muted-foreground">
            <th className="w-[14%] px-3 sm:px-5 py-3 font-medium">Document</th>
            <th className="w-[12%] px-3 sm:px-5 py-3 font-medium">Type</th>
            <th className="w-[14%] px-3 sm:px-5 py-3 font-medium">Source quote</th>
            <th className="w-[22%] px-3 sm:px-5 py-3 font-medium">Client</th>
            <th className="w-[12%] px-3 sm:px-5 py-3 font-medium">Date</th>
            <th className="w-[14%] px-3 sm:px-5 py-3 font-medium text-right">Amount</th>
            <th className="w-[12%] px-3 sm:px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => {
            const sourceNo = quoteNoById[d.source_quotation_id] || "—";
            return (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5 font-mono font-medium truncate">{d.document_number}</td>
                <td className="px-5 py-3.5">
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {DOCUMENT_LABELS[d.document_type]}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    to={`/records/${d.source_quotation_id}`}
                    className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-1"
                  >
                    <span className="truncate">{sourceNo}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium truncate">{d.client?.company_name || "—"}</div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                  {format(new Date(d.created_at), "dd MMM yyyy")}
                </td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums">
                  {formatCurrency(Number(d.total_amount), d.currency)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link to={`/records/${d.source_quotation_id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View source quotation">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
