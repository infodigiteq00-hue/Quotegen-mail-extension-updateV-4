-- Commercial workflow schema (matches production layout)

CREATE TABLE IF NOT EXISTS public.quotation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no TEXT NOT NULL,
  parent_id UUID REFERENCES public.quotation_records(id) ON DELETE SET NULL,
  revision_number INT NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  subject TEXT,
  client JSONB NOT NULL DEFAULT '{}',
  project_name TEXT,
  reference_rfq TEXT,
  prepared_by TEXT,
  gst_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  freight NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_terms TEXT,
  delivery_terms TEXT,
  quotation_data JSONB NOT NULL DEFAULT '{}',
  branding_snapshot JSONB,
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  source_quotation_id UUID NOT NULL REFERENCES public.quotation_records(id) ON DELETE CASCADE,
  parent_document_id UUID REFERENCES public.commercial_documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  document_data JSONB NOT NULL DEFAULT '{}',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  freight NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  client JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'converted_from',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotation_records(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.commercial_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_records_quote_no ON public.quotation_records(quote_no);
CREATE INDEX IF NOT EXISTS idx_quotation_records_status ON public.quotation_records(status);
CREATE INDEX IF NOT EXISTS idx_quotation_records_created ON public.quotation_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_documents_source ON public.commercial_documents(source_quotation_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_quotation ON public.lifecycle_events(quotation_id, created_at);

ALTER TABLE public.quotation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_records' AND policyname = 'quotation_records_all') THEN
    CREATE POLICY quotation_records_all ON public.quotation_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_documents' AND policyname = 'commercial_documents_all') THEN
    CREATE POLICY commercial_documents_all ON public.commercial_documents FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_links' AND policyname = 'document_links_all') THEN
    CREATE POLICY document_links_all ON public.document_links FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lifecycle_events' AND policyname = 'lifecycle_events_all') THEN
    CREATE POLICY lifecycle_events_all ON public.lifecycle_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
