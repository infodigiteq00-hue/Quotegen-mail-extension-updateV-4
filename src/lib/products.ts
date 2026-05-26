import { supabase } from "@/integrations/primary/client";

export interface Product {
  id: string;
  name: string;
  model: string | null;
  series: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  unit_price: number | null;
  currency: string | null;
  unit: string | null;
  availability: string | null;
  delivery_timeline: string | null;
  specific_terms: string | null;
  tags: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export const listProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Product[];
};

export const upsertProduct = async (p: Partial<Product>) => {
  const payload = { ...p, updated_at: new Date().toISOString() };
  if (p.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", p.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("products").insert(payload as any);
    if (error) throw error;
  }
};

export const deleteProduct = async (id: string) => {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
};

/** Loose match: tokens from query (e.g. "ns-series pump") fuzzy match name/model/series/category */
export const matchProducts = (products: Product[], query: string): Product[] => {
  if (!query) return products;
  const tokens = query.toLowerCase().split(/[\s,/-]+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return products;
  const score = (p: Product) => {
    const hay = [p.name, p.model, p.series, p.category, p.description].filter(Boolean).join(" ").toLowerCase();
    let s = 0;
    for (const t of tokens) if (hay.includes(t)) s += 1;
    return s;
  };
  return products
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
};
