-- Esquema para Supabase. Ejecutar en el SQL editor (o como migración).
-- Panel: crear el usuario en Authentication > Users y agregarlo a public.staff (ver al final).
-- Importante: solo los usuarios de public.staff pueden escribir; registrarse no da permisos.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year int not null check (year between 1950 and 2100),
  km int not null default 0 check (km >= 0),
  price numeric not null check (price >= 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  fuel text not null default 'nafta',
  transmission text not null default 'manual',
  status text not null default 'disponible' check (status in ('disponible', 'reservado', 'vendido')),
  description text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Mi Automotora',
  whatsapp text not null default '',
  tna numeric not null default 60 check (tna >= 0)
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.vehicles enable row level security;
alter table public.settings enable row level security;
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- Público: ve autos no vendidos y la configuración (nombre, WhatsApp, TNA).
create policy "public reads unsold vehicles" on public.vehicles
  for select to anon, authenticated using (status <> 'vendido');
create policy "public reads settings" on public.settings
  for select to anon, authenticated using (true);

-- Panel: solo staff gestiona todo.
create policy "staff manage vehicles" on public.vehicles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage settings" on public.settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff reads own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- Fotos: lectura pública del bucket, escritura solo staff.
insert into storage.buckets (id, name, public) values ('vehicle-photos', 'vehicle-photos', true)
  on conflict do nothing;
create policy "staff upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'vehicle-photos' and public.is_staff());
create policy "staff delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'vehicle-photos' and public.is_staff());

-- Después de crear el usuario del panel:
--   insert into public.staff (user_id) select id from auth.users where email = 'dueño@ejemplo.com';

-- ---------- Consultas (seguimiento de clicks en WhatsApp / cotización / PDF) ----------
-- No guarda datos personales: solo qué auto interesó y qué cuota se cotizó.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  vehicle_label text not null check (char_length(vehicle_label) between 1 and 120),
  kind text not null check (kind in ('whatsapp', 'cotizacion', 'pdf')),
  monthly numeric check (monthly >= 0),
  months int check (months between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_vehicle_id_idx on public.leads (vehicle_id);

alter table public.leads enable row level security;

-- Cualquiera puede registrar una consulta (insert), nadie anónimo puede leerlas.
create policy "public inserts leads" on public.leads
  for insert to anon, authenticated with check (char_length(vehicle_label) > 0);
create policy "staff reads leads" on public.leads
  for select to authenticated using (public.is_staff());
create policy "staff deletes leads" on public.leads
  for delete to authenticated using (public.is_staff());
