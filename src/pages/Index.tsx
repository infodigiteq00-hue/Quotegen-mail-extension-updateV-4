import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ExtractEmailDialog } from "@/components/ExtractEmailDialog";
import { QuotationEditor } from "@/components/QuotationEditor";
import { QuotationPreview } from "@/components/QuotationPreview";
import { AICommandBar } from "@/components/AICommandBar";
import { BrandingSettings, Quotation, defaultBranding, emptyQuotation, loadDefaultBranding, saveDefaultBranding } from "@/lib/quotation";
import { useHistory } from "@/hooks/useHistory";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, FileText, Settings2, Package, Save, LayoutDashboard, Heading, PanelBottom, FileCog, Table2, SlidersHorizontal, Eye, Minus, Plus, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getQuotationRecord, markExported, saveQuotationRecord } from "@/lib/quotationRecords";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const shiftHex = (hex: string, delta: number) => {
  const clean = (hex || "#1e50e6").replace("#", "");
  const norm = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  const p = (i: number) => clamp(parseInt(norm.slice(i, i + 2), 16) + delta, 0, 255);
  return `#${[p(0), p(2), p(4)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

const PRESET_THEMES = [
  { name: "Professional Blue", t: { header_bg: "#1e50e6", header_text: "#ffffff", category_bg: "#eaf0ff", category_text: "#1e50e6", category_border: "#cdd9f7", accent: "#1e50e6" } },
  { name: "Industrial Grey", t: { header_bg: "#4b5563", header_text: "#ffffff", category_bg: "#eef1f4", category_text: "#374151", category_border: "#d1d5db", accent: "#4b5563" } },
  { name: "Minimal White", t: { header_bg: "#f3f4f6", header_text: "#111827", category_bg: "#fafafa", category_text: "#374151", category_border: "#e5e7eb", accent: "#9ca3af" } },
  { name: "Corporate Black", t: { header_bg: "#111827", header_text: "#ffffff", category_bg: "#f3f4f6", category_text: "#111827", category_border: "#d1d5db", accent: "#111827" } },
  { name: "Clean Pharma", t: { header_bg: "#0ea5a4", header_text: "#ffffff", category_bg: "#e6fffb", category_text: "#0f766e", category_border: "#99f6e4", accent: "#0ea5a4" } },
  { name: "Manufacturing Red", t: { header_bg: "#b91c1c", header_text: "#ffffff", category_bg: "#fee2e2", category_text: "#991b1b", category_border: "#fecaca", accent: "#b91c1c" } },
  { name: "Dark Navy", t: { header_bg: "#1e3a8a", header_text: "#ffffff", category_bg: "#e0e7ff", category_text: "#1e3a8a", category_border: "#c7d2fe", accent: "#1e3a8a" } },
  { name: "Steel Grey", t: { header_bg: "#334155", header_text: "#ffffff", category_bg: "#e2e8f0", category_text: "#1e293b", category_border: "#cbd5e1", accent: "#334155" } },
];

const COLOR_PALETTE = [
  "#1e50e6", "#0ea5a4", "#111827", "#334155", "#4b5563", "#b91c1c", "#7c3aed", "#0369a1",
  "#ffffff", "#f3f4f6", "#e5e7eb", "#cbd5e1", "#eaf0ff", "#fee2e2", "#e6fffb", "#f5f3ff",
  "#000000", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#f59e0b", "#16a34a", "#ec4899",
];

const ImageAdjuster = ({
  src,
  frameHeight,
  zoom,
  offsetX,
  offsetY,
  onChange,
  onReset,
}: {
  src: string;
  frameHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  onChange: (next: { zoom?: number; offsetX?: number; offsetY?: number }) => void;
  onReset: () => void;
}) => {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="space-y-2">
      <div
        className="w-full border rounded-md bg-muted/20 overflow-hidden relative cursor-grab active:cursor-grabbing"
        style={{ height: `${Math.max(72, frameHeight * 3.2)}px` }}
        onMouseDown={(e) => setDrag({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => {
          if (!drag) return;
          const target = e.currentTarget.getBoundingClientRect();
          const dx = ((e.clientX - drag.x) / target.width) * 100;
          const dy = ((e.clientY - drag.y) / target.height) * 100;
          onChange({ offsetX: clamp(offsetX + dx, -50, 50), offsetY: clamp(offsetY + dy, -50, 50) });
          setDrag({ x: e.clientX, y: e.clientY });
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <img
          src={src}
          alt="Adjust"
          className="w-full h-full pointer-events-none select-none"
          style={{
            objectFit: "contain",
            objectPosition: `calc(50% + ${offsetX}%) calc(50% + ${offsetY}%)`,
            transform: `scale(${zoom})`,
            transformOrigin: "center",
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Zoom: {zoom.toFixed(2)}x</Label>
        <Input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const z = clamp(+e.target.value || 1, 1, 3);
            onChange({ zoom: z });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">X Offset: {offsetX.toFixed(1)}%</Label>
          <Input type="range" min={-50} max={50} step={0.1} value={offsetX} onChange={(e) => {
            const x = clamp(+e.target.value || 0, -50, 50);
            onChange({ offsetX: x });
          }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Y Offset: {offsetY.toFixed(1)}%</Label>
          <Input type="range" min={-50} max={50} step={0.1} value={offsetY} onChange={(e) => {
            const y = clamp(+e.target.value || 0, -50, 50);
            onChange({ offsetY: y });
          }} />
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onReset}>Reset positioning</Button>
    </div>
  );
};

const PaletteColorPicker = ({
  pickerId,
  activePickerId,
  setActivePickerId,
  label,
  value,
  onChange,
}: {
  pickerId: string;
  activePickerId: string | null;
  setActivePickerId: (id: string | null) => void;
  label: string;
  value: string;
  onChange: (c: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const open = activePickerId === pickerId;
  const normalized = useMemo(() => {
    const raw = (draft || "").trim().replace("#", "");
    if (!raw) return "#000000";
    if (raw.length === 3) return `#${raw.split("").map((c) => c + c).join("")}`;
    return `#${raw.padEnd(6, "0").slice(0, 6)}`;
  }, [draft]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs">{label}</Label>
      <button
        type="button"
        onClick={() => setActivePickerId(open ? null : pickerId)}
        className="w-full h-10 rounded-md border bg-background px-2 flex items-center gap-2"
      >
        <span className="h-6 w-8 rounded border" style={{ background: normalized }} />
        <span className="text-sm font-mono">{normalized.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[min(300px,calc(100vw-2rem))] max-w-[300px] rounded-xl border bg-[#1f2024] text-white p-3 shadow-2xl left-0 right-0 sm:left-auto sm:right-auto">
          <div className="space-y-2">
            <input
              type="color"
              value={normalized}
              onChange={(e) => {
                setDraft(e.target.value);
                onChange(e.target.value);
              }}
              className="w-full h-10 rounded border border-white/20 bg-transparent"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">Hex</span>
              <input
                value={normalized.replace("#", "").toUpperCase()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                  setDraft(`#${raw}`);
                  if (raw.length === 6) onChange(`#${raw}`);
                }}
                className="flex-1 h-9 rounded-md border border-white/15 bg-white/5 px-2 font-mono text-sm"
              />
              <button
                type="button"
                className="h-9 px-2 rounded-md border border-white/15 text-xs"
                onClick={() => { onChange(normalized); setActivePickerId(null); }}
              >
                Done
              </button>
            </div>
          </div>
          <div className="h-px bg-white/10 my-3" />
          <div className="text-xs text-white/70 mb-2">On this page</div>
          <div className="grid grid-cols-9 gap-2 max-h-36 overflow-y-auto pr-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={`${label}-${c}`}
                type="button"
                title={c}
                onClick={() => {
                  setDraft(c);
                  onChange(c);
                }}
                className={`h-6 w-6 rounded border ${normalized.toLowerCase() === c.toLowerCase() ? "ring-2 ring-white" : "border-white/20"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Index = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state: q, set: setQ, reset } = useHistory<Quotation>(emptyQuotation());
  const [recordId, setRecordId] = useState<string | null>(routeId || null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [brandingSection, setBrandingSection] = useState<"overview" | "header" | "footer" | "elements" | "table" | "advanced">("overview");
  const [studioZoom, setStudioZoom] = useState(0.58);
  const [hoverTheme, setHoverTheme] = useState<any | null>(null);
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [includeBankDetails, setIncludeBankDetails] = useState(true);
  const [includeStandardTerms, setIncludeStandardTerms] = useState(true);
  const [includeGlobalNotes, setIncludeGlobalNotes] = useState(true);
  const [printOverrides, setPrintOverrides] = useState<{ bank: boolean; terms: boolean; notes: boolean } | null>(null);
  const [workspacePane, setWorkspacePane] = useState<"editor" | "preview">("editor");

  const [brand, setBrand] = useState<BrandingSettings>(defaultBranding());

  useEffect(() => {
    setBrand(loadDefaultBranding());
  }, []);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const record = await getQuotationRecord(routeId);
        if (!record) {
          toast.error("Quotation not found");
          navigate("/records");
          return;
        }
        reset(record.quotation_data);
        if (record.branding_snapshot) setBrand(record.branding_snapshot);
        setRecordId(record.id);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load quotation");
      }
    })();
  }, [routeId, navigate, reset]);

  const handleSave = async () => {
    const hasData = q.items.length > 0 || q.client.company_name;
    if (!hasData) return;
    setSaving(true);
    try {
      const saved = await saveQuotationRecord(q, brand, recordId);
      setRecordId(saved.id);
      if (!routeId) navigate(`/quote/${saved.id}`, { replace: true });
      toast.success(`Saved as ${saved.quote_no}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  useEffect(() => {
    if (brandingOpen) {
      setBrandingSection("overview");
      setActiveColorPickerId(null);
    }
  }, [brandingOpen]);

  useEffect(() => {
    const clear = () => setPrintOverrides(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const hasContent = q.items.length > 0 || q.client.company_name;

  useEffect(() => {
    if (searchParams.get("export") === "1" && hasContent) {
      setTimeout(() => onExportClick(), 600);
    }
  }, [searchParams, hasContent]);

  const themeBase = {
    header_bg: "#1e50e6",
    header_text: "#ffffff",
    category_bg: "#eaf0ff",
    category_text: "#1e50e6",
    category_border: "#cdd9f7",
    accent: "#1e50e6",
  };

  const onBrandImage = (key: "header_image" | "footer_image" | "header_logo" | "watermark_image") => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = String(reader.result || "");
      if (!next) return;
      setBrand((prev) => ({ ...prev, [key]: next }));
    };
    reader.readAsDataURL(file);
  };

  const clearBrandImage = (key: "header_image" | "footer_image" | "header_logo" | "watermark_image") => {
    setBrand((prev) => ({ ...prev, [key]: undefined }));
  };

  const updateImageAdjust = (kind: "header" | "footer", next: { zoom?: number; offsetX?: number; offsetY?: number }) => {
    if (kind === "header") {
      setBrand((prev) => ({
        ...prev,
        header_zoom: next.zoom ?? prev.header_zoom,
        header_offset_x: next.offsetX ?? prev.header_offset_x,
        header_offset_y: next.offsetY ?? prev.header_offset_y,
      }));
      return;
    }
    setBrand((prev) => ({
      ...prev,
      footer_zoom: next.zoom ?? prev.footer_zoom,
      footer_offset_x: next.offsetX ?? prev.footer_offset_x,
      footer_offset_y: next.offsetY ?? prev.footer_offset_y,
    }));
  };

  const resetImageAdjust = (kind: "header" | "footer") => {
    if (kind === "header") {
      setBrand((prev) => ({ ...prev, header_zoom: 1, header_offset_x: 0, header_offset_y: 0 }));
    } else {
      setBrand((prev) => ({ ...prev, footer_zoom: 1, footer_offset_x: 0, footer_offset_y: 0 }));
    }
  };

  const suggestThemeFromImage = async (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const w = 32;
    const h = 32;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const px = w * h;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r = Math.round(r / px);
    g = Math.round(g / px);
    b = Math.round(b / px);
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    return {
      header_bg: hex,
      header_text: "#ffffff",
      category_bg: `${hex}1A`,
      category_text: hex,
      category_border: `${hex}55`,
      accent: hex,
    };
  };

  const applyAutoTheme = async () => {
    const src = brand.header_image || brand.footer_image;
    if (!src) return;
    try {
      const t = await suggestThemeFromImage(src);
      if (!t) return;
      setBrand((prev) => ({ ...prev, table_theme: t }));
    } catch {}
  };

  const updateTheme = (patch: Partial<typeof themeBase>) => {
    setBrand((prev) => ({ ...prev, table_theme: { ...themeBase, ...(prev.table_theme || {}), ...patch } }));
  };
  const applyTheme = (theme: typeof themeBase) => {
    setBrand((prev) => ({ ...prev, table_theme: { ...themeBase, ...theme } }));
    setHoverTheme(null);
  };

  const suggestedThemes = (() => {
    const base = brand.table_theme?.accent || brand.table_theme?.header_bg || "#1e50e6";
    return [
      { name: "Brand Matched", t: { header_bg: base, header_text: "#ffffff", category_bg: shiftHex(base, 205), category_text: shiftHex(base, -15), category_border: shiftHex(base, 140), accent: base } },
      { name: "Corporate Blue", t: { header_bg: shiftHex(base, -10), header_text: "#ffffff", category_bg: shiftHex(base, 185), category_text: shiftHex(base, -25), category_border: shiftHex(base, 120), accent: shiftHex(base, -10) } },
      { name: "Modern Dark", t: { header_bg: "#1f2937", header_text: "#ffffff", category_bg: shiftHex(base, 210), category_text: "#374151", category_border: "#d1d5db", accent: base } },
      { name: "Industrial Grey", t: { header_bg: "#475569", header_text: "#ffffff", category_bg: "#eef2f7", category_text: "#334155", category_border: "#cbd5e1", accent: base } },
      { name: "Minimal Clean", t: { header_bg: "#f5f5f5", header_text: "#111827", category_bg: "#fafafa", category_text: "#374151", category_border: "#e5e7eb", accent: base } },
    ];
  })();

  const previewTheme = { ...themeBase, ...(brand.table_theme || {}), ...(hoverTheme || {}) };
  const previewInclude = {
    bank: brand.defaults_behavior?.bank_details === "auto",
    terms: brand.defaults_behavior?.standard_terms === "auto",
    notes: brand.defaults_behavior?.global_notes === "auto",
  };
  const effectiveInclude = printOverrides || previewInclude;
  const previewBrand = {
    ...(hoverTheme ? { ...brand, table_theme: previewTheme } : brand),
    include_bank_details: effectiveInclude.bank,
    include_standard_terms: effectiveInclude.terms,
    include_global_notes: effectiveInclude.notes,
  };

  const askBank = brand.defaults_behavior?.bank_details === "ask";
  const askTerms = brand.defaults_behavior?.standard_terms === "ask";
  const askNotes = brand.defaults_behavior?.global_notes === "ask";
  const needsExportConfirmation = askBank || askTerms || askNotes;

  const runPrint = async () => {
    let id = recordId;
    if (!id && hasContent) {
      try {
        const saved = await saveQuotationRecord(q, brand, null);
        id = saved.id;
        setRecordId(saved.id);
        if (!routeId) navigate(`/quote/${saved.id}`, { replace: true });
      } catch {
        /* export still works without persistence */
      }
    }
    if (id) markExported(id).catch(() => {});
    window.print();
  };

  const onExportClick = () => {
    if (!needsExportConfirmation) {
      runPrint();
      return;
    }
    setIncludeBankDetails(askBank);
    setIncludeStandardTerms(askTerms);
    setIncludeGlobalNotes(askNotes);
    setExportConfirmOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* Top bar */}
      <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h11l3 3v10a2 2 0 0 1-2 2H5z" />
                <path d="M9 13l2 2 4-5" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold tracking-tight truncate">QuoteGen</div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end min-w-0">
            <Link to="/records"><Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3"><FolderOpen className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Records</span></Button></Link>
            <Link to="/catalog"><Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3"><Package className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Catalog</span></Button></Link>
            {hasContent && (
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{saving ? "Saving…" : recordId ? "Update" : "Save"}</span>
              </Button>
            )}
            <Sheet open={brandingOpen} onOpenChange={setBrandingOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3"><Settings2 className="h-4 w-4 sm:mr-1.5" /><span className="hidden md:inline">Branding</span></Button>
              </SheetTrigger>
              <SheetContent className="w-full max-w-[min(1500px,100vw)] sm:max-w-none p-0 overflow-hidden">
                <div className="h-full min-h-0 flex flex-col xl:grid xl:grid-cols-[220px_1fr_1.15fr] bg-muted/20">
                  <aside className="border-b xl:border-b-0 xl:border-r bg-background/80 p-3 sm:p-4 shrink-0">
                    <div className="text-sm font-semibold mb-3 xl:mb-4">Branding Studio</div>
                    <div className="flex xl:flex-col gap-1 overflow-x-auto xl:overflow-visible pb-1 xl:pb-0 -mx-1 px-1 xl:mx-0 xl:px-0">
                      {[
                        { id: "overview", label: "Overview", icon: LayoutDashboard },
                        { id: "header", label: "Header", icon: Heading },
                        { id: "footer", label: "Footer", icon: PanelBottom },
                        { id: "elements", label: "Document Elements", icon: FileCog },
                        { id: "table", label: "Table Design", icon: Table2 },
                        { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setBrandingSection(item.id as typeof brandingSection)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition whitespace-nowrap shrink-0 xl:shrink xl:w-full",
                            brandingSection === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 xl:mt-6">
                      <Button className="w-full h-10" onClick={() => { saveDefaultBranding(brand); setBrandingOpen(false); }}>
                        <Save className="h-4 w-4 mr-1.5" />Save default
                      </Button>
                    </div>
                  </aside>

                  <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-background">
                    {brandingSection === "overview" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">A. Document Branding</div>
                  <div className="space-y-1.5"><Label>Company name</Label><Input value={brand.company} onChange={(e) => setBrand({ ...brand, company: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Tagline</Label><Input value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Address / contact line</Label><Input value={brand.address} onChange={(e) => setBrand({ ...brand, address: e.target.value })} /></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label>Email</Label><Input value={brand.email || ""} onChange={(e) => setBrand({ ...brand, email: e.target.value })} /></div>
                          <div className="space-y-1.5"><Label>Phone</Label><Input value={brand.phone || ""} onChange={(e) => setBrand({ ...brand, phone: e.target.value })} /></div>
                          <div className="space-y-1.5"><Label>Website (optional)</Label><Input value={brand.website || ""} onChange={(e) => setBrand({ ...brand, website: e.target.value })} /></div>
                          <div className="space-y-1.5"><Label>GST Number (optional)</Label><Input value={brand.gst_number || ""} onChange={(e) => setBrand({ ...brand, gst_number: e.target.value })} /></div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Logo upload</Label>
                          <Input type="file" accept="image/*" onChange={onBrandImage("header_logo")} />
                          {brand.header_logo && <img src={brand.header_logo} alt="Header logo preview" className="h-16 object-contain border rounded-md bg-muted/20 px-2" />}
                        </div>
                      </section>
                    )}

                    {brandingSection === "header" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">B. Header Settings</div>
                          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={brand.header_type || "text"} onChange={(e) => setBrand({ ...brand, header_type: e.target.value as "text" | "image" })}>
                            <option value="text">Text Header</option>
                            <option value="image">Image Header</option>
                          </select>
                        </div>
                        {brand.header_type !== "image" ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={brand.header_show_tagline !== false} onChange={(e) => setBrand({ ...brand, header_show_tagline: e.target.checked })} />Show tagline</label>
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={brand.header_show_quote_no !== false} onChange={(e) => setBrand({ ...brand, header_show_quote_no: e.target.checked })} />Show quotation number</label>
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={brand.header_show_validity !== false} onChange={(e) => setBrand({ ...brand, header_show_validity: e.target.checked })} />Show valid from/till</label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Header layout</Label>
                                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.header_layout || "left"} onChange={(e) => setBrand({ ...brand, header_layout: e.target.value as "left" | "right" })}>
                                  <option value="left">Details left</option>
                                  <option value="right">Details right</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Logo alignment</Label>
                                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.header_logo_align || "left"} onChange={(e) => setBrand({ ...brand, header_logo_align: e.target.value as "left" | "right" })}>
                                  <option value="left">Left</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Logo size: {brand.header_logo_size_mm || 16}mm</Label>
                              <Input type="range" min={8} max={28} value={brand.header_logo_size_mm || 16} onChange={(e) => setBrand({ ...brand, header_logo_size_mm: +e.target.value || 16 })} />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Input type="file" accept="image/*" onChange={onBrandImage("header_image")} />
                            {brand.header_image && (
                              <details open className="rounded-lg border bg-muted/10">
                                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Customize header image</summary>
                                <div className="p-3 pt-0 space-y-3">
                                  <ImageAdjuster
                                    src={brand.header_image}
                                    frameHeight={brand.header_height_mm || 26}
                                    zoom={brand.header_zoom || 1}
                                    offsetX={brand.header_offset_x || 0}
                                    offsetY={brand.header_offset_y || 0}
                                    onChange={(next) => updateImageAdjust("header", next)}
                                    onReset={() => resetImageAdjust("header")}
                                  />
                                  <div className="space-y-1">
                                    <Label className="text-xs">Header height: {brand.header_height_mm || 26}mm</Label>
                                    <Input type="range" min={16} max={60} value={brand.header_height_mm || 26}
                                      onChange={(e) => setBrand({ ...brand, header_height_mm: +e.target.value || 26 })} />
                                  </div>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </section>
                    )}

                    {brandingSection === "footer" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">C. Footer Settings</div>
                          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={brand.footer_type || "text"} onChange={(e) => setBrand({ ...brand, footer_type: e.target.value as "text" | "image" })}>
                            <option value="text">Text Footer</option>
                            <option value="image">Image Footer</option>
                          </select>
                        </div>
                        {brand.footer_type !== "image" ? (
                          <div className="space-y-3">
                            <textarea
                              value={brand.footer_text || ""}
                              maxLength={280}
                              onChange={(e) => setBrand({ ...brand, footer_text: e.target.value })}
                              className="w-full min-h-[90px] rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Add disclaimer or footer message"
                            />
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <label className="flex items-center gap-2"><input type="checkbox" checked={brand.footer_show_divider !== false} onChange={(e) => setBrand({ ...brand, footer_show_divider: e.target.checked })} />Show divider line</label>
                              <span>{(brand.footer_text || "").length}/280</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Input type="file" accept="image/*" onChange={onBrandImage("footer_image")} />
                            {brand.footer_image && (
                              <details open className="rounded-lg border bg-muted/10">
                                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Customize footer image</summary>
                                <div className="p-3 pt-0 space-y-3">
                                  <ImageAdjuster
                                    src={brand.footer_image}
                                    frameHeight={brand.footer_height_mm || 18}
                                    zoom={brand.footer_zoom || 1}
                                    offsetX={brand.footer_offset_x || 0}
                                    offsetY={brand.footer_offset_y || 0}
                                    onChange={(next) => updateImageAdjust("footer", next)}
                                    onReset={() => resetImageAdjust("footer")}
                                  />
                                  <div className="space-y-1">
                                    <Label className="text-xs">Footer height: {brand.footer_height_mm || 18}mm</Label>
                                    <Input type="range" min={10} max={36} value={brand.footer_height_mm || 18}
                                      onChange={(e) => setBrand({ ...brand, footer_height_mm: +e.target.value || 18 })} />
                                  </div>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </section>
                    )}

                    {brandingSection === "elements" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">D. Document Elements</div>
                        <details className="rounded-lg border bg-muted/10">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Page numbering</summary>
                          <div className="p-3 pt-0 space-y-2">
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!brand.page_numbering_enabled} onChange={(e) => setBrand({ ...brand, page_numbering_enabled: e.target.checked })} />Enable page numbering</label>
                            {brand.page_numbering_enabled && (
                              <div className="grid grid-cols-2 gap-2">
                                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.page_numbering_format || "page_of_total"} onChange={(e) => setBrand({ ...brand, page_numbering_format: e.target.value as "page_of_total" | "fraction" | "simple" })}>
                                  <option value="page_of_total">Page 1 of 3</option>
                                  <option value="fraction">1 / 3</option>
                                  <option value="simple">Simple number</option>
                                </select>
                                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.page_numbering_position || "bottom_right"} onChange={(e) => setBrand({ ...brand, page_numbering_position: e.target.value as "bottom_center" | "bottom_right" | "footer_area" })}>
                                  <option value="bottom_center">Bottom center</option>
                                  <option value="bottom_right">Bottom right</option>
                                  <option value="footer_area">Footer area</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </details>
                        <details className="rounded-lg border bg-muted/10" open={!!brand.watermark_enabled}>
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Watermark</summary>
                          <div className="p-3 pt-0 space-y-2">
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!brand.watermark_enabled} onChange={(e) => setBrand({ ...brand, watermark_enabled: e.target.checked })} />Enable watermark</label>
                            {brand.watermark_enabled && (
                              <>
                                <Input type="file" accept="image/*" onChange={onBrandImage("watermark_image")} />
                                {!brand.watermark_image && <Input placeholder='Watermark text (e.g. "CONFIDENTIAL" / "DRAFT")' value={brand.watermark_text || ""} onChange={(e) => setBrand({ ...brand, watermark_text: e.target.value })} />}
                                <div className="space-y-1">
                                  <Label className="text-xs">Opacity: {((brand.watermark_opacity ?? 0.1) * 100).toFixed(0)}%</Label>
                                  <Input type="range" min={0.03} max={0.35} step={0.01} value={brand.watermark_opacity ?? 0.1} onChange={(e) => setBrand({ ...brand, watermark_opacity: +e.target.value || 0.1 })} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Size: {((brand.watermark_scale ?? 0.5) * 100).toFixed(0)}%</Label>
                                  <Input type="range" min={0.2} max={1} step={0.05} value={brand.watermark_scale ?? 0.5} onChange={(e) => setBrand({ ...brand, watermark_scale: +e.target.value || 0.5 })} />
                                </div>
                              </>
                            )}
                          </div>
                        </details>
                      </section>
                    )}

                    {brandingSection === "table" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">E. Table Design</div>

                        <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                          <div className="text-xs font-medium">A. Live mini table preview</div>
                          <div className="rounded-md border overflow-hidden bg-background">
                            <div className="grid grid-cols-5 text-[10px] font-medium" style={{ background: previewTheme.header_bg, color: previewTheme.header_text }}>
                              <div className="px-2 py-1.5">Item</div><div className="px-2 py-1.5">Description</div><div className="px-2 py-1.5">Qty</div><div className="px-2 py-1.5">Rate</div><div className="px-2 py-1.5 text-right">Amount</div>
                            </div>
                            <div className="px-2 py-1 text-[10px] font-semibold border-y" style={{ background: previewTheme.category_bg, color: previewTheme.category_text, borderColor: previewTheme.category_border }}>PUMPS</div>
                            <div className="grid grid-cols-5 text-[10px]">
                              <div className="px-2 py-1.5">Transfer Pump</div><div className="px-2 py-1.5 text-muted-foreground">Industrial duty</div><div className="px-2 py-1.5">1</div><div className="px-2 py-1.5">500</div><div className="px-2 py-1.5 text-right font-medium">500</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                          <div className="text-xs font-medium">B. Suggested from your brand</div>
                          <div className="grid grid-cols-2 gap-2">
                            {suggestedThemes.map((s) => (
                              <button
                                key={s.name}
                                type="button"
                                onClick={() => applyTheme(s.t)}
                                onMouseEnter={() => setHoverTheme(s.t)}
                                onMouseLeave={() => setHoverTheme(null)}
                                className="rounded-md border bg-background p-2 text-left hover:border-primary/50 transition"
                              >
                                <div className="flex gap-1 mb-2">
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: s.t.header_bg }} />
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: s.t.category_bg }} />
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: s.t.accent }} />
                                </div>
                                <div className="text-xs font-medium">{s.name}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">C. Ready-made themes</div>
                            <Button size="sm" variant="outline" onClick={applyAutoTheme}>Auto suggest</Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {PRESET_THEMES.map((p) => (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => applyTheme(p.t)}
                                onMouseEnter={() => setHoverTheme(p.t)}
                                onMouseLeave={() => setHoverTheme(null)}
                                className="rounded-md border bg-background p-2 text-left hover:border-primary/50 transition"
                              >
                                <div className="flex gap-1 mb-2">
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: p.t.header_bg }} />
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: p.t.category_bg }} />
                                  <span className="h-4 w-6 rounded-sm border" style={{ background: p.t.accent }} />
                                </div>
                                <div className="text-xs font-medium">{p.name}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <details className="rounded-lg border bg-muted/10">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">D. Customize colors (advanced)</summary>
                          <div className="p-3 pt-0">
                            <div className="grid grid-cols-2 gap-3">
                              <PaletteColorPicker
                                pickerId="table-header-bg"
                                activePickerId={activeColorPickerId}
                                setActivePickerId={setActiveColorPickerId}
                                label="Header row color"
                                value={brand.table_theme?.header_bg || "#1e50e6"}
                                onChange={(c) => updateTheme({ header_bg: c, accent: c })}
                              />
                              <PaletteColorPicker
                                pickerId="table-header-text"
                                activePickerId={activeColorPickerId}
                                setActivePickerId={setActiveColorPickerId}
                                label="Header text color"
                                value={brand.table_theme?.header_text || "#ffffff"}
                                onChange={(c) => updateTheme({ header_text: c })}
                              />
                              <PaletteColorPicker
                                pickerId="table-category-bg"
                                activePickerId={activeColorPickerId}
                                setActivePickerId={setActiveColorPickerId}
                                label="Category row color"
                                value={brand.table_theme?.category_bg?.slice(0, 7) || "#eaf0ff"}
                                onChange={(c) => updateTheme({ category_bg: c })}
                              />
                              <PaletteColorPicker
                                pickerId="table-category-text"
                                activePickerId={activeColorPickerId}
                                setActivePickerId={setActiveColorPickerId}
                                label="Category text color"
                                value={brand.table_theme?.category_text || "#1e50e6"}
                                onChange={(c) => updateTheme({ category_text: c, category_border: `${c}66` })}
                              />
                            </div>
                          </div>
                        </details>
                      </section>
                    )}

                    {brandingSection === "advanced" && (
                      <section className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">F. Advanced</div>
                        <details className="rounded-lg border bg-muted/10" open>
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Global Bank Details</summary>
                          <div className="p-3 pt-0 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Bank Name" value={brand.bank_details?.bank_name || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), bank_name: e.target.value } })} />
                              <Input placeholder="Account Name" value={brand.bank_details?.account_name || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), account_name: e.target.value } })} />
                              <Input placeholder="Account Number" value={brand.bank_details?.account_number || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), account_number: e.target.value } })} />
                              <Input placeholder="IFSC / SWIFT" value={brand.bank_details?.ifsc_swift || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), ifsc_swift: e.target.value } })} />
                              <Input placeholder="Branch" value={brand.bank_details?.branch || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), branch: e.target.value } })} />
                              <Input placeholder="UPI ID" value={brand.bank_details?.upi_id || ""} onChange={(e) => setBrand({ ...brand, bank_details: { ...(brand.bank_details || {}), upi_id: e.target.value } })} />
                            </div>
                            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.defaults_behavior?.bank_details || "disabled"} onChange={(e) => setBrand({ ...brand, defaults_behavior: { ...(brand.defaults_behavior || {}), bank_details: e.target.value as "auto" | "ask" | "disabled" } })}>
                              <option value="auto">Use automatically for all quotations</option>
                              <option value="ask">Ask before export</option>
                              <option value="disabled">Disable by default</option>
                            </select>
                          </div>
                        </details>

                        <details className="rounded-lg border bg-muted/10">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Standard Terms & Conditions</summary>
                          <div className="p-3 pt-0 space-y-2">
                            <textarea className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm" placeholder="Standard T&C" value={brand.standard_terms?.terms_conditions || ""} onChange={(e) => setBrand({ ...brand, standard_terms: { ...(brand.standard_terms || {}), terms_conditions: e.target.value } })} />
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Payment Terms" value={brand.standard_terms?.payment_terms || ""} onChange={(e) => setBrand({ ...brand, standard_terms: { ...(brand.standard_terms || {}), payment_terms: e.target.value } })} />
                              <Input placeholder="Delivery Terms" value={brand.standard_terms?.delivery_terms || ""} onChange={(e) => setBrand({ ...brand, standard_terms: { ...(brand.standard_terms || {}), delivery_terms: e.target.value } })} />
                              <Input placeholder="Warranty Terms" value={brand.standard_terms?.warranty_terms || ""} onChange={(e) => setBrand({ ...brand, standard_terms: { ...(brand.standard_terms || {}), warranty_terms: e.target.value } })} />
                              <Input placeholder="Disclaimer Notes" value={brand.standard_terms?.disclaimer_notes || ""} onChange={(e) => setBrand({ ...brand, standard_terms: { ...(brand.standard_terms || {}), disclaimer_notes: e.target.value } })} />
                            </div>
                            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.defaults_behavior?.standard_terms || "disabled"} onChange={(e) => setBrand({ ...brand, defaults_behavior: { ...(brand.defaults_behavior || {}), standard_terms: e.target.value as "auto" | "ask" | "disabled" } })}>
                              <option value="auto">Use automatically for all quotations</option>
                              <option value="ask">Ask before export</option>
                              <option value="disabled">Disable by default</option>
                            </select>
                          </div>
                        </details>

                        <details className="rounded-lg border bg-muted/10">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Custom Global Notes</summary>
                          <div className="p-3 pt-0 space-y-2">
                            <Input placeholder="Reusable footer notes" value={brand.global_notes?.footer_notes || ""} onChange={(e) => setBrand({ ...brand, global_notes: { ...(brand.global_notes || {}), footer_notes: e.target.value } })} />
                            <Input placeholder="Thank-you line" value={brand.global_notes?.thank_you_line || ""} onChange={(e) => setBrand({ ...brand, global_notes: { ...(brand.global_notes || {}), thank_you_line: e.target.value } })} />
                            <Input placeholder="Compliance notes" value={brand.global_notes?.compliance_notes || ""} onChange={(e) => setBrand({ ...brand, global_notes: { ...(brand.global_notes || {}), compliance_notes: e.target.value } })} />
                            <Input placeholder="Legal text" value={brand.global_notes?.legal_text || ""} onChange={(e) => setBrand({ ...brand, global_notes: { ...(brand.global_notes || {}), legal_text: e.target.value } })} />
                            <Input placeholder="Export notes" value={brand.global_notes?.export_notes || ""} onChange={(e) => setBrand({ ...brand, global_notes: { ...(brand.global_notes || {}), export_notes: e.target.value } })} />
                            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={brand.defaults_behavior?.global_notes || "disabled"} onChange={(e) => setBrand({ ...brand, defaults_behavior: { ...(brand.defaults_behavior || {}), global_notes: e.target.value as "auto" | "ask" | "disabled" } })}>
                              <option value="auto">Use automatically for all quotations</option>
                              <option value="ask">Ask before export</option>
                              <option value="disabled">Disable by default</option>
                            </select>
                          </div>
                        </details>
                      </section>
                    )}
                  </main>

                  <aside className="border-t xl:border-t-0 xl:border-l bg-muted/10 p-4 flex-1 min-h-[280px] xl:min-h-0 xl:flex-none">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" />Live Preview</div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStudioZoom((z) => Math.max(0.35, +(z - 0.05).toFixed(2)))}><Minus className="h-3.5 w-3.5" /></Button>
                        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(studioZoom * 100)}%</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStudioZoom((z) => Math.min(1, +(z + 0.05).toFixed(2)))}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="h-[min(420px,50vh)] xl:h-[calc(100vh-9rem)] xl:min-h-[560px] rounded-lg border bg-background overflow-y-auto overflow-x-hidden p-3 sm:p-4">
                      <div className="flex justify-center">
                        <div className="origin-top" style={{ zoom: studioZoom, width: "210mm" }}>
                          <QuotationPreview q={q} brand={previewBrand} />
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={onExportClick} disabled={!hasContent}>
              <Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden md:inline">Export PDF</span>
            </Button>
            <Button size="sm" className="h-8 px-2 sm:px-3 bg-gradient-primary text-primary-foreground border-0 shadow-glow" onClick={() => setOpen(true)}>
              <Sparkles className="h-4 w-4 sm:mr-1.5" /><span className="hidden md:inline">Extract from Email</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero (only when empty) */}
      {!hasContent && (
        <section className="no-print relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-[0.4] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="absolute inset-0 bg-gradient-glow" />
          <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-6 pt-12 sm:pt-16 lg:pt-20 pb-10 sm:pb-14 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-card/60 backdrop-blur text-[11px] text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-accent" /> Powered by AI · Built for industrial sales teams
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif tracking-tight leading-[1.05] max-w-3xl mx-auto">
              Turn messy enquiry emails into <em className="text-accent not-italic">commercial-grade quotations</em>
            </h1>
            <p className="mt-5 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Paste any RFQ — pumps, valves, gaskets, fabrication, anything. Quotient understands context, normalizes specs, groups items intelligently, and arranges a clean quotation in seconds.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 px-2 sm:px-0">
              <Button size="lg" onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground border-0 shadow-glow h-11 sm:h-12 px-6 w-full sm:w-auto">
                <Sparkles className="h-4 w-4 mr-2" /> Extract from Email
              </Button>
              <Button size="lg" variant="outline" className="h-11 sm:h-12 px-6 w-full sm:w-auto" onClick={() => setQ({ ...q, items: [{ id: crypto.randomUUID(), item_name: "", description: "", qty: 1, unit: "Nos", moc: "", unit_price: 0, discount: 0 }] })}>
                <FileText className="h-4 w-4 mr-2" /> Start blank
              </Button>
            </div>

            <div className="mt-10 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-3xl mx-auto px-2 sm:px-0">
              {[
                { t: "Context-aware parsing", d: "Ignores greetings, signatures, forwards. Extracts only what matters." },
                { t: "Intelligent grouping", d: "Specs stay attached to their item. No noisy line-by-line dumps." },
                { t: "Industry-agnostic", d: "Pumps, gaskets, reactors, fabrication, trading — it just works." },
              ].map((f) => (
                <div key={f.t} className="p-4 rounded-xl border bg-card/60 backdrop-blur">
                  <div className="text-sm font-semibold">{f.t}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Workspace - Split View */}
      {hasContent && (
        <main className="no-print max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-6 py-4 sm:py-6 pb-28 sm:pb-32">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quotation</div>
              <div className="font-mono text-base sm:text-lg">{q.quote_no}</div>
            </div>
          </div>

          <div className="lg:hidden flex gap-1 mb-4 p-1 rounded-lg bg-muted/60 border">
            <Button
              type="button"
              variant={workspacePane === "editor" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => setWorkspacePane("editor")}
            >
              Editable form
            </Button>
            <Button
              type="button"
              variant={workspacePane === "preview" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => setWorkspacePane("preview")}
            >
              Live preview
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Left: Editor */}
            <div
              className={cn(
                "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] flex flex-col",
                workspacePane !== "editor" && "hidden lg:flex",
              )}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <h2 className="text-sm font-semibold tracking-tight">Editable Form</h2>
                  <span className="text-[11px] text-muted-foreground">— update fields, table & terms</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <QuotationEditor q={q} setQ={setQ} />
              </div>
            </div>

            {/* Right: Live Preview */}
            <div
              className={cn(
                "lg:sticky lg:top-20 flex flex-col",
                workspacePane !== "preview" && "hidden lg:flex",
              )}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-sm font-semibold tracking-tight">Live Preview</h2>
                  <span className="text-[11px] text-muted-foreground">— print-ready PDF view</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">A4</span>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border-2 border-primary/10 shadow-elegant h-[min(520px,70vh)] sm:h-[min(560px,75vh)] lg:h-[calc(100vh-9.5rem)] lg:min-h-[560px] lg:max-h-[calc(100vh-9.5rem)] overflow-hidden">
                <div className="h-full overflow-y-auto overflow-x-hidden p-3 sm:p-6">
                  <div className="flex justify-center">
                  <div
                      className="origin-top"
                      style={{ zoom: 0.62, width: "210mm" }}
                  >
                    <QuotationPreview q={q} brand={previewBrand} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Always-mounted preview for print (off-screen on screen) */}
      <div className="fixed -left-[9999px] top-0 print:static print:left-auto">
        <QuotationPreview q={q} brand={previewBrand} />
      </div>

      <Dialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Export Inclusions</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {askBank && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeBankDetails} onChange={(e) => setIncludeBankDetails(e.target.checked)} />
                Include Bank Details
              </label>
            )}
            {askTerms && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeStandardTerms} onChange={(e) => setIncludeStandardTerms(e.target.checked)} />
                Include T&C
              </label>
            )}
            {askNotes && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeGlobalNotes} onChange={(e) => setIncludeGlobalNotes(e.target.checked)} />
                Include Global Notes
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                flushSync(() => {
                  setPrintOverrides({
                    bank: includeBankDetails,
                    terms: includeStandardTerms,
                    notes: includeGlobalNotes,
                  });
                });
                setExportConfirmOpen(false);
                setTimeout(() => runPrint(), 40);
              }}
            >
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {hasContent && (
        <AICommandBar onExtracted={(nq) => reset(nq)} />
      )}

      <ExtractEmailDialog open={open} onOpenChange={setOpen} onExtracted={(nq) => reset(nq)} />
    </div>
  );
};

export default Index;
