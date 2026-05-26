import { useEffect, useMemo, useState } from "react";
import { QuotationItem, LinkedProduct } from "@/lib/quotation";
import { Product, listProducts, matchProducts } from "@/lib/products";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Link2, Package, ChevronDown, X, Check } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  item: QuotationItem;
  onChange: (patch: Partial<QuotationItem>) => void;
}

export const ProductPicker = ({ item, onChange }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listProducts().then(setProducts).catch(() => {});
  }, [open]);

  const queryStr = search || `${item.item_name} ${item.description}`.trim();
  const matches = useMemo(() => matchProducts(products, queryStr).slice(0, 30), [products, queryStr]);
  const linked = item.linked;
  const linkedProduct = products.find((p) => p.id === linked?.product_id);

  const link = (p: Product) => {
    const newLinked: LinkedProduct = {
      product_id: p.id,
      image_url: p.image_url || undefined,
      name: p.name,
      description: p.description || "",
      delivery_timeline: p.delivery_timeline || "",
      specific_terms: p.specific_terms || "",
      show_image: !!p.image_url,
      show_description: true,
      show_price: true,
      show_delivery: !!p.delivery_timeline,
      show_terms: !!p.specific_terms,
    };
    onChange({
      linked: newLinked,
      keep_client_reference: true,
      // autofill main fields (user can still edit)
      unit_price: item.unit_price || Number(p.unit_price || 0),
      description: item.description || p.description || "",
    });
    setOpen(false);
  };

  const unlink = () => onChange({ linked: undefined, keep_client_reference: false });

  const updateLinked = (patch: Partial<LinkedProduct>) =>
    onChange({ linked: { ...(item.linked as LinkedProduct), ...patch } });

  return (
    <div className="space-y-2">
      {!linked ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-white">
              <Link2 className="h-3 w-3" />Link product<ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <div className="p-2 border-b">
              <Input autoFocus placeholder={`Search catalog… (auto-matched: "${queryStr.slice(0, 30)}")`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {matches.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No matching products.
                  <div className="mt-2"><Link to="/catalog" className="text-primary hover:underline">Open catalog →</Link></div>
                </div>
              ) : matches.map((p) => (
                <button key={p.id} onClick={() => link(p)} className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center gap-2 border-b last:border-0">
                  <div className="h-9 w-9 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {p.image_url ? <img src={p.image_url} className="h-full w-full object-cover" alt="" /> : <Package className="h-4 w-4 text-muted-foreground/60" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate font-mono">
                      {[p.series, p.model, p.category].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">{p.currency} {Number(p.unit_price || 0).toLocaleString("en-IN")}</div>
                </button>
              ))}
            </div>
            <div className="p-2 border-t bg-muted/30">
              <Link to="/catalog" className="text-[11px] text-primary hover:underline">Manage catalog →</Link>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center gap-1.5 text-[11px] text-primary hover:bg-primary/10 rounded px-1.5 py-1 transition">
              <Check className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1 text-left">Linked: {linked.name}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2" align="start">
            <div className="flex items-center gap-2">
              {linked.image_url && <img src={linked.image_url} className="h-8 w-8 rounded object-cover" alt="" />}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Linked: {linkedProduct?.category || "Product"}</div>
                <div className="text-xs font-medium truncate">{linked.name}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={unlink}><X className="h-3 w-3" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                ["show_image", "Image"],
                ["show_description", "Desc"],
                ["show_price", "Price"],
                ["show_delivery", "Delivery"],
                ["show_terms", "T&C"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={!!(linked as any)[k]} onCheckedChange={(v) => updateLinked({ [k]: !!v } as any)} className="h-3 w-3" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-primary/10">
              <span className="text-[10px] text-muted-foreground">Show "Client requested" line</span>
              <Switch checked={!!item.keep_client_reference} onCheckedChange={(v) => onChange({ keep_client_reference: v })} className="scale-75" />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
