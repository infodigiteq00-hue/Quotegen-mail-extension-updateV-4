import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Quotation, QuotationItem, emptyQuotation } from "@/lib/quotation";

const SAMPLE = `Hi,

Hope you're doing well. We need urgent quotation for the following:

1. SS316 centrifugal pump for sulfuric acid transfer - 3 nos, capacity around 5 m3/hr
2. Jacketed reactor 1000L MS with PTFE lining, need 1 unit
3. PTFE gaskets DN50 - approx 50 pcs

Delivery to our Vapi plant within 3 weeks. Payment 50% advance, balance against PI.
Please share your best price ASAP.

Thanks & Regards
Rajesh Kumar
Procurement Manager
Hindustan Specialty Chemicals Pvt Ltd
+91 98765 43210
rajesh@hsc-india.com`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onExtracted: (q: Quotation) => void;
}

export const ExtractEmailDialog = ({ open, onOpenChange, onExtracted }: Props) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (email.trim().length < 20) {
      toast.error("Paste a longer email to extract from");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-quotation", { body: { email } });
      if (data?.error) throw new Error(data.error);

      if (error) {
        const ctx = error as { context?: Response };
        if (ctx.context) {
          try {
            const body = await ctx.context.json();
            if (body?.error) throw new Error(body.error);
            if (body?.message?.includes("not found")) {
              throw new Error(
                "extract-quotation is not deployed. Run: npx supabase functions deploy extract-quotation --project-ref hrtvgakkumtrgsfaxjvp",
              );
            }
          } catch (inner) {
            if (inner instanceof Error && inner.message !== error.message) throw inner;
          }
        }
        const msg = error.message || "";
        if (msg.includes("non-2xx") || msg.includes("Failed to send")) {
          throw new Error(
            "Cannot reach extract-quotation Edge Function. Deploy it in Supabase and set LOVABLE_API_KEY secret.",
          );
        }
        throw error;
      }

      const q = emptyQuotation();
      q.subject = data.subject || "";
      q.client = data.client;
      q.urgency = data.urgency || "normal";
      q.terms = data.terms;
      q.notes = data.notes || [];
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
      // Stable sort so same-category items stay together (preserve original order within a group)
      const order: string[] = [];
      rawItems.forEach((it: QuotationItem) => { if (!order.includes(it.group!)) order.push(it.group!); });
      q.items = rawItems.sort((a: QuotationItem, b: QuotationItem) => order.indexOf(a.group!) - order.indexOf(b.group!));
      onExtracted(q);
      toast.success(`Extracted ${q.items.length} item${q.items.length !== 1 ? "s" : ""}`);
      onOpenChange(false);
      setEmail("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-1.5 rounded-md bg-gradient-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            Extract from Email
          </DialogTitle>
          <DialogDescription>
            Paste any enquiry email — messy, forwarded, broken English, multiple products. The AI parses, normalizes, and structures it into a quotation.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Paste the enquiry email here..."
          className="min-h-[260px] font-mono text-sm leading-relaxed resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEmail(SAMPLE)} disabled={loading}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Try sample
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={run} disabled={loading} className="bg-gradient-primary text-primary-foreground border-0 shadow-glow">
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extracting...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Extract Quotation</>)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
