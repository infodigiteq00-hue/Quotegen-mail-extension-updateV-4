import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Product, listProducts, upsertProduct, deleteProduct } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Package, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/primary/client";
import { useRef } from "react";

const blank = (): Partial<Product> => ({
  name: "", model: "", series: "", category: "", description: "", image_url: "",
  unit_price: 0, currency: "INR", unit: "Nos", availability: "In stock",
  delivery_timeline: "", specific_terms: "",
});

export default function Catalog() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(blank());

  const load = async () => {
    setLoading(true);
    try { setItems(await listProducts()); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.name?.trim()) { toast.error("Name required"); return; }
    try { await upsertProduct(editing); toast.success("Saved"); setOpen(false); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try { await deleteProduct(id); load(); } catch (e: any) { toast.error(e.message); }
  };

  const filtered = items.filter((p) => {
    if (!q) return true;
    const hay = `${p.name} ${p.model} ${p.series} ${p.category}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground shrink-0"><ArrowLeft className="h-4 w-4" /></Link>
            <Package className="h-4 w-4 text-primary shrink-0" />
            <div className="text-[15px] font-semibold tracking-tight truncate">Product Catalog</div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline shrink-0">· {items.length} products</span>
          </div>
          <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }} className="bg-gradient-primary text-primary-foreground border-0 shadow-glow shrink-0 h-8 px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add product</span>
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-6 py-6 sm:py-8">
        <div className="mb-5 relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, model, series, category…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <div className="font-medium">No products yet</div>
            <div className="text-xs text-muted-foreground mt-1">Add your first standard product to use it inside quotations.</div>
            <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }} className="mt-5"><Plus className="h-3.5 w-3.5 mr-1.5" />Add product</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden flex flex-col">
                <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-8 w-8 text-muted-foreground/40" />}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{p.category || "Uncategorized"}</div>
                  <div className="font-semibold text-sm mt-0.5 leading-tight">{p.name}</div>
                  {(p.model || p.series) && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{[p.series, p.model].filter(Boolean).join(" · ")}</div>}
                  {p.description && <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</div>}
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <div className="font-mono text-sm">{p.currency || "INR"} {Number(p.unit_price || 0).toLocaleString("en-IN")}</div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Name *"><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Category"><Input placeholder="Pumps, Valves…" value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
            <Field label="Series"><Input placeholder="NS-Series" value={editing.series || ""} onChange={(e) => setEditing({ ...editing, series: e.target.value })} /></Field>
            <Field label="Model"><Input placeholder="NS-1102" value={editing.model || ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Description"><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label="Product image"><ImageDrop value={editing.image_url || ""} onChange={(url) => setEditing({ ...editing, image_url: url })} /></Field></div>
            <Field label="Unit price"><Input type="number" value={editing.unit_price ?? 0} onChange={(e) => setEditing({ ...editing, unit_price: +e.target.value })} /></Field>
            <Field label="Currency"><Input value={editing.currency || ""} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></Field>
            <Field label="Unit"><Input value={editing.unit || ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} /></Field>
            <Field label="Availability"><Input value={editing.availability || ""} onChange={(e) => setEditing({ ...editing, availability: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Delivery timeline"><Input placeholder="2-3 weeks ex-works" value={editing.delivery_timeline || ""} onChange={(e) => setEditing({ ...editing, delivery_timeline: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label="Specific T&C's"><Textarea rows={2} value={editing.specific_terms || ""} onChange={(e) => setEditing({ ...editing, specific_terms: e.target.value })} /></Field></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

const ImageDrop = ({ value, onChange }: { value: string; onChange: (url: string) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition flex items-center gap-3 ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"}`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-16 w-16 object-cover rounded" />
            <div className="flex-1 text-xs text-muted-foreground truncate">{value}</div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onChange(""); }}><X className="h-3.5 w-3.5" /></Button>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">{busy ? "Uploading…" : "Drag & drop an image, or click to browse"}</div>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
      <Input placeholder="Or paste image URL…" value={value} onChange={(e) => onChange(e.target.value)} className="text-xs h-8" />
    </div>
  );
};
