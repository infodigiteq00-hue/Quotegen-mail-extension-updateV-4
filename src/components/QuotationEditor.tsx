import { Quotation, QuotationItem, computeTotals, currencySymbol, lineTotal, saveDefaultLayout } from "@/lib/quotation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Columns3, X, GripVertical, Package, Settings2, Save, MoreVertical, Check, ImageIcon } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuLabel, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, Fragment, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ProductPicker } from "./ProductPicker";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  q: Quotation;
  setQ: (q: Quotation) => void;
}

const UNITS = ["Nos", "Set", "Mtr", "Kg", "Lot", "Sqm", "Ltr"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

// Built-in column definitions (id, label, draggable). 'sn' and 'amount' are pinned.
type ColumnDef = { id: string; label: string; pinned?: "left" | "right"; isCustom?: boolean };

export const QuotationEditor = ({ q, setQ }: Props) => {
  const totals = computeTotals(q);
  const sym = currencySymbol(q.currency);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const customCols = q.custom_columns || [];

  const [colDialog, setColDialog] = useState(false);
  const [newCol, setNewCol] = useState<{ label: string; type: "text" | "number" }>({ label: "", type: "text" });

  const showCatHeaders = q.layout?.show_category_headers !== false;

  // ---- Build ordered column list (movable middle, pinned ends) ----
  const builtIns: ColumnDef[] = [
    { id: "category", label: "Category" },
    { id: "item", label: "Item" },
    { id: "description", label: "Description" },
    { id: "moc", label: "MOC" },
    { id: "qty", label: "Qty" },
    { id: "unit", label: "Unit" },
    { id: "rate", label: "Rate" },
    { id: "discount", label: "Disc%" },
  ];
  const allMovable: ColumnDef[] = [
    ...builtIns,
    ...customCols.map((c) => ({ id: `custom:${c.key}`, label: c.label, isCustom: true })),
  ];
  const labelOverrides = q.layout?.column_labels || {};
  const orderedIds = useMemo(() => {
    const saved = q.layout?.column_order || [];
    const known = new Set(allMovable.map((c) => c.id));
    const head = saved.filter((id) => known.has(id));
    const tail = allMovable.map((c) => c.id).filter((id) => !head.includes(id));
    return [...head, ...tail];
  }, [q.layout?.column_order, customCols.length]);
  const hiddenSet = new Set(q.layout?.hidden_columns || []);
  const orderedCols: ColumnDef[] = orderedIds
    .map((id) => allMovable.find((c) => c.id === id)!)
    .filter(Boolean)
    .filter((c) => !hiddenSet.has(c.id))
    .map((c) => ({ ...c, label: labelOverrides[c.id] || c.label }));

  // ---- Items grouped by category, respecting layout.group_order ----
  const groups = useMemo(() => {
    const map = new Map<string, QuotationItem[]>();
    q.items.forEach((it) => {
      const g = it.group || "Items";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    });
    const seen = Array.from(map.keys());
    const savedOrder = (q.layout?.group_order || []).filter((g) => map.has(g));
    const finalOrder = [...savedOrder, ...seen.filter((g) => !savedOrder.includes(g))];
    return finalOrder.map((g) => [g, map.get(g)!] as [string, QuotationItem[]]);
  }, [q.items, q.layout?.group_order]);

  const knownCategories = Array.from(new Set(q.items.map((it) => it.group).filter(Boolean) as string[]));
  const CATEGORY_SUGGESTIONS = Array.from(new Set([
    ...knownCategories,
    "Pumps", "Valves", "Reactors", "Gaskets", "Strainers", "Heat Exchangers", "Tanks", "Pipes", "Flanges", "Fittings", "Instruments", "Filters",
  ]));

  const updateItem = (id: string, patch: Partial<QuotationItem>) =>
    setQ({ ...q, items: q.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });

  const updateCustom = (id: string, key: string, v: string | number) =>
    setQ({ ...q, items: q.items.map((it) => (it.id === id ? { ...it, custom: { ...(it.custom || {}), [key]: v } } : it)) });

  const addItem = () => {
    const lastGroup = q.items.length > 0 ? (q.items[q.items.length - 1].group || "Items") : (knownCategories[0] || "Items");
    setQ({ ...q, items: [...q.items, { id: crypto.randomUUID(), item_name: "", description: "", qty: 1, unit: "Nos", moc: "", unit_price: 0, discount: 0, group: lastGroup }] });
  };

  const removeItem = (id: string) => setQ({ ...q, items: q.items.filter((it) => it.id !== id) });

  const renameGroup = (oldName: string, newName: string) => {
    const nextName = newName.trim();
    if (!nextName || nextName === oldName) return;
    const nextItems = q.items.map((it) =>
      (it.group || "Items") === oldName ? { ...it, group: nextName } : it,
    );
    const nextLayout = { ...(q.layout || {}) };
    if (nextLayout.group_order) {
      nextLayout.group_order = nextLayout.group_order.map((g) => (g === oldName ? nextName : g));
    }
    setQ({ ...q, items: nextItems, layout: nextLayout });
  };

  const deleteGroup = (groupName: string) => {
    const groupNames = groups.map(([g]) => g);
    const idx = groupNames.indexOf(groupName);
    if (idx < 0) return;

    const targetGroup = idx > 0
      ? groupNames[idx - 1]
      : (groupNames[idx + 1] || "Items");

    const nextItems = q.items.map((it) =>
      (it.group || "Items") === groupName ? { ...it, group: targetGroup } : it,
    );
    const nextLayout = { ...(q.layout || {}) };
    if (nextLayout.group_order) {
      nextLayout.group_order = nextLayout.group_order.filter((g) => g !== groupName);
    }
    setQ({ ...q, items: nextItems, layout: nextLayout });
    toast.success(`Category "${groupName}" merged into "${targetGroup}"`);
  };

  const addColumn = () => {
    if (!newCol.label.trim()) return;
    const key = newCol.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `col_${Date.now()}`;
    setQ({ ...q, custom_columns: [...customCols, { key, label: newCol.label.trim(), type: newCol.type }] });
    setNewCol({ label: "", type: "text" });
    setColDialog(false);
  };

  const removeColumn = (key: string) =>
    setQ({ ...q, custom_columns: customCols.filter((c) => c.key !== key) });

  // ---- DnD sensors ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Hide a built-in column (or remove a custom column)
  const toggle = (id: string) => {
    const hidden = new Set(q.layout?.hidden_columns || []);
    if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
    setQ({ ...q, layout: { ...(q.layout || {}), hidden_columns: Array.from(hidden) } });
  };

  // Rename a column label (built-in → store override; custom → update custom_columns)
  const renameColumn = (col: ColumnDef, label: string) => {
    if (!label.trim()) return;
    if (col.isCustom) {
      const key = col.id.slice(7);
      setQ({ ...q, custom_columns: customCols.map((c) => (c.key === key ? { ...c, label } : c)) });
    } else {
      const overrides = { ...(q.layout?.column_labels || {}), [col.id]: label };
      setQ({ ...q, layout: { ...(q.layout || {}), column_labels: overrides } });
    }
  };

  // Combined row + category drag handler. IDs prefixed with "cat:" are categories.
  const onBodyDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const aId = String(active.id); const oId = String(over.id);
    const aIsCat = aId.startsWith("cat:"); const oIsCat = oId.startsWith("cat:");
    if (aIsCat && oIsCat) {
      const ids = groups.map(([g]) => `cat:${g}`);
      const oldIndex = ids.indexOf(aId); const newIndex = ids.indexOf(oId);
      if (oldIndex < 0 || newIndex < 0) return;
      const newOrder = arrayMove(ids, oldIndex, newIndex).map((s) => s.slice(4));
      setQ({ ...q, layout: { ...(q.layout || {}), group_order: newOrder } });
      return;
    }
    if (!aIsCat && !oIsCat) {
      const oldIndex = q.items.findIndex((it) => it.id === aId);
      const overIndex = q.items.findIndex((it) => it.id === oId);
      if (oldIndex < 0 || overIndex < 0) return;
      const moved = { ...q.items[oldIndex], group: q.items[overIndex].group || "Items" };
      const next = [...q.items];
      next.splice(oldIndex, 1);
      const insertAt = next.findIndex((it) => it.id === oId);
      next.splice(insertAt, 0, moved);
      setQ({ ...q, items: next });
      return;
    }
    // Row dropped onto a category header → move to that group at the end
    if (!aIsCat && oIsCat) {
      const targetGroup = oId.slice(4);
      const oldIndex = q.items.findIndex((it) => it.id === aId);
      if (oldIndex < 0) return;
      const moved = { ...q.items[oldIndex], group: targetGroup };
      const next = q.items.filter((_, i) => i !== oldIndex);
      // place after the last row of the target group
      let insertAt = next.length;
      for (let i = next.length - 1; i >= 0; i--) {
        if ((next[i].group || "Items") === targetGroup) { insertAt = i + 1; break; }
        if (i === 0) insertAt = 0;
      }
      next.splice(insertAt, 0, moved);
      setQ({ ...q, items: next });
    }
  };

  // Reorder columns
  const onColDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedCols.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setQ({ ...q, layout: { ...(q.layout || {}), column_order: newOrder } });
  };

  // Cell renderer for a given column id
  const renderCell = (it: QuotationItem, colId: string) => {
    if (colId === "category") return (
      <input
        list="category-suggestions"
        value={it.group || ""}
        placeholder="Category"
        onChange={(e) => updateItem(it.id, { group: e.target.value })}
        className="w-full h-8 px-2 rounded outline-none text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-primary/40 transition font-medium"
      />
    );
    if (colId === "item") return (
      <div className="space-y-1">
        <CellInput
          // If the user linked a catalog product but item_name is empty,
          // show the linked product name in the "Item" cell.
          value={it.item_name || it.linked?.name || ""}
          onChange={(v) => updateItem(it.id, { item_name: v })}
        />
        <ProductPicker item={it} onChange={(patch) => updateItem(it.id, patch)} />
      </div>
    );
    if (colId === "description") return <CellInput value={it.description} onChange={(v) => updateItem(it.id, { description: v })} />;
    if (colId === "moc") return <CellInput value={it.moc} onChange={(v) => updateItem(it.id, { moc: v })} mono />;
    if (colId === "qty") return <CellInput value={String(it.qty)} onChange={(v) => updateItem(it.id, { qty: +v || 0 })} type="number" align="right" />;
    if (colId === "unit") return (
      <Select value={it.unit} onValueChange={(v) => updateItem(it.id, { unit: v })}>
        <SelectTrigger className="h-8 border-0 bg-muted/40 shadow-none px-2 text-xs rounded focus:ring-1 hover:bg-muted/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
      </Select>
    );
    if (colId === "rate") return <CellInput value={String(it.unit_price || "")} onChange={(v) => updateItem(it.id, { unit_price: +v || 0 })} type="number" align="right" mono />;
    if (colId === "discount") return <CellInput value={String(it.discount || "")} onChange={(v) => updateItem(it.id, { discount: +v || 0 })} type="number" align="right" mono />;
    if (colId.startsWith("custom:")) {
      const key = colId.slice(7);
      const c = customCols.find((x) => x.key === key);
      if (!c) return null;
      return <CellInput value={String(it.custom?.[key] ?? "")} onChange={(v) => updateCustom(it.id, key, c.type === "number" ? (+v || 0) : v)} type={c.type} />;
    }
    return null;
  };

  const colWidthClass = (id: string) => {
    if (id === "category") return "w-32";
    if (id === "item") return "min-w-[180px]";
    if (id === "description") return "min-w-[180px]";
    if (id === "moc") return "w-24";
    if (id === "qty") return "w-16";
    if (id === "unit") return "w-20";
    if (id === "rate") return "w-24";
    if (id === "discount") return "w-16";
    return "w-28";
  };

  // continuous serial numbers
  let serial = 0;

  return (
    <div className="space-y-5">
      {/* Quote meta — primary subject up top, secondary meta as a single compact strip */}
      <Card className="p-4 sm:p-5 space-y-5">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Subject</Label>
          <Input
            value={q.subject}
            onChange={(e) => setQ({ ...q, subject: e.target.value })}
            placeholder="Quotation for..."
            className="mt-1.5 text-base h-11 font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
          />
        </div>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 pt-1">
          <MetaField label="Quote No" className="w-32">
            <input value={q.quote_no} onChange={(e) => setQ({ ...q, quote_no: e.target.value })}
              className="w-full h-8 bg-transparent text-sm font-mono outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
          <MetaField label="Date" className="w-32">
            <input type="date" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })}
              className="w-full h-8 bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
          <MetaField label="Valid Until" className="w-32">
            <input type="date" value={q.valid_until} onChange={(e) => setQ({ ...q, valid_until: e.target.value })}
              className="w-full h-8 bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
          <MetaField label="Currency" className="w-24">
            <Select value={q.currency} onValueChange={(v) => setQ({ ...q, currency: v })}>
              <SelectTrigger className="h-8 px-0 border-0 border-b border-transparent rounded-none hover:border-border focus:ring-0 focus:border-primary shadow-none text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </MetaField>
          <MetaField label="Tax %" className="w-16">
            <input type="number" value={q.tax_percent} onChange={(e) => setQ({ ...q, tax_percent: +e.target.value || 0 })}
              className="w-full h-8 bg-transparent text-sm font-mono outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
        </div>
      </Card>

      {/* Client — primary company line, then progressive details */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client Company</Label>
          <Input
            value={q.client.company_name}
            onChange={(e) => setQ({ ...q, client: { ...q.client, company_name: e.target.value } })}
            placeholder="Company name"
            className="mt-1.5 text-base h-11 font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
          <MetaField label="Contact Person">
            <input value={q.client.contact_person} onChange={(e) => setQ({ ...q, client: { ...q.client, contact_person: e.target.value } })}
              placeholder="Full name"
              className="w-full h-8 bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
          <MetaField label="Email">
            <input value={q.client.email} onChange={(e) => setQ({ ...q, client: { ...q.client, email: e.target.value } })}
              placeholder="name@company.com"
              className="w-full h-8 bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
          <MetaField label="Phone">
            <input value={q.client.phone} onChange={(e) => setQ({ ...q, client: { ...q.client, phone: e.target.value } })}
              placeholder="+91…"
              className="w-full h-8 bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition" />
          </MetaField>
        </div>
        <details className="group">
          <summary className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium cursor-pointer hover:text-foreground transition list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> Address (optional)
          </summary>
          <Textarea rows={2} placeholder="Street, city, state, pin" value={q.client.address}
            onChange={(e) => setQ({ ...q, client: { ...q.client, address: e.target.value } })}
            className="mt-2 resize-none" />
        </details>
      </Card>

      {/* Items */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 flex-wrap gap-3">
          <SectionTitle className="mb-0">Line Items <span className="text-muted-foreground font-normal">· {q.items.length}</span></SectionTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background/70 px-2 py-1">
              <span className="text-[11px] font-medium text-muted-foreground">Category sections</span>
              <Switch
                checked={showCatHeaders}
                onCheckedChange={(v) => setQ({ ...q, layout: { ...(q.layout || {}), show_category_headers: !!v } })}
              />
            </div>
            <Button size="sm" onClick={addItem} className="bg-primary text-primary-foreground">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Row
            </Button>
            <LineItemsActionsMenu
              q={q}
              setQ={setQ}
              onAddColumn={() => {
                const n = (customCols.length || 0) + 1;
                const key = `col_${Date.now()}`;
                setQ({ ...q, custom_columns: [...customCols, { key, label: `Column ${n}`, type: "text" }] });
                toast.success("Column added — double-click header to rename");
              }}
            />
          </div>
        </div>

        <div className="px-4 py-2 text-[10px] text-muted-foreground border-b bg-muted/10">
          Drag <GripVertical className="inline h-3 w-3" /> on rows to move them between categories, drag category headers to reorder sections, or drag column headers to reorder columns.
        </div>

        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onColDragEnd}>
            <table className="w-full text-xs border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 text-center font-semibold py-2 border-b">#</th>
                  <th className="w-6 border-b"></th>
                  <SortableContext items={orderedCols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                    {orderedCols.map((c) => (
                      <SortableHeader
                        key={c.id}
                        col={c}
                        onRemove={c.isCustom ? () => removeColumn(c.id.slice(7)) : () => toggle(c.id)}
                        onRename={(label) => renameColumn(c, label)}
                        widthClass={colWidthClass(c.id)}
                      />
                    ))}
                  </SortableContext>
                  <th className="text-right font-semibold py-2 px-2 border-b w-24">Amount</th>
                  <th className="w-8 border-b"></th>
                </tr>
              </thead>
              <tbody>
                {q.items.length === 0 && (
                  <tr><td colSpan={orderedCols.length + 4} className="text-center py-10 text-muted-foreground">
                    No items yet. Click <span className="font-medium text-foreground">Add row</span> or <span className="font-medium text-foreground">Extract from Email</span>.
                  </td></tr>
                )}
              </tbody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBodyDragEnd}>
                <SortableContext
                  items={[
                    ...(showCatHeaders ? groups.map(([g]) => `cat:${g}`) : []),
                    ...q.items.map((it) => it.id),
                  ]}
                  strategy={verticalListSortingStrategy}
                >
                  {groups.map(([groupName, items]) => (
                    <SortableCategoryBody
                      key={groupName}
                      groupName={groupName}
                      items={items}
                      orderedCols={orderedCols}
                      colSpan={orderedCols.length + 4}
                      renderCell={renderCell}
                      onRemoveRow={removeItem}
                      colWidthClass={colWidthClass}
                      amountFor={(it) => `${sym}${fmt(lineTotal(it))}`}
                      serialStart={(() => {
                        let s = 0;
                        for (const [g, l] of groups) {
                          if (g === groupName) return s;
                          s += l.length;
                        }
                        return s;
                      })()}
                      onRenameGroup={(newName) => renameGroup(groupName, newName)}
                      onDeleteGroup={() => deleteGroup(groupName)}
                      showHeader={showCatHeaders}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </table>
          </DndContext>
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="flex justify-end p-4 border-t bg-muted/20">
          <div className="w-72 space-y-1.5 text-sm">
            <Row label="Subtotal" v={`${sym}${fmt(totals.subtotal)}`} />
            <Row label={`Tax (${q.tax_percent}%)`} v={`${sym}${fmt(totals.tax)}`} />
            <div className="h-px bg-border my-2" />
            <Row label="Grand Total" v={`${sym}${fmt(totals.grand)}`} bold />
          </div>
        </div>
      </Card>

      {/* Terms */}
      <Card className="p-4 sm:p-5">
        <SectionTitle>Commercial Terms</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Payment Terms"><Input value={q.terms.payment_terms} onChange={(e) => setQ({ ...q, terms: { ...q.terms, payment_terms: e.target.value } })} /></Field>
          <Field label="Delivery Terms"><Input value={q.terms.delivery_terms} onChange={(e) => setQ({ ...q, terms: { ...q.terms, delivery_terms: e.target.value } })} /></Field>
          <Field label="Delivery Timeline"><Input value={q.terms.delivery_timeline} onChange={(e) => setQ({ ...q, terms: { ...q.terms, delivery_timeline: e.target.value } })} /></Field>
          <Field label="Shipping Terms"><Input value={q.terms.shipping_terms} onChange={(e) => setQ({ ...q, terms: { ...q.terms, shipping_terms: e.target.value } })} /></Field>
          <Field label="Incoterms"><Input value={q.terms.incoterms} onChange={(e) => setQ({ ...q, terms: { ...q.terms, incoterms: e.target.value } })} /></Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionTitle>Notes</SectionTitle>
        <Textarea rows={4} placeholder="One note per line" value={q.notes.join("\n")} onChange={(e) => setQ({ ...q, notes: e.target.value.split("\n").filter(Boolean) })} />
      </Card>

      <Dialog open={colDialog} onOpenChange={setColDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add custom column</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Column name">
              <Input autoFocus placeholder="e.g. HSN code, Lead time, Brand" value={newCol.label} onChange={(e) => setNewCol({ ...newCol, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addColumn()} />
            </Field>
            <Field label="Type">
              <Select value={newCol.type} onValueChange={(v: "text" | "number") => setNewCol({ ...newCol, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="number">Number</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColDialog(false)}>Cancel</Button>
            <Button onClick={addColumn}>Add column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SortableHeader = ({ col, onRemove, onRename, widthClass }: { col: ColumnDef; onRemove?: () => void; onRename?: (label: string) => void; widthClass: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(col.label);
  const commit = () => { if (onRename && draft.trim() && draft !== col.label) onRename(draft.trim()); setEditing(false); };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`text-left font-semibold py-2 px-2 border-b ${widthClass} group/col ${col.id === "category" ? "hidden" : ""}`}
    >
      <div className="flex items-center gap-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground">
          <GripVertical className="h-3 w-3" />
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(col.label); setEditing(false); } }}
            className="flex-1 h-6 px-1 text-[10px] uppercase tracking-wider bg-background border rounded outline-none focus:ring-1 focus:ring-primary/40"
          />
        ) : (
          <span
            className="truncate flex-1 cursor-text"
            onDoubleClick={() => { setDraft(col.label); setEditing(true); }}
            title="Double-click to rename"
          >{col.label}</span>
        )}
        {onRemove && !editing && (
          <button onClick={onRemove} className="opacity-0 group-hover/col:opacity-100 hover:text-destructive" title="Hide / remove column">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </th>
  );
};

const SortableCategoryBody = ({ groupName, items, orderedCols, colSpan, renderCell, onRemoveRow, colWidthClass, amountFor, serialStart, onRenameGroup, onDeleteGroup, showHeader }: {
  groupName: string; items: QuotationItem[]; orderedCols: ColumnDef[]; colSpan: number;
  renderCell: (it: QuotationItem, colId: string) => React.ReactNode;
  onRemoveRow: (id: string) => void;
  colWidthClass: (id: string) => string;
  amountFor: (it: QuotationItem) => string;
  serialStart: number;
  onRenameGroup?: (name: string) => void;
  onDeleteGroup?: () => void;
  showHeader?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat:${groupName}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(groupName);
  const commit = () => {
    if (onRenameGroup && draft.trim() && draft !== groupName) onRenameGroup(draft.trim());
    setEditing(false);
  };
  return (
    <tbody ref={setNodeRef} style={style}>
      {showHeader && (
        <tr>
          <td colSpan={colSpan} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-bold border-y bg-primary/10 text-primary border-primary/20">
            <div className="flex items-center gap-2 group/cat">
              <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-primary/60 hover:text-primary">
                <GripVertical className="h-3 w-3" />
              </button>
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setDraft(groupName);
                      setEditing(false);
                    }
                  }}
                  className="h-5 px-1 text-[9px] uppercase tracking-[0.18em] bg-background/60 border border-primary/40 rounded outline-none focus:ring-1 focus:ring-primary/60 max-w-[160px]"
                />
              ) : (
                <span
                  className="cursor-text px-2 py-0.5 rounded bg-muted/40 hover:bg-muted/60"
                  onClick={() => {
                    setDraft(groupName);
                    setEditing(true);
                  }}
                  title="Click to rename category"
                >
                  {groupName}
                </span>
              )}
              <button
                type="button"
                onClick={onDeleteGroup}
                className="ml-auto opacity-0 group-hover/cat:opacity-100 text-primary/60 hover:text-destructive transition"
                title={`Delete ${groupName} category and merge rows`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </td>
        </tr>
      )}
      {items.map((it, i) => (
        <SortableRow
          key={it.id}
          item={it}
          serial={serialStart + i + 1}
          orderedCols={orderedCols}
          renderCell={renderCell}
          onRemove={() => onRemoveRow(it.id)}
          colWidthClass={colWidthClass}
          amount={amountFor(it)}
        />
      ))}
    </tbody>
  );
};

const SortableRow = ({ item, serial, orderedCols, renderCell, onRemove, colWidthClass, amount }: {
  item: QuotationItem; serial: number; orderedCols: ColumnDef[];
  renderCell: (it: QuotationItem, colId: string) => React.ReactNode; onRemove: () => void;
  colWidthClass: (id: string) => string; amount: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className="border-b hover:bg-muted/20 transition-colors align-top">
      <td className="text-center text-muted-foreground font-mono text-[10px] py-1">{serial}</td>
      <td className="py-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-foreground p-1">
          <GripVertical className="h-3 w-3" />
        </button>
      </td>
      {orderedCols.map((c) => (
        <td
          key={c.id}
          className={`py-1 px-1 ${colWidthClass(c.id)} ${c.id === "category" ? "hidden" : ""}`}
        >
          {renderCell(item, c.id)}
        </td>
      ))}
      <td className="text-right font-mono font-semibold text-xs px-2">{amount}</td>
      <td className="px-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
};

const CellInput = ({ value, onChange, type = "text", align = "left", mono = false }: { value: string; onChange: (v: string) => void; type?: string; align?: "left" | "right"; mono?: boolean }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full h-8 px-2 rounded outline-none text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-primary/40 transition ${align === "right" ? "text-right" : ""} ${mono ? "font-mono" : ""}`}
  />
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

const MetaField = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-col gap-0.5 ${className}`}>
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

const SectionTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-sm font-semibold mb-4 ${className}`}>{children}</h3>
);

const Row = ({ label, v, bold }: { label: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? "text-base font-semibold" : "text-muted-foreground"}`}>
    <span>{label}</span><span className="font-mono text-foreground">{v}</span>
  </div>
);

const COLUMN_LABELS: { id: string; label: string }[] = [
  { id: "category", label: "Category" },
  { id: "item", label: "Item" },
  { id: "description", label: "Description" },
  { id: "image", label: "Image" },
  { id: "moc", label: "MOC" },
  { id: "qty", label: "Qty" },
  { id: "unit", label: "Unit" },
  { id: "rate", label: "Rate" },
  { id: "discount", label: "Disc%" },
];

const ColumnSettingsPopover = ({ q, setQ }: { q: Quotation; setQ: (q: Quotation) => void }) => {
  const layout = q.layout || {};
  const hidden = new Set(layout.hidden_columns || []);
  const autoHide = layout.auto_hide_empty !== false;
  const imgSize = layout.image_size || "small";
  const customCols = q.custom_columns || [];

  const toggle = (id: string, v: boolean) => {
    const next = new Set(hidden);
    if (v) next.delete(id); else next.add(id);
    setQ({ ...q, layout: { ...layout, hidden_columns: Array.from(next) } });
  };

  const saveDefault = () => {
    saveDefaultLayout(layout, customCols);
    toast.success("Default table layout saved");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Columns</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Visible columns</div>
          <div className="space-y-1.5">
            {COLUMN_LABELS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={!hidden.has(c.id)} onCheckedChange={(v) => toggle(c.id, !!v)} />
                <span>{c.label}</span>
              </label>
            ))}
            {customCols.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-xs">
                <Checkbox checked={!hidden.has(`custom:${c.key}`)} onCheckedChange={(v) => toggle(`custom:${c.key}`, !!v)} />
                <span className="flex-1">{c.label}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setQ({ ...q, custom_columns: customCols.filter((x) => x.key !== c.key) })}
                  title="Delete column"
                ><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <label className="flex items-center justify-between text-xs">
            <span>Auto-hide empty columns</span>
            <Switch checked={autoHide} onCheckedChange={(v) => setQ({ ...q, layout: { ...layout, auto_hide_empty: v } })} className="scale-75" />
          </label>
        </div>
        <div className="border-t pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Image size</div>
          <div className="flex gap-1">
            {(["small", "medium", "large"] as const).map((s) => (
              <Button key={s} size="sm" variant={imgSize === s ? "default" : "outline"} className="flex-1 h-7 text-xs capitalize"
                onClick={() => setQ({ ...q, layout: { ...layout, image_size: s } })}>{s}</Button>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <Button size="sm" variant="secondary" className="w-full" onClick={saveDefault}>
            <Save className="h-3.5 w-3.5 mr-1.5" />Save as default layout
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">Applies to new quotations going forward.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const LineItemsActionsMenu = ({ q, setQ, onAddColumn }: {
  q: Quotation; setQ: (q: Quotation) => void; onAddColumn: () => void;
}) => {
  const layout = q.layout || {};
  const hidden = new Set(layout.hidden_columns || []);
  const customCols = q.custom_columns || [];
  const autoHide = layout.auto_hide_empty !== false;
  const imgSize = layout.image_size || "small";

  const toggleCol = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id); else next.add(id);
    setQ({ ...q, layout: { ...layout, hidden_columns: Array.from(next) } });
  };

  const clearRows = () => {
    if (q.items.length === 0) return;
    if (confirm(`Delete all ${q.items.length} rows?`)) {
      setQ({ ...q, items: [] });
      toast.success("All rows cleared");
    }
  };

  const saveDefault = () => {
    saveDefaultLayout(layout, customCols);
    toast.success("Default table layout saved");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="More actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Columns</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Settings2 className="h-3.5 w-3.5 mr-2" />Manage columns
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60 max-h-80 overflow-y-auto">
            {COLUMN_LABELS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={!hidden.has(c.id)}
                onCheckedChange={(v) => toggleCol(c.id, !!v)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
            {customCols.length > 0 && <DropdownMenuSeparator />}
            {customCols.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!hidden.has(`custom:${c.key}`)}
                onCheckedChange={(v) => toggleCol(`custom:${c.key}`, !!v)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={onAddColumn}>
          <Columns3 className="h-3.5 w-3.5 mr-2" />Add column
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Display</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={autoHide}
          onCheckedChange={(v) => setQ({ ...q, layout: { ...layout, auto_hide_empty: !!v } })}
          onSelect={(e) => e.preventDefault()}
        >
          Auto-hide empty columns
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ImageIcon className="h-3.5 w-3.5 mr-2" />Image size
            <span className="ml-auto text-[10px] text-muted-foreground capitalize">{imgSize}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            {(["small", "medium", "large"] as const).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => setQ({ ...q, layout: { ...layout, image_size: s } })}>
                <Check className={`h-3.5 w-3.5 mr-2 ${imgSize === s ? "opacity-100" : "opacity-0"}`} />
                <span className="capitalize">{s}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <div className="px-1 py-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); saveDefault(); }}
            className="w-full flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-2 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span className="flex-1 text-left">Save as default layout</span>
          </button>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={clearRows}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />Clear all rows
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
