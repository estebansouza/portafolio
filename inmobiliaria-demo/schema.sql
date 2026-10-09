-- Esquema para Supabase. Ejecutar en el SQL editor (o como migración) en un proyecto NUEVO.
-- Panel: crear el usuario en Authentication > Users y agregarlo a public.staff (ver al final).
-- Importante: solo los usuarios de public.staff pueden escribir; registrarse no da permisos.
-- Todos los precios están en USD (en alquiler, USD por mes).

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  operation text not null default 'venta' check (operation in ('venta', 'alquiler')),
  type text not null default 'casa' check (type in ('casa', 'apartamento', 'terreno', 'local')),
  price numeric not null check (price >= 0),
  bedrooms int not null default 0 check (bedrooms >= 0),
  bathrooms int not null default 0 check (bathrooms >= 0),
  garage int not null default 0 check (garage >= 0),
  area_m2 numeric not null default 0 check (area_m2 >= 0),
  country text not null default '',
  city text not null default '',
  neighborhood text not null default '',
  status text not null default 'disponible' check (status in ('disponible', 'reservada', 'cerrada')),
  description text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists properties_created_at_idx on public.properties (created_at desc);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Mi Inmobiliaria',
  whatsapp text not null default '',
  country text not null default '',
  city text not null default ''
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.properties enable row level security;
alter table public.settings enable row level security;
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- Público: ve propiedades no cerradas y la configuración (nombre, WhatsApp).
create policy "public reads open properties" on public.properties
  for select to anon, authenticated using (status <> 'cerrada');
create policy "public reads settings" on public.settings
  for select to anon, authenticated using (true);

-- Panel: solo staff gestiona todo (incluye ver las cerradas).
create policy "staff manage properties" on public.properties
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage settings" on public.settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff reads own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- Fotos: lectura pública del bucket, escritura solo staff.
insert into storage.buckets (id, name, public) values ('property-photos', 'property-photos', true)
  on conflict do nothing;
create policy "staff upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-photos' and public.is_staff());
create policy "staff delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'property-photos' and public.is_staff());

-- Después de crear el usuario del panel:
--   insert into public.staff (user_id) select id from auth.users where email = 'dueño@ejemplo.com';

-- ---------- Consultas (leads) ----------
-- 'whatsapp' = click de interés sin datos personales; 'consulta' = formulario;
-- 'chat' = conversación con el asistente de IA (hilo completo en messages).
-- status: 'nuevo', 'atencion' (la IA pide que intervenga una persona) o 'respondido'.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique,
  property_id uuid references public.properties (id) on delete set null,
  property_label text not null check (char_length(property_label) between 1 and 160),
  kind text not null check (kind in ('whatsapp', 'consulta', 'chat')),
  name text not null default '' check (char_length(name) <= 80),
  contact text not null default '' check (char_length(contact) <= 120),
  message text not null default '' check (char_length(message) <= 1000),
  messages jsonb not null default '[]' check (jsonb_typeof(messages) = 'array'),
  status text not null default 'nuevo' check (status in ('nuevo', 'atencion', 'respondido')),
  created_at timestamptz not null default now()
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_property_id_idx on public.leads (property_id);

alter table public.leads enable row level security;

-- Cualquiera puede registrar una consulta (insert), nadie anónimo puede leerlas.
create policy "public inserts leads" on public.leads
  for insert to anon, authenticated
  with check (char_length(property_label) > 0 and status = 'nuevo' and messages = '[]'::jsonb and kind <> 'chat');
create policy "staff reads leads" on public.leads
  for select to authenticated using (public.is_staff());
create policy "staff deletes leads" on public.leads
  for delete to authenticated using (public.is_staff());

-- ---------- Metas y CRM (panel de gestión) ----------
alter table public.settings
  add column if not exists goal_closings int not null default 8,
  add column if not exists goal_listings int not null default 12,
  add column if not exists goal_commission numeric not null default 42000;

create policy "staff updates leads" on public.leads
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Chat con IA: el visitante (anónimo) guarda su hilo con una función que solo puede
-- crear/actualizar la fila que corresponde a su session_id (un uuid aleatorio que genera su navegador).
create or replace function public.save_chat(
  p_session uuid, p_property_id uuid, p_label text, p_name text, p_contact text, p_messages jsonb, p_status text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_session is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) > 60 or pg_column_size(p_messages) > 60000 then
    raise exception 'chat inválido';
  end if;
  if p_status not in ('nuevo', 'atencion') then raise exception 'estado inválido'; end if;
  insert into public.leads (session_id, property_id, property_label, kind, name, contact, messages, status)
  values (p_session, p_property_id, left(coalesce(p_label, ''), 120), 'chat',
          left(coalesce(p_name, ''), 80), left(coalesce(p_contact, ''), 120), p_messages, p_status)
  on conflict (session_id) do update
    set name = excluded.name, contact = excluded.contact, messages = excluded.messages, status = excluded.status;
end;
$$;
revoke all on function public.save_chat(uuid, uuid, text, text, text, jsonb, text) from public;
grant execute on function public.save_chat(uuid, uuid, text, text, text, jsonb, text) to anon, authenticated;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text not null default 'comprador',
  phone text not null default '', email text not null default '', notes text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null, contact_name text not null default '', property_label text not null default '',
  stage text not null default 'consulta' check (stage in ('consulta', 'visita', 'negociacion', 'sena', 'cerrado', 'perdido')),
  value numeric not null default 0 check (value >= 0),
  commission_pct numeric not null default 3 check (commission_pct >= 0),
  stage_at timestamptz not null default now(), closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null, phone text not null default '',
  direction text not null default 'saliente', outcome text not null default 'contestó', notes text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  property_label text not null, contact_name text not null default '',
  at timestamptz not null, status text not null default 'confirmada' check (status in ('confirmada', 'realizada', 'cancelada')),
  created_at timestamptz not null default now()
);

-- Datos internos de la inmobiliaria: solo staff (el público no ve nada de esto).
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.calls enable row level security;
alter table public.visits enable row level security;
create policy "staff manage contacts" on public.contacts for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage deals" on public.deals for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage calls" on public.calls for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage visits" on public.visits for all to authenticated using (public.is_staff()) with check (public.is_staff());
