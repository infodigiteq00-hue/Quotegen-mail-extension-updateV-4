import { Quotation, QuotationItem } from "./quotation";

export type Action =
  | { action: "apply_discount"; condition?: { price_less_than?: number; price_greater_than?: number; moc_contains?: string; name_contains?: string }; discount_percent: number }
  | { action: "set_margin"; increase_percent: number }
  | { action: "set_tax"; tax_percent: number }
  | { action: "set_currency"; currency: string }
  | { action: "remove_empty_rows" }
  | { action: "remove_duplicates" }
  | { action: "highlight_items"; condition?: { name_contains?: string; moc_contains?: string; urgency?: boolean }; on?: boolean }
  | { action: "group_items"; by: "moc" | "name_contains"; value?: string; group_label?: string }
  | { action: "ungroup_items" }
  | { action: "set_unit_all"; unit: string }
  | { action: "rewrite_items"; tone?: "professional" | "concise" | "premium"; length?: "short" | "medium" | "long"; items: { id: string; item_name?: string; description?: string }[] }
  | { action: "set_layout"; layout: Partial<Quotation["layout"]> }
  | { action: "set_terms"; terms: Partial<Quotation["terms"]> }
  | { action: "add_note"; note: string }
  | { action: "set_notes"; notes: string[] }
  | { action: "reorder_items"; ids: string[] }
  | { action: "delete_items"; ids: string[] }
  | { action: "update_items"; updates: { id: string; patch: Partial<QuotationItem> }[] }
  | { action: "set_subject"; subject: string };

const matches = (it: QuotationItem, c?: { price_less_than?: number; price_greater_than?: number; moc_contains?: string; name_contains?: string }) => {
  if (!c) return true;
  if (c.price_less_than != null && !(it.unit_price < c.price_less_than)) return false;
  if (c.price_greater_than != null && !(it.unit_price > c.price_greater_than)) return false;
  if (c.moc_contains && !it.moc.toLowerCase().includes(c.moc_contains.toLowerCase())) return false;
  if (c.name_contains && !it.item_name.toLowerCase().includes(c.name_contains.toLowerCase())) return false;
  return true;
};

export function applyAction(q: Quotation, a: Action): { q: Quotation; summary: string } {
  const next: Quotation = JSON.parse(JSON.stringify(q));
  let summary = "";

  switch (a.action) {
    case "apply_discount": {
      let n = 0;
      next.items = next.items.map((it) => {
        if (matches(it, a.condition)) { n++; return { ...it, discount: a.discount_percent }; }
        return it;
      });
      summary = `Applied ${a.discount_percent}% discount to ${n} item${n !== 1 ? "s" : ""}`;
      break;
    }
    case "set_margin": {
      next.items = next.items.map((it) => ({ ...it, unit_price: +(it.unit_price * (1 + a.increase_percent / 100)).toFixed(2) }));
      summary = `Increased prices by ${a.increase_percent}%`;
      break;
    }
    case "set_tax": next.tax_percent = a.tax_percent; summary = `Set tax to ${a.tax_percent}%`; break;
    case "set_currency": next.currency = a.currency; summary = `Currency → ${a.currency}`; break;
    case "remove_empty_rows": {
      const before = next.items.length;
      next.items = next.items.filter((it) => it.item_name.trim() || it.description.trim() || it.qty > 0);
      summary = `Removed ${before - next.items.length} empty row(s)`;
      break;
    }
    case "remove_duplicates": {
      const seen = new Set<string>();
      const before = next.items.length;
      next.items = next.items.filter((it) => {
        const k = `${it.item_name}|${it.moc}|${it.description}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      summary = `Removed ${before - next.items.length} duplicate(s)`;
      break;
    }
    case "highlight_items": {
      let n = 0;
      next.items = next.items.map((it) => {
        if (matches(it, a.condition)) { n++; return { ...it, highlight: a.on !== false }; }
        return it;
      });
      summary = `Highlighted ${n} item(s)`;
      break;
    }
    case "group_items": {
      next.items = next.items.map((it) => {
        if (a.by === "moc" && it.moc) return { ...it, group: it.moc };
        if (a.by === "name_contains" && a.value && it.item_name.toLowerCase().includes(a.value.toLowerCase()))
          return { ...it, group: a.group_label || a.value };
        return it;
      });
      // sort by group
      next.items.sort((x, y) => (x.group || "zzz").localeCompare(y.group || "zzz"));
      summary = `Grouped items by ${a.by}`;
      break;
    }
    case "ungroup_items":
      next.items = next.items.map((it) => ({ ...it, group: undefined }));
      summary = "Removed groupings";
      break;
    case "set_unit_all":
      next.items = next.items.map((it) => ({ ...it, unit: a.unit }));
      summary = `All units → ${a.unit}`;
      break;
    case "rewrite_items": {
      const map = new Map(a.items.map((u) => [u.id, u]));
      let n = 0;
      next.items = next.items.map((it) => {
        const u = map.get(it.id);
        if (!u) return it;
        n++;
        return { ...it, ...(u.item_name ? { item_name: u.item_name } : {}), ...(u.description != null ? { description: u.description } : {}) };
      });
      summary = `Rewrote ${n} item description(s)`;
      break;
    }
    case "set_layout":
      next.layout = { ...next.layout, ...a.layout };
      summary = `Layout updated`;
      break;
    case "set_terms":
      next.terms = { ...next.terms, ...a.terms };
      summary = "Commercial terms updated";
      break;
    case "add_note":
      next.notes = [...next.notes, a.note];
      summary = "Added note";
      break;
    case "set_notes":
      next.notes = a.notes;
      summary = `Notes updated (${a.notes.length})`;
      break;
    case "reorder_items": {
      const map = new Map(next.items.map((it) => [it.id, it]));
      const ordered = a.ids.map((id) => map.get(id)).filter(Boolean) as QuotationItem[];
      const rest = next.items.filter((it) => !a.ids.includes(it.id));
      next.items = [...ordered, ...rest];
      summary = "Reordered items";
      break;
    }
    case "delete_items": {
      const before = next.items.length;
      next.items = next.items.filter((it) => !a.ids.includes(it.id));
      summary = `Deleted ${before - next.items.length} item(s)`;
      break;
    }
    case "update_items": {
      const map = new Map(a.updates.map((u) => [u.id, u.patch]));
      next.items = next.items.map((it) => (map.has(it.id) ? { ...it, ...map.get(it.id)! } : it));
      summary = `Updated ${a.updates.length} item(s)`;
      break;
    }
    case "set_subject":
      next.subject = a.subject;
      summary = "Subject updated";
      break;
    default:
      summary = "No-op";
  }
  return { q: next, summary };
}

export function applyActions(q: Quotation, actions: Action[]): { q: Quotation; summary: string } {
  let cur = q;
  const parts: string[] = [];
  for (const a of actions) {
    const r = applyAction(cur, a);
    cur = r.q;
    parts.push(r.summary);
  }
  return { q: cur, summary: parts.join(" · ") };
}
