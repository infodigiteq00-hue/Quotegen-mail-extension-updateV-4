import type { Quotation } from "./quotation";
import { computeTotals, emptyQuotation } from "./quotation";
import type {
  CommercialDocumentRow,
  LifecycleEventRow,
  QuotationRecordRow,
} from "./workflow";
import { buildDocumentPayload } from "./workflow";
import type { WorkflowStoreData } from "./workflowStore";
import { replaceStore } from "./workflowStore";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const sampleQuotation = (patch: Partial<Quotation> & { items: Quotation["items"] }): Quotation => {
  const base = emptyQuotation();
  return {
    ...base,
    quote_no: patch.quote_no || base.quote_no,
    date: patch.date || base.date,
    valid_until: patch.valid_until || base.valid_until,
    subject: patch.subject || "",
    client: patch.client || base.client,
    items: patch.items,
    terms: patch.terms || base.terms,
    notes: patch.notes || [],
    tax_percent: patch.tax_percent ?? 18,
    currency: patch.currency || "INR",
  };
};

const toRecord = (
  id: string,
  q: Quotation,
  meta: Partial<QuotationRecordRow> & { status: QuotationRecordRow["status"] },
  createdAt: string
): QuotationRecordRow => {
  const { subtotal, tax } = computeTotals(q);
  const freight = meta.freight ?? 0;
  return {
    id,
    quote_no: q.quote_no,
    parent_id: meta.parent_id ?? null,
    revision_number: meta.revision_number ?? 0,
    date: q.date,
    valid_until: q.valid_until || null,
    subject: q.subject || null,
    client: q.client,
    project_name: meta.project_name ?? null,
    reference_rfq: meta.reference_rfq ?? null,
    prepared_by: meta.prepared_by ?? "Sales Team",
    gst_number: meta.gst_number ?? null,
    status: meta.status,
    subtotal,
    tax_amount: tax,
    freight,
    total_amount: subtotal + tax + freight,
    currency: q.currency,
    payment_terms: q.terms.payment_terms || null,
    delivery_terms: q.terms.delivery_terms || null,
    quotation_data: q,
    branding_snapshot: null,
    exported_at: meta.exported_at ?? null,
    created_at: createdAt,
    updated_at: createdAt,
  };
};

