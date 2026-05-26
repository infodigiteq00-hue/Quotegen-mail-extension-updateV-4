export type Urgency = "low" | "normal" | "high";

export interface Client {
  contact_person: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
}

export interface LinkedProduct {
  product_id: string;
  image_url?: string;
  show_image?: boolean;
  show_description?: boolean;
  show_price?: boolean;
  show_delivery?: boolean;
  show_terms?: boolean;
  // snapshotted catalog fields (so preview is independent of network)
  name?: string;
  description?: string;
  delivery_timeline?: string;
  specific_terms?: string;
}

export interface QuotationItem {
  id: string;
  item_name: string;
  description: string;
  qty: number;
  unit: string;
  moc: string;
  unit_price: number;
  discount: number; // percent
  highlight?: boolean;
  group?: string;
  custom?: Record<string, string | number>;
  // catalog linkage
  linked?: LinkedProduct;
  keep_client_reference?: boolean; // show "Client requested" block alongside "Our suggestion"
}

export interface CustomColumn {
  key: string;
  label: string;
  type: "text" | "number";
}

export interface QuotationLayout {
  hide_description_col?: boolean;
  merge_desc_into_name?: boolean;
  moc_position?: "left" | "right";
  mode?: "default" | "compact" | "premium" | "minimal" | "tender";
  show_category_headers?: boolean; // default true
  column_order?: string[]; // ordering of column ids
  hidden_columns?: string[]; // column ids manually hidden
  auto_hide_empty?: boolean; // default true — hide columns where every item is empty
  image_size?: "small" | "medium" | "large"; // preview/export thumbnail size
  group_order?: string[]; // ordering of category groups
  column_labels?: Record<string, string>; // overrides for built-in column labels
}

export interface TableTheme {
  header_bg: string;
  header_text: string;
  category_bg: string;
  category_text: string;
  category_border: string;
  accent: string;
}

export interface BrandingSettings {
  company: string;
  tagline: string;
  address: string;
  email?: string;
  phone?: string;
  website?: string;
  gst_number?: string;
  header_type?: "text" | "image";
  footer_type?: "text" | "image";
  header_image?: string;
  footer_image?: string;
  header_logo?: string;
  header_height_mm?: number;
  footer_height_mm?: number;
  header_fit?: "contain" | "cover";
  footer_fit?: "contain" | "cover";
  header_zoom?: number;
  footer_zoom?: number;
  header_offset_x?: number;
  header_offset_y?: number;
  footer_offset_x?: number;
  footer_offset_y?: number;
  header_show_tagline?: boolean;
  header_show_quote_no?: boolean;
  header_show_validity?: boolean;
  header_layout?: "left" | "right";
  header_logo_align?: "left" | "right";
  header_logo_size_mm?: number;
  footer_text?: string;
  footer_show_divider?: boolean;
  page_numbering_enabled?: boolean;
  page_numbering_format?: "page_of_total" | "fraction" | "simple";
  page_numbering_position?: "bottom_center" | "bottom_right" | "footer_area";
  watermark_enabled?: boolean;
  watermark_image?: string;
  watermark_text?: string;
  watermark_opacity?: number;
  watermark_scale?: number;
  bank_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    ifsc_swift?: string;
    branch?: string;
    upi_id?: string;
  };
  standard_terms?: {
    terms_conditions?: string;
    payment_terms?: string;
    delivery_terms?: string;
    warranty_terms?: string;
    disclaimer_notes?: string;
  };
  global_notes?: {
    footer_notes?: string;
    thank_you_line?: string;
    compliance_notes?: string;
    legal_text?: string;
    export_notes?: string;
  };
  defaults_behavior?: {
    bank_details?: "auto" | "ask" | "disabled";
    standard_terms?: "auto" | "ask" | "disabled";
    global_notes?: "auto" | "ask" | "disabled";
  };
  include_bank_details?: boolean;
  include_standard_terms?: boolean;
  include_global_notes?: boolean;
  table_theme?: TableTheme;
}

const DEFAULT_LAYOUT_KEY = "qe_default_layout_v1";
const DEFAULT_COLS_KEY = "qe_default_custom_cols_v1";
const DEFAULT_BRANDING_KEY = "qe_default_branding_v1";

export const loadDefaultLayout = (): { layout?: QuotationLayout; custom_columns?: CustomColumn[] } => {
  if (typeof window === "undefined") return {};
  try {
    const layout = JSON.parse(localStorage.getItem(DEFAULT_LAYOUT_KEY) || "null") || undefined;
    const custom_columns = JSON.parse(localStorage.getItem(DEFAULT_COLS_KEY) || "null") || undefined;
    return { layout, custom_columns };
  } catch { return {}; }
};

