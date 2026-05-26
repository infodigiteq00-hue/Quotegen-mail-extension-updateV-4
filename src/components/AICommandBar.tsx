import { useState } from "react";
import { Sparkles, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Quotation, QuotationItem, emptyQuotation } from "@/lib/quotation";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onExtracted: (next: Quotation) => void;
}

export const AICommandBar = ({ onExtracted }: Props) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const run = async () => {
    const text = email.trim();
    if (text.length < 20) {
      toast.error("Paste a longer email to extract from");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-quotation", { body: { email: text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nq = emptyQuotation();
      nq.subject = data.subject || "";
      nq.client = data.client;
      nq.urgency = data.urgency || "normal";
      nq.terms = data.terms;
      nq.notes = data.notes || [];
      const rawItems = (data.items || []).map((it: any) => ({
        item_name: it.item_name || "",
        description: it.description || "",
        qty: it.qty || 0,
        unit: it.unit || "Nos",
        moc: it.moc || "",
        group: it.category || it.group || "Items",
        id: crypto.randomUUID(),
        unit_price: 0,
        discount: 0,
      }));
      const order: string[] = [];
      rawItems.forEach((it: QuotationItem) => { if (!order.includes(it.group!)) order.push(it.group!); });
      nq.items = rawItems.sort((a: QuotationItem, b: QuotationItem) => order.indexOf(a.group!) - order.indexOf(b.group!));

      onExtracted(nq);
      toast.success(`Extracted ${nq.items.length} item${nq.items.length !== 1 ? "s" : ""}`);
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(720px,calc(100vw-1.5rem))] pb-[env(safe-area-inset-bottom)]">
      <div
        className="rounded-2xl border bg-card/95 backdrop-blur-xl shadow-glow overflow-hidden transition-all duration-200"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className={`px-4 text-xs text-muted-foreground border-b transition-all duration-200 ${expanded ? "pt-3 pb-2 opacity-100" : "h-0 py-0 opacity-0 overflow-hidden border-b-0"}`}>
          Paste enquiry email below and click Run to extract quotation.
        </div>

        <div className={`flex items-end gap-2 p-3 transition-all duration-200 ${expanded ? "" : "py-2"}`}>
          <Mail className="h-4 w-4 text-primary shrink-0 mb-2" />
          <div className="flex-1">
            <Textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder="Paste RFQ / enquiry email here..."
              className={`resize-y text-sm transition-all duration-200 ${expanded ? "min-h-[72px] max-h-40" : "min-h-[42px] max-h-[42px]"}`}
              disabled={loading}
            />
          </div>
          <Button
            size="sm"
            onClick={run}
            disabled={loading || email.trim().length < 20}
            className="bg-gradient-primary text-primary-foreground border-0 h-9 px-4"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Run</>}
          </Button>
        </div>
      </div>
    </div>
  );
};
