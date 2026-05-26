import { useState } from "react";
import { ArrowRightLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOCUMENT_LABELS, DOCUMENT_TYPES, type DocumentType, type QuotationRecordRow } from "@/lib/workflow";
import { convertToDocument } from "@/lib/quotationRecords";
import { toast } from "sonner";

const CONVERT_OPTIONS: DocumentType[] = [
  "sales_invoice",
  "purchase_invoice",
  "purchase_order",
  "proforma_invoice",
  "delivery_challan",
  "work_order",
];

export function ConvertDocumentMenu({
  record,
  onConverted,
  size = "sm",
}: {
  record: QuotationRecordRow;
  onConverted?: () => void;
  size?: "sm" | "default" | "icon";
}) {
  const [loading, setLoading] = useState(false);

  const handleConvert = async (type: DocumentType) => {
    setLoading(true);
    try {
      const doc = await convertToDocument(record, type);
      toast.success(`${DOCUMENT_LABELS[type]} created: ${doc.document_number}`);
      onConverted?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    }
    setLoading(false);
  };

  if (size === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Convert to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CONVERT_OPTIONS.map((t) => (
            <DropdownMenuItem key={t} onClick={() => handleConvert(t)}>
              {DOCUMENT_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size === "default" ? "default" : "sm"} disabled={loading}>
          <ArrowRightLeft className="h-4 w-4 mr-1.5" />
          Convert to
          <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Commercial document</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CONVERT_OPTIONS.map((t) => (
          <DropdownMenuItem key={t} onClick={() => handleConvert(t)}>
            {DOCUMENT_LABELS[t]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {DOCUMENT_TYPES.filter((t) => t === "dispatch_document").map((t) => (
          <DropdownMenuItem key={t} onClick={() => handleConvert(t)}>
            {DOCUMENT_LABELS[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