/** Rich demo dataset — persisted in localStorage like real saves */
export const buildSampleWorkflowStore = (): WorkflowStoreData => {
  const id1 = "sample-qtn-1042";
  const id2 = "sample-qtn-1038";
  const id3 = "sample-qtn-1020";
  const id3r1 = "sample-qtn-1020-r1";
  const id4 = "sample-qtn-1015";
  const id5 = "sample-qtn-0998";
  const docInv = "sample-inv-2204";
  const docPo = "sample-po-881";
  const docPfi = "sample-pfi-3301";
  const docDc = "sample-dc-1092";

  const q1 = sampleQuotation({
    quote_no: "QTN-2026-1042",
    date: "2026-05-10",
    valid_until: "2026-06-10",
    subject: "Centrifugal pumps & spares — Phase 2 expansion",
    client: {
      contact_person: "Rajesh Mehta",
      company_name: "Gujarat Chemical Works Ltd",
      email: "rajesh.mehta@gcw.co.in",
      phone: "+91 98765 43210",
      address: "Vadodara, Gujarat",
    },
    terms: {
      payment_terms: "30% advance, 70% before dispatch",
      delivery_terms: "Ex-works Ahmedabad, freight to client account",
      delivery_timeline: "6–8 weeks ARO",
      shipping_terms: "",
      incoterms: "EXW",
    },
    items: [
      {
        id: "i1",
        item_name: "Centrifugal Pump 50HP",
        description: "SS316 impeller, mechanical seal plan 11",
        qty: 2,
        unit: "Nos",
        moc: "SS316",
        unit_price: 185000,
        discount: 5,
        group: "Pumps",
      },
      {
        id: "i2",
        item_name: "Spare impeller kit",
        description: "Including wear ring set",
        qty: 2,
        unit: "Sets",
        moc: "SS316",
        unit_price: 22000,
        discount: 0,
        group: "Spares",
      },
    ],
  });

  const q2 = sampleQuotation({
    quote_no: "QTN-2026-1038",
    date: "2026-05-14",
    subject: "Ball valves & actuators — Line 4 retrofit",
    client: {
      contact_person: "Priya Nair",
      company_name: "Southern Petrochem Pvt Ltd",
      email: "priya.nair@southernpetro.com",
      phone: "+91 98450 11223",
      address: "Chennai, TN",
    },
    items: [
      {
        id: "i3",
        item_name: 'Ball Valve 4" Class 300',
        description: "Fire-safe design, gear operator",
        qty: 12,
        unit: "Nos",
        moc: "WCB",
        unit_price: 14500,
        discount: 3,
        group: "Valves",
      },
    ],
  });

  const q3 = sampleQuotation({
    quote_no: "QTN-2026-1020",
    date: "2026-04-28",
    subject: "Heat exchanger plates — annual maintenance",
    client: {
      contact_person: "Amit Sharma",
      company_name: "Hindustan Fertilizers",
      email: "amit.sharma@hf.co.in",
      phone: "+91 98100 55667",
      address: "Panipat, Haryana",
    },
    items: [
      {
        id: "i4",
        item_name: "Gasketed plate pack",
        description: "Titanium plates, OEM equivalent",
        qty: 1,
        unit: "Lot",
        moc: "Ti",
        unit_price: 420000,
        discount: 0,
        group: "Heat Exchangers",
      },
    ],
  });

  const q3r1 = sampleQuotation({
    ...q3,
    quote_no: "QTN-2026-1020-R1",
    items: [
      ...q3.items,
      {
        id: "i5",
        item_name: "Installation supervision",
        description: "3 days on-site",
        qty: 3,
        unit: "Days",
        moc: "—",
        unit_price: 18000,
        discount: 0,
        group: "Services",
      },
    ],
  });

  const q4 = sampleQuotation({
    quote_no: "QTN-2026-1015",
    date: "2026-05-18",
    subject: "Industrial gaskets — emergency RFQ",
    client: {
      contact_person: "Vikram Singh",
      company_name: "Bharat Steel Rolling Mills",
      email: "vikram@bsrm.in",
      phone: "+91 99887 66554",
      address: "Raipur, CG",
    },
    items: [
      {
        id: "i6",
        item_name: "Spiral wound gasket 2\"",
        description: "Graphite filler, 316SS windings",
        qty: 50,
        unit: "Nos",
        moc: "316SS",
        unit_price: 850,
        discount: 0,
        group: "Gaskets",
      },
    ],
  });

  const q5 = sampleQuotation({
    quote_no: "QTN-2026-0998",
    date: "2026-04-05",
    subject: "Agitator drive assembly",
    client: {
      contact_person: "Deepak Rao",
      company_name: "Konkan Pharma Ltd",
      email: "deepak.rao@konkanpharma.com",
      phone: "+91 98220 33445",
      address: "Goa",
    },
    items: [
      {
        id: "i7",
        item_name: "Agitator drive 75kW",
        description: "ATEX Zone 1",
        qty: 1,
        unit: "No",
        moc: "SS316L",
        unit_price: 890000,
        discount: 8,
        group: "Agitators",
      },
    ],
  });

  const r1 = toRecord(
    id1,
    q1,
    {
      status: "converted_to_invoice",
      project_name: "GCW Phase 2 — Pump package",
      reference_rfq: "RFQ-GCW-2026-044",
      gst_number: "24AABCG1234F1Z5",
      freight: 12500,
      exported_at: daysAgo(5),
    },
    daysAgo(12)
  );

  const r2 = toRecord(
    id2,
    q2,
    {
      status: "under_discussion",
      project_name: "Line 4 valve retrofit",
      reference_rfq: "RFQ-SP-8821",
    },
    daysAgo(4)
  );

  const r3 = toRecord(
    id3,
    q3,
    {
      status: "revised",
      project_name: "HF plate exchanger service",
      reference_rfq: "RFQ-HF-3390",
    },
    daysAgo(20)
  );

  const r3r1 = toRecord(
    id3r1,
    q3r1,
    {
      status: "sent",
      parent_id: id3,
      revision_number: 1,
      project_name: "HF plate exchanger service",
      reference_rfq: "RFQ-HF-3390",
    },
    daysAgo(8)
  );

  const r4 = toRecord(id4, q4, { status: "draft", project_name: "BSRM gasket supply" }, daysAgo(1));

  const r5 = toRecord(
    id5,
    q5,
    {
      status: "converted_to_po",
      project_name: "Reactor agitator upgrade",
      reference_rfq: "RFQ-KPL-1102",
      freight: 0,
    },
    daysAgo(45)
  );

  const invPayload = buildDocumentPayload(q1, r1.freight);
  const doc1: CommercialDocumentRow = {
    id: docInv,
    document_type: "sales_invoice",
    document_number: "INV-2026-2204",
    source_quotation_id: id1,
    parent_document_id: null,
    status: "draft",
    document_data: invPayload,
    subtotal: r1.subtotal,
    tax_amount: r1.tax_amount,
    freight: r1.freight,
    total_amount: r1.total_amount,
    currency: r1.currency,
    client: r1.client,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  };

  const poPayload = buildDocumentPayload(q5, 0);
  const doc2: CommercialDocumentRow = {
    id: docPo,
    document_type: "purchase_order",
    document_number: "PO-2026-0881",
    source_quotation_id: id5,
    parent_document_id: null,
    status: "draft",
    document_data: poPayload,
    subtotal: r5.subtotal,
    tax_amount: r5.tax_amount,
    freight: 0,
    total_amount: r5.total_amount,
    currency: r5.currency,
    client: r5.client,
    created_at: daysAgo(40),
    updated_at: daysAgo(40),
  };

  const pfiPayload = buildDocumentPayload(q2, 0);
  const doc3: CommercialDocumentRow = {
    id: docPfi,
    document_type: "proforma_invoice",
    document_number: "PFI-2026-3301",
    source_quotation_id: id2,
    parent_document_id: null,
    status: "draft",
    document_data: pfiPayload,
    subtotal: r2.subtotal,
    tax_amount: r2.tax_amount,
    freight: 0,
    total_amount: r2.total_amount,
    currency: r2.currency,
    client: r2.client,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  };

  const dcPayload = buildDocumentPayload(q1, 0);
  const doc4: CommercialDocumentRow = {
    id: docDc,
    document_type: "delivery_challan",
    document_number: "DC-2026-1092",
    source_quotation_id: id1,
    parent_document_id: null,
    status: "draft",
    document_data: dcPayload,
    subtotal: r1.subtotal,
    tax_amount: r1.tax_amount,
    freight: 0,
    total_amount: r1.total_amount,
    currency: r1.currency,
    client: r1.client,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  };

  const events: LifecycleEventRow[] = [
    {
      id: "ev-1",
      quotation_id: id1,
      document_id: null,
      event_type: "rfq_received",
      title: "RFQ Received",
      description: "RFQ-GCW-2026-044",
      metadata: {},
      created_at: daysAgo(14),
    },
    {
      id: "ev-2",
      quotation_id: id1,
      document_id: null,
      event_type: "quotation_created",
      title: "Quotation Generated",
      description: "QTN-2026-1042",
      metadata: {},
      created_at: daysAgo(12),
    },
    {
      id: "ev-3",
      quotation_id: id1,
      document_id: null,
      event_type: "status_changed",
      title: "Status → approved",
      description: null,
      metadata: { status: "approved" },
      created_at: daysAgo(7),
    },
    {
      id: "ev-4",
      quotation_id: id1,
      document_id: docInv,
      event_type: "document_converted",
      title: "Sales Invoice Generated",
      description: "INV-2026-2204 created from QTN-2026-1042",
      metadata: {},
      created_at: daysAgo(3),
    },
    {
      id: "ev-5",
      quotation_id: id1,
      document_id: null,
      event_type: "exported",
      title: "PDF Exported",
      description: "Quotation exported to PDF",
      metadata: {},
      created_at: daysAgo(5),
    },
    {
      id: "ev-6",
      quotation_id: id3,
      document_id: null,
      event_type: "revision_created",
      title: "Revision 1 Created",
      description: "QTN-2026-1020-R1",
      metadata: {},
      created_at: daysAgo(8),
    },
    {
      id: "ev-7",
      quotation_id: id2,
      document_id: null,
      event_type: "status_changed",
      title: "Status → under discussion",
      description: null,
      metadata: {},
      created_at: daysAgo(2),
    },
  ];

  return {
    records: [r1, r2, r3r1, r3, r4, r5],
    documents: [doc1, doc2, doc3, doc4],
    events,
  };
};

export const loadSampleWorkflowData = (): WorkflowStoreData => {
  const data = buildSampleWorkflowStore();
  replaceStore(data);
  return data;
};
