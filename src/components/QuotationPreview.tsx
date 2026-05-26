import { Fragment, ReactNode } from "react";
import { BrandingSettings, Quotation, QuotationItem, computeTotals, currencySymbol, lineTotal } from "@/lib/quotation";

interface Props {
  q: Quotation;
  brand: BrandingSettings;
}

const IMAGE_SIZES = {
  small: { px: 64, cls: "h-16 w-16", colW: "w-20" },
  medium: { px: 96, cls: "h-24 w-24", colW: "w-28" },
  large: { px: 144, cls: "h-36 w-36", colW: "w-40" },
} as const;

export const QuotationPreview = ({ q, brand }: Props) => {
  const PX_TO_MM = 25.4 / 96;
  const FIXED_HEADER_PX = 150;
  const FIXED_HEADER_MM = FIXED_HEADER_PX * PX_TO_MM;
  const totals = computeTotals(q);
  const sym = currencySymbol(q.currency);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const layout = q.layout || {};
  const showCatHeaders = layout.show_category_headers !== false;
  const autoHide = layout.auto_hide_empty !== false;
  const hidden = new Set(layout.hidden_columns || []);
  const imgSize = IMAGE_SIZES[layout.image_size || "small"];
  const customCols = q.custom_columns || [];
  const labelOverrides = layout.column_labels || {};
  const theme = brand.table_theme || {
    header_bg: "#1e50e6",
    header_text: "#ffffff",
    category_bg: "#eaf0ff",
    category_text: "#1e50e6",
    category_border: "#cdd9f7",
    accent: "#1e50e6",
  };

  // Group ordering — respect saved group_order, then first-seen
  const seen: string[] = [];
  q.items.forEach((it) => { const g = it.group || "Items"; if (!seen.includes(g)) seen.push(g); });
  const savedGroups = (layout.group_order || []).filter((g) => seen.includes(g));
  const order: string[] = [...savedGroups, ...seen.filter((g) => !savedGroups.includes(g))];
  const items = [...q.items].sort((a, b) => order.indexOf(a.group || "Items") - order.indexOf(b.group || "Items"));

  // Determine which columns are non-empty
  const hasAny = (pred: (it: QuotationItem) => boolean) => q.items.some(pred);
  const nonEmpty = {
    image: hasAny((it) => !!(it.linked?.show_image && it.linked.image_url)),
    moc: hasAny((it) => !!it.moc?.trim()),
    qty: hasAny((it) => (it.qty ?? 0) !== 0),
    unit: hasAny((it) => !!it.unit?.trim()),
    rate: hasAny((it) => (it.unit_price ?? 0) !== 0),
    discount: hasAny((it) => (it.discount ?? 0) !== 0),
  };
  // When there are NO product images, show description as its OWN column instead of beneath the item name
  const splitDescription = !nonEmpty.image;
  const customNonEmpty = (key: string) => hasAny((it) => {
    const v = it.custom?.[key];
    return v !== undefined && v !== null && String(v).trim() !== "" && v !== 0;
  });

  type Col = { id: string; label: string; w?: string; render: (it: QuotationItem, i: number) => React.ReactNode; align?: "right" | "left"; alwaysShow?: boolean };
  const allCols: Col[] = [
    {
      id: "item", label: labelOverrides["item"] || "Item", alwaysShow: true,
      render: (it) => {
        const linked = it.linked;
        const showSuggestion = !!linked;
        const showClientRef = showSuggestion && it.keep_client_reference;
        const displayName = showSuggestion ? (linked!.name || it.item_name) : it.item_name;
        const displayDesc = showSuggestion && linked!.show_description ? (linked!.description || "") : it.description;
        return (
          <>
            {showClientRef && (
              <div className="mb-1.5 pb-1.5 border-b border-dashed border-neutral-300">
                <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">Client Requested</div>
                <div className="text-neutral-700">{it.item_name}</div>
                {it.description && <div className="text-[10px] text-neutral-500 font-normal mt-0.5">{it.description}</div>}
              </div>
            )}
            {showSuggestion && showClientRef && (
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#1e50e6" }}>Our Suggestion</div>
            )}
            <div className="font-medium">{displayName}</div>
            {!splitDescription && displayDesc && (
              <div className="text-[10px] text-neutral-600 font-normal mt-0.5 leading-snug">{displayDesc}</div>
            )}
          </>
        );
      },
    },
    ...(splitDescription ? [{
      id: "description", label: labelOverrides["description"] || "Description",
      render: (it: QuotationItem) => {
        const linked = it.linked;
        const desc = linked && linked.show_description ? (linked.description || "") : it.description;
        return desc ? <span className="text-neutral-700 leading-snug">{desc}</span> : null;
      },
    } as Col] : []),
    {
      id: "image", label: labelOverrides["image"] || "Image", w: imgSize.colW,
      render: (it) => it.linked?.show_image && it.linked.image_url
        ? <img src={it.linked.image_url} alt="" className={`${imgSize.cls} object-cover rounded border border-neutral-200`} />
        : null,
    },
    { id: "moc", label: labelOverrides["moc"] || "MOC", render: (it) => <span className="font-mono text-[10px]">{it.moc}</span> },
    { id: "qty", label: labelOverrides["qty"] || "Qty", w: "w-12", align: "right", render: (it) => it.qty },
    { id: "unit", label: labelOverrides["unit"] || "Unit", w: "w-12", render: (it) => <span className="text-neutral-600">{it.unit}</span> },
    { id: "rate", label: labelOverrides["rate"] || "Rate", w: "w-20", align: "right", render: (it) => <span className="font-mono">{it.linked && it.linked.show_price === false ? "—" : fmt(it.unit_price)}</span> },
    { id: "discount", label: labelOverrides["discount"] || "Disc%", w: "w-12", align: "right", render: (it) => <span className="font-mono">{it.discount || 0}</span> },
    ...customCols.map<Col>((c) => ({
      id: `custom:${c.key}`, label: c.label,
      render: (it) => <span className="text-neutral-700">{String(it.custom?.[c.key] ?? "")}</span>,
    })),
  ];

  const visibleCols = allCols.filter((c) => {
    if (hidden.has(c.id)) return false;
    if (c.alwaysShow) return true;
    if (c.id === "description") return splitDescription && hasAny((it) => {
      const desc = it.linked && it.linked.show_description ? (it.linked.description || "") : it.description;
      return !!desc?.trim();
    });
    if (!autoHide) return true;
    if (c.id === "image") return nonEmpty.image;
    if (c.id === "moc") return nonEmpty.moc;
    if (c.id === "qty") return nonEmpty.qty;
    if (c.id === "unit") return nonEmpty.unit;
    if (c.id === "rate") return nonEmpty.rate;
    if (c.id === "discount") return nonEmpty.discount;
    if (c.id.startsWith("custom:")) return customNonEmpty(c.id.slice(7));
    return true;
  });

  // Re-order according to layout.column_order (ids that match)
  const colOrder = layout.column_order || [];
  visibleCols.sort((a, b) => {
    const ia = colOrder.indexOf(a.id); const ib = colOrder.indexOf(b.id);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const colCount = visibleCols.length + 2; // # + amount
  const PAGE_MM = 297;
  const PAGE_MARGIN_MM = 8;
  const headerIsImage = brand.header_type === "image" && !!brand.header_image;
  const footerIsImage = brand.footer_type === "image" && !!brand.footer_image;
  const headerAreaMm = FIXED_HEADER_MM;
  const footerAreaMm = footerIsImage ? Math.max(10, brand.footer_height_mm || 18) + 1 : 12;
  const CONTENT_BOTTOM_GUARD_MM = 4;
  const contentAreaMm = Math.max(90, PAGE_MM - PAGE_MARGIN_MM * 2 - headerAreaMm - footerAreaMm - CONTENT_BOTTOM_GUARD_MM);

  type Block =
    | { type: "intro"; h: number }
    | { type: "tableHeader"; h: number }
    | { type: "group"; h: number; group: string }
    | { type: "item"; h: number; item: QuotationItem; serial: number }
    | { type: "noItems"; h: number }
    | { type: "totals"; h: number }
    | { type: "terms"; h: number }
    | { type: "productNotes"; h: number; notes: { idx: number; name: string; parts: { label: string; value: string }[] }[] }
    | { type: "notes"; h: number; notes: string[] }
    | { type: "bank"; h: number }
    | { type: "stdterms"; h: number }
    | { type: "globalnotes"; h: number };

  const pages: Block[][] = [[]];
  const usedHeights: number[] = [0];
  const ROW_GUARD_MM = 3.5;
  const canFit = (used: number, need: number, guard = 0) => used + need <= contentAreaMm - guard;
  const ensurePage = () => {
    const idx = pages.length - 1;
    return { idx, used: usedHeights[idx] };
  };
  const pushBlock = (b: Block, forceNewPage = false) => {
    let { idx, used } = ensurePage();
    if (forceNewPage || used + b.h > contentAreaMm) {
      pages.push([]);
      usedHeights.push(0);
      idx += 1;
    }
    pages[idx].push(b);
    usedHeights[idx] += b.h;
  };

  const lineCount = (s: string, chars = 42) => Math.max(1, Math.ceil((s || "").trim().length / chars));
  const itemHeight = (it: QuotationItem) => {
    const desc = it.linked && it.linked.show_description ? (it.linked.description || "") : it.description || "";
    const name = it.linked?.name || it.item_name || "";
    const lines = Math.max(lineCount(name, 30), lineCount(desc, 44));
    const hasImage = !!(it.linked?.show_image && it.linked.image_url);
    const imagePenalty = hasImage ? 4.5 : 0;
    return 13 + Math.min(22, (lines - 1) * 4.2) + imagePenalty;
  };

  const headerBlock = headerIsImage ? (
    <div className="pb-1 border-b-2" style={{ borderColor: theme.accent }}>
      <div
        className="w-full overflow-hidden"
        style={{ height: `${Math.max(10, headerAreaMm - 1)}mm` }}
      >
        <img
          src={brand.header_image}
          alt="Company header"
          className="w-full h-full"
          style={{
            objectFit: "contain",
            objectPosition: `calc(50% + ${brand.header_offset_x || 0}%) calc(50% + ${brand.header_offset_y || 0}%)`,
            transform: `scale(${brand.header_zoom || 1})`,
            transformOrigin: "center",
          }}
        />
      </div>
    </div>
  ) : (
    <div className="pb-3 border-b-2" style={{ borderColor: theme.accent }}>
      <div className={`flex items-start justify-between gap-4 ${brand.header_layout === "right" ? "flex-row-reverse" : ""}`}>
        <div className="flex items-start gap-3">
          {brand.header_logo && brand.header_logo_align !== "right" && (
            <img
              src={brand.header_logo}
              alt="Company logo"
              className="object-contain shrink-0"
              style={{ width: `${brand.header_logo_size_mm || 16}mm`, height: `${brand.header_logo_size_mm || 16}mm` }}
            />
          )}
          <div>
            <div className="text-[26px] font-serif leading-none">{brand.company || "Your Company"}</div>
            {brand.header_show_tagline !== false && <div className="text-xs text-neutral-500 mt-1">{brand.tagline}</div>}
            <div className="text-[10px] text-neutral-500 mt-2 max-w-[70mm] leading-snug">{brand.address}</div>
            {(brand.email || brand.phone) && (
              <div className="text-[10px] text-neutral-500 mt-1">{brand.email || ""}{brand.email && brand.phone ? " · " : ""}{brand.phone || ""}</div>
            )}
            {brand.website && <div className="text-[10px] text-neutral-500">{brand.website}</div>}
            {brand.gst_number && <div className="text-[10px] text-neutral-500">GST: {brand.gst_number}</div>}
          </div>
          {brand.header_logo && brand.header_logo_align === "right" && (
            <img
              src={brand.header_logo}
              alt="Company logo"
              className="object-contain shrink-0"
              style={{ width: `${brand.header_logo_size_mm || 16}mm`, height: `${brand.header_logo_size_mm || 16}mm` }}
            />
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Quotation</div>
          {brand.header_show_quote_no !== false && <div className="text-2xl font-mono mt-1">{q.quote_no}</div>}
          <div className="text-[10px] text-neutral-500 mt-1">Date: {q.date}</div>
          {brand.header_show_validity !== false && q.valid_until && <div className="text-[10px] text-neutral-500">Valid Until: {q.valid_until}</div>}
        </div>
      </div>
    </div>
  );

  const footerBlock = footerIsImage ? (
    <div className={`quote-footer pt-1 ${brand.footer_show_divider !== false ? "border-t border-neutral-200" : ""}`}>
      <div
        className="w-full overflow-hidden"
        style={{ height: `${brand.footer_height_mm || 18}mm` }}
      >
        <img
          src={brand.footer_image}
          alt="Company footer"
          className="w-full h-full"
          style={{
            objectFit: brand.footer_fit || "contain",
            objectPosition: `calc(50% + ${brand.footer_offset_x || 0}%) calc(50% + ${brand.footer_offset_y || 0}%)`,
            transform: `scale(${brand.footer_zoom || 1})`,
            transformOrigin: "center",
          }}
        />
      </div>
    </div>
  ) : (
    <div className={`quote-footer pt-1 text-[10px] text-neutral-500 text-center leading-snug ${brand.footer_show_divider !== false ? "border-t border-neutral-200" : ""}`}>
      {(brand.footer_text || `This quotation is valid for 30 days from the date of issue · ${brand.company}`).slice(0, 280)}
    </div>
  );

  const pageNumberText = (idx: number, total: number) => {
    const n = idx + 1;
    if (brand.page_numbering_format === "fraction") return `${n} / ${total}`;
    if (brand.page_numbering_format === "simple") return `${n}`;
    return `Page ${n} of ${total}`;
  };

  const clientDetailLines =
    (q.client.address ? 1 : 0) +
    (q.client.phone ? 1 : 0) +
    (q.client.email ? 1 : 0);
  const introHeight = headerIsImage
    ? 30 + clientDetailLines * 2
    : 20 + (q.client.address ? 2 : 0) + ((q.client.phone || q.client.email) ? 2 : 0);

  // Build page blocks in safe content area
  pushBlock({ type: "intro", h: introHeight });
  if (items.length === 0) {
    pushBlock({ type: "tableHeader", h: 8 });
    pushBlock({ type: "noItems", h: 12 });
  } else {
    pushBlock({ type: "tableHeader", h: 8 });
    let lastGroup = "__init__";
    items.forEach((it, i) => {
      const g = it.group || "Items";
      const gh = 6.5;
      if (showCatHeaders && g !== lastGroup) {
        const groupBlock: Block = { type: "group", h: gh, group: g };
        const rowBlock: Block = { type: "item", h: itemHeight(it), item: it, serial: i + 1 };
        const { used } = ensurePage();
        if (!canFit(used, groupBlock.h + rowBlock.h, ROW_GUARD_MM)) {
          pushBlock({ type: "tableHeader", h: 8 }, true);
        }
        pushBlock(groupBlock);
      }
      lastGroup = g;
      const row = { type: "item", h: itemHeight(it), item: it, serial: i + 1 } as Block;
      const { used } = ensurePage();
      if (!canFit(used, row.h, ROW_GUARD_MM)) {
        pushBlock({ type: "tableHeader", h: 8 }, true);
      }
      pushBlock(row);
    });
  }
  pushBlock({ type: "totals", h: 20 });
  pushBlock({ type: "terms", h: 12 + 4.5 * ([
    q.terms.payment_terms,
    q.terms.delivery_terms,
    q.terms.delivery_timeline,
    q.terms.shipping_terms,
    q.terms.incoterms,
  ].filter(Boolean).length) });

  const productNotes = q.items
    .map((it, idx) => {
      if (!it.linked) return null;
      const parts: { label: string; value: string }[] = [];
      if (it.linked.show_delivery && it.linked.delivery_timeline) parts.push({ label: "Delivery", value: it.linked.delivery_timeline });
      if (it.linked.show_terms && it.linked.specific_terms) parts.push({ label: "T&C", value: it.linked.specific_terms });
      if (parts.length === 0) return null;
      return { idx: idx + 1, name: it.linked.name || it.item_name, parts };
    })
    .filter(Boolean) as { idx: number; name: string; parts: { label: string; value: string }[] }[];
  if (productNotes.length > 0) {
    pushBlock({ type: "productNotes", h: 10 + productNotes.length * 5.8, notes: productNotes });
  }
  if (q.notes.length > 0) {
    pushBlock({ type: "notes", h: 9 + q.notes.length * 5.2, notes: q.notes });
  }
  const bank = brand.bank_details || {};
  const hasBank = !!(bank.bank_name || bank.account_name || bank.account_number || bank.ifsc_swift || bank.branch || bank.upi_id);
  if (brand.include_bank_details && hasBank) {
    const rows = [bank.bank_name, bank.account_name, bank.account_number, bank.ifsc_swift, bank.branch, bank.upi_id].filter(Boolean).length;
    pushBlock({ type: "bank", h: 10 + rows * 4.8 });
  }
  const st = brand.standard_terms || {};
  const hasStdTerms = !!(st.terms_conditions || st.payment_terms || st.delivery_terms || st.warranty_terms || st.disclaimer_notes);
  if (brand.include_standard_terms && hasStdTerms) {
    const rows = [st.terms_conditions, st.payment_terms, st.delivery_terms, st.warranty_terms, st.disclaimer_notes].filter(Boolean).length;
    pushBlock({ type: "stdterms", h: 10 + rows * 5.2 });
  }
  const gn = brand.global_notes || {};
  const hasGlobalNotes = !!(gn.footer_notes || gn.thank_you_line || gn.compliance_notes || gn.legal_text || gn.export_notes);
  if (brand.include_global_notes && hasGlobalNotes) {
    const rows = [gn.footer_notes, gn.thank_you_line, gn.compliance_notes, gn.legal_text, gn.export_notes].filter(Boolean).length;
    pushBlock({ type: "globalnotes", h: 10 + rows * 5.2 });
  }

  const renderTable = (tableBlocks: Block[]) => (
    <table className="quote-table w-full mt-4 text-[11px] border-collapse">
      <thead>
        <tr className="text-left" style={{ background: theme.header_bg, color: theme.header_text }}>
          <th className="px-2 py-2 w-8 text-center">#</th>
          {visibleCols.map((c) => (
            <th key={c.id} className={`px-2 py-2 ${c.w || ""} ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
          ))}
          <th className="px-2 py-2 text-right w-24">Amount</th>
        </tr>
      </thead>
      <tbody>
        {tableBlocks.map((b, bi) => {
          if (b.type === "group") {
            return (
              <tr key={`g-${bi}`} className="keep-together">
                <td colSpan={colCount} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-bold border-y" style={{ background: theme.category_bg, color: theme.category_text, borderColor: theme.category_border }}>
                  {b.group}
                </td>
              </tr>
            );
          }
          if (b.type === "item") {
            const it = b.item;
            return (
              <tr key={it.id} className="keep-together border-b border-neutral-200 align-top" style={it.highlight ? { background: "#fff7d6" } : undefined}>
                <td className="px-2 py-2 text-center text-neutral-500">{b.serial}</td>
                {visibleCols.map((c) => (
                  <td key={c.id} className={`px-2 py-2 ${c.align === "right" ? "text-right" : ""}`}>{c.render(it, b.serial - 1)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-semibold">{sym}{fmt(lineTotal(it))}</td>
              </tr>
            );
          }
          if (b.type === "noItems") {
            return <tr key="empty"><td colSpan={colCount} className="text-center py-8 text-neutral-400">No items</td></tr>;
          }
          return null;
        })}
      </tbody>
    </table>
  );

  const renderBlocks = (blocks: Block[]) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === "tableHeader" || b.type === "group" || b.type === "item" || b.type === "noItems") {
        const tableBlocks: Block[] = [];
        while (i < blocks.length && (blocks[i].type === "tableHeader" || blocks[i].type === "group" || blocks[i].type === "item" || blocks[i].type === "noItems")) {
          if (blocks[i].type !== "tableHeader") tableBlocks.push(blocks[i]);
          i++;
        }
        i--;
        out.push(<Fragment key={`table-${i}`}>{renderTable(tableBlocks)}</Fragment>);
        continue;
      }
      if (b.type === "intro") {
        if (headerIsImage) {
          out.push(
            <div key="intro" className="mt-3 border-b border-neutral-200 pb-3 pt-1">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Quotation To</div>
                  <div className="text-[17px] font-semibold leading-tight">{q.client.company_name || "—"}</div>
                  <div className="text-xs text-neutral-700 mt-1">Attn: {q.client.contact_person || "—"}</div>
                  {q.client.address && <div className="text-[11px] text-neutral-600 mt-1.5 leading-snug">{q.client.address}</div>}
                  {(q.client.phone || q.client.email) && (
                    <div className="text-[11px] text-neutral-600 mt-1.5">
                      {q.client.phone || "—"}{q.client.phone && q.client.email ? " · " : ""}{q.client.email || ""}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Quotation</div>
                  <div className="text-2xl font-mono mt-1">{q.quote_no}</div>
                  <div className="text-[11px] text-neutral-600 mt-2">Date: {q.date}</div>
                  <div className="text-[11px] text-neutral-600">Valid Till: {q.valid_until || "—"}</div>
                </div>
              </div>
              <div className="mt-3.5 pt-2 border-t border-neutral-200">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Subject / Project</div>
                <div className="text-sm font-medium leading-snug">{q.subject || "Quotation"}</div>
              </div>
            </div>,
          );
        } else {
          out.push(
            <div key="intro" className="grid grid-cols-2 gap-6 mt-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Quotation To</div>
                <div className="text-sm font-semibold">{q.client.company_name || "—"}</div>
                <div className="text-xs text-neutral-700 mt-0.5">Attn: {q.client.contact_person || "—"}</div>
                {q.client.address && <div className="text-[11px] text-neutral-600 mt-1 leading-snug">{q.client.address}</div>}
                <div className="text-[11px] text-neutral-600 mt-1">
                  {q.client.email}{q.client.email && q.client.phone ? " · " : ""}{q.client.phone}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Subject</div>
                <div className="text-sm font-medium leading-snug">{q.subject || "Quotation"}</div>
              </div>
            </div>,
          );
        }
      } else if (b.type === "totals") {
        out.push(<div key="totals" className="flex justify-end mt-2">
        <div className="w-72 text-[11px]">
          <div className="flex justify-between py-1"><span className="text-neutral-600">Subtotal</span><span className="font-mono">{sym}{fmt(totals.subtotal)}</span></div>
          <div className="flex justify-between py-1"><span className="text-neutral-600">Tax ({q.tax_percent}%)</span><span className="font-mono">{sym}{fmt(totals.tax)}</span></div>
          <div className="flex justify-between py-2 mt-1 border-t-2 text-sm font-semibold" style={{ borderColor: theme.accent }}>
            <span>Grand Total</span><span className="font-mono">{sym}{fmt(totals.grand)}</span>
          </div>
        </div>
      </div>);
      } else if (b.type === "terms") {
        out.push(<div key="terms" className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
        <div className="col-span-2 text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Commercial Terms</div>
        {([
          ["Payment", q.terms.payment_terms],
          ["Delivery", q.terms.delivery_terms],
          ["Timeline", q.terms.delivery_timeline],
          ["Shipping", q.terms.shipping_terms],
          ["Incoterms", q.terms.incoterms],
        ] as const).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-neutral-500 w-20 shrink-0">{k}:</span>
            <span>{v}</span>
          </div>
        ))}
      </div>);
      } else if (b.type === "productNotes") {
        out.push(<div key="pnotes" className="mt-4 text-[11px]">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Product-specific Delivery & Terms</div>
            <ul className="space-y-1 text-neutral-700">
              {b.notes.map((n) => (
                <li key={n.idx} className="leading-snug">
                  <span className="font-semibold">#{n.idx} {n.name}:</span>{" "}
                  {n.parts.map((p, i) => (
                    <span key={i}>{i > 0 && " · "}<span className="text-neutral-500">{p.label}:</span> {p.value}</span>
                  ))}
                </li>
              ))}
            </ul>
          </div>);
      } else if (b.type === "notes") {
        out.push(<div key="notes" className="mt-4 text-[11px]">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Notes</div>
          <ul className="list-disc pl-4 space-y-0.5 text-neutral-700">
            {b.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>);
      } else if (b.type === "bank") {
        out.push(
          <div key="bank" className="mt-4 text-[11px]">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Bank Details</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-neutral-700">
              {brand.bank_details?.bank_name && <div><span className="text-neutral-500">Bank:</span> {brand.bank_details.bank_name}</div>}
              {brand.bank_details?.account_name && <div><span className="text-neutral-500">A/C Name:</span> {brand.bank_details.account_name}</div>}
              {brand.bank_details?.account_number && <div><span className="text-neutral-500">A/C No:</span> {brand.bank_details.account_number}</div>}
              {brand.bank_details?.ifsc_swift && <div><span className="text-neutral-500">IFSC/SWIFT:</span> {brand.bank_details.ifsc_swift}</div>}
              {brand.bank_details?.branch && <div><span className="text-neutral-500">Branch:</span> {brand.bank_details.branch}</div>}
              {brand.bank_details?.upi_id && <div><span className="text-neutral-500">UPI:</span> {brand.bank_details.upi_id}</div>}
            </div>
          </div>,
        );
      } else if (b.type === "stdterms") {
        out.push(
          <div key="stdterms" className="mt-4 text-[11px]">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Standard Terms & Conditions</div>
            <ul className="space-y-1 text-neutral-700">
              {brand.standard_terms?.terms_conditions && <li>{brand.standard_terms.terms_conditions}</li>}
              {brand.standard_terms?.payment_terms && <li><span className="text-neutral-500">Payment:</span> {brand.standard_terms.payment_terms}</li>}
              {brand.standard_terms?.delivery_terms && <li><span className="text-neutral-500">Delivery:</span> {brand.standard_terms.delivery_terms}</li>}
              {brand.standard_terms?.warranty_terms && <li><span className="text-neutral-500">Warranty:</span> {brand.standard_terms.warranty_terms}</li>}
              {brand.standard_terms?.disclaimer_notes && <li><span className="text-neutral-500">Disclaimer:</span> {brand.standard_terms.disclaimer_notes}</li>}
            </ul>
          </div>,
        );
      } else if (b.type === "globalnotes") {
        out.push(
          <div key="globalnotes" className="mt-4 text-[11px]">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Global Notes</div>
            <ul className="space-y-1 text-neutral-700">
              {brand.global_notes?.footer_notes && <li>{brand.global_notes.footer_notes}</li>}
              {brand.global_notes?.thank_you_line && <li>{brand.global_notes.thank_you_line}</li>}
              {brand.global_notes?.compliance_notes && <li>{brand.global_notes.compliance_notes}</li>}
              {brand.global_notes?.legal_text && <li>{brand.global_notes.legal_text}</li>}
              {brand.global_notes?.export_notes && <li>{brand.global_notes.export_notes}</li>}
            </ul>
          </div>,
        );
      }
    }
    return out;
  };

  return (
    <div className="print-area paged-preview bg-transparent text-[#0a0f1f] mx-auto">
      {pages.map((pageBlocks, idx) => (
        <section key={idx} className="doc-page bg-white mx-auto" style={{ width: "210mm", height: "297mm", padding: `${PAGE_MARGIN_MM}mm` }}>
          {brand.watermark_enabled && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ opacity: brand.watermark_opacity ?? 0.1, zIndex: 0 }}
            >
              {brand.watermark_image ? (
                <img
                  src={brand.watermark_image}
                  alt="Watermark"
                  className="object-contain"
                  style={{ width: `${(brand.watermark_scale ?? 0.5) * 80}%` }}
                />
              ) : (
                <div className="text-5xl font-semibold text-neutral-500 tracking-[0.15em]">{brand.watermark_text || ""}</div>
              )}
            </div>
          )}
          <div className="doc-header overflow-hidden" style={{ height: `${headerAreaMm}mm` }}>{headerBlock}</div>
          <div className="doc-content overflow-hidden relative z-[1]" style={{ height: `${contentAreaMm}mm` }}>
            {renderBlocks(pageBlocks)}
          </div>
          <div className="doc-footer overflow-hidden" style={{ height: `${footerAreaMm}mm` }}>{footerBlock}</div>
          {brand.page_numbering_enabled && brand.page_numbering_position !== "footer_area" && (
            <div
              className={`absolute text-[9px] text-neutral-500 ${brand.page_numbering_position === "bottom_center" ? "left-1/2 -translate-x-1/2" : "right-[10mm]"}`}
              style={{ bottom: "2mm" }}
            >
              {pageNumberText(idx, pages.length)}
            </div>
          )}
          {brand.page_numbering_enabled && brand.page_numbering_position === "footer_area" && (
            <div className="absolute right-[10mm] text-[9px] text-neutral-500" style={{ bottom: `${PAGE_MARGIN_MM + 1}mm` }}>
              {pageNumberText(idx, pages.length)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};