export const saveDefaultLayout = (layout: QuotationLayout, custom_columns: CustomColumn[]) => {
  try {
    localStorage.setItem(DEFAULT_LAYOUT_KEY, JSON.stringify(layout));
    localStorage.setItem(DEFAULT_COLS_KEY, JSON.stringify(custom_columns));
  } catch {}
};

const DEFAULT_TABLE_THEME: TableTheme = {
  header_bg: "#1e50e6",
  header_text: "#ffffff",
  category_bg: "#eaf0ff",
  category_text: "#1e50e6",
  category_border: "#cdd9f7",
  accent: "#1e50e6",
};

export const defaultBranding = (): BrandingSettings => ({
  company: "Apex Industrial Co.",
  tagline: "Precision Engineering · Industrial Solutions",
  address: "Plot 42, MIDC Industrial Area, Ahmedabad 380015, India · sales@apex.co · +91 79 1234 5678",
  email: "sales@apex.co",
  phone: "+91 79 1234 5678",
  website: "",
  gst_number: "",
  header_height_mm: 26,
  footer_height_mm: 18,
  header_type: "text",
  footer_type: "text",
  header_fit: "contain",
  footer_fit: "contain",
  header_zoom: 1,
  footer_zoom: 1,
  header_offset_x: 0,
  header_offset_y: 0,
  footer_offset_x: 0,
  footer_offset_y: 0,
  header_show_tagline: true,
  header_show_quote_no: true,
  header_show_validity: true,
  header_layout: "left",
  header_logo_align: "left",
  header_logo_size_mm: 16,
  footer_text: "This quotation is valid for 30 days from the date of issue.",
  footer_show_divider: true,
  page_numbering_enabled: false,
  page_numbering_format: "page_of_total",
  page_numbering_position: "bottom_right",
  watermark_enabled: false,
  watermark_opacity: 0.1,
  watermark_scale: 0.5,
  bank_details: {},
  standard_terms: {},
  global_notes: {},
  defaults_behavior: {
    bank_details: "disabled",
    standard_terms: "disabled",
    global_notes: "disabled",
  },
  table_theme: { ...DEFAULT_TABLE_THEME },
});

export const loadDefaultBranding = (): BrandingSettings => {
  if (typeof window === "undefined") return defaultBranding();
  try {
    const saved = JSON.parse(localStorage.getItem(DEFAULT_BRANDING_KEY) || "null");
    return {
      ...defaultBranding(),
      ...(saved || {}),
      table_theme: { ...DEFAULT_TABLE_THEME, ...(saved?.table_theme || {}) },
    };
  } catch {
    return defaultBranding();
  }
};

export const saveDefaultBranding = (branding: BrandingSettings) => {
  try {
    localStorage.setItem(DEFAULT_BRANDING_KEY, JSON.stringify(branding));
  } catch {}
};

export interface Terms {
  payment_terms: string;
  delivery_terms: string;
  delivery_timeline: string;
  shipping_terms: string;
  incoterms: string;
}

export interface Quotation {
  quote_no: string;
  date: string;
  valid_until: string;
  subject: string;
  client: Client;
  items: QuotationItem[];
  terms: Terms;
  notes: string[];
  urgency: Urgency;
  tax_percent: number;
  currency: string;
  layout: QuotationLayout;
  custom_columns?: CustomColumn[];
}

export const emptyQuotation = (): Quotation => {
  const def = loadDefaultLayout();
  return {
    quote_no: `Q-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    date: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    subject: "",
    client: { contact_person: "", company_name: "", email: "", phone: "", address: "" },
    items: [],
    terms: { payment_terms: "", delivery_terms: "", delivery_timeline: "", shipping_terms: "", incoterms: "" },
    notes: [],
    urgency: "normal",
    tax_percent: 18,
    currency: "INR",
    layout: def.layout || { moc_position: "left", mode: "default", show_category_headers: true, auto_hide_empty: true, image_size: "small" },
    custom_columns: def.custom_columns || [],
  };
};

export const lineTotal = (it: QuotationItem) => {
  const gross = it.qty * it.unit_price;
  return gross - (gross * (it.discount || 0)) / 100;
};

export const computeTotals = (q: Quotation) => {
  const subtotal = q.items.reduce((s, it) => s + lineTotal(it), 0);
  const tax = (subtotal * (q.tax_percent || 0)) / 100;
  return { subtotal, tax, grand: subtotal + tax };
};

export const currencySymbol = (c: string) =>
  ({ INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" } as Record<string, string>)[c] || c + " ";
