create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text,
  series text,
  category text,
  description text,
  image_url text,
  unit_price numeric default 0,
  currency text default 'INR',
  unit text default 'Nos',
  availability text,
  delivery_timeline text,
  specific_terms text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products enable row level security;

create policy "products are publicly readable" on public.products for select using (true);
create policy "anyone can insert products" on public.products for insert with check (true);
create policy "anyone can update products" on public.products for update using (true);
create policy "anyone can delete products" on public.products for delete using (true);