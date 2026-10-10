-- Plataforma multi-inmobiliaria. Ejecutar en el SQL editor (o como migración) en un proyecto NUEVO.
-- Cada inmobiliaria (agency) ve y gestiona solo sus datos; la separación la garantiza RLS.
-- Roles: platform_admins (dueño de la plataforma: da de alta inmobiliarias) y agency_members
-- ('owner' | 'agent' de cada inmobiliaria). Registrarse en Auth NO da permisos por sí solo:
-- desactivá los registros abiertos (Authentication > Sign In / Providers) y creá los usuarios a mano.
-- Todos los precios están en USD (en alquiler, USD por mes).

-- ---------- Inmobiliarias y permisos ----------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(name) between 1 and 80),
  whatsapp text not null default '' check (char_length(whatsapp) <= 30),
  country text not null default '' check (char_length(country) <= 60),
  city text not null default '' check (char_length(city) <= 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Metas del mes: datos internos, solo visibles para el equipo.
create table if not exists public.agency_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  goal_closings int not null default 8 check (goal_closings >= 0),
  goal_listings int not null default 12 check (goal_listings >= 0),
  goal_commission numeric not null default 42000 check (goal_commission >= 0)
);

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'agent')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index if not exists agency_members_user_idx on public.agency_members (user_id);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.agencies enable row level security;
alter table public.agency_settings enable row level security;
alter table public.agency_members enable row level security;
alter table public.platform_admins enable row level security;

-- Cada alta de inmobiliaria crea sus metas por defecto.
create or replace function public.create_agency_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.agency_settings (agency_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists agencies_settings on public.agencies;
create trigger agencies_settings after insert on public.agencies
  for each row execute function public.create_agency_settings();
revoke all on function public.create_agency_settings() from public, anon, authenticated;

-- Helpers de permisos (security definer para evitar recursión de RLS).
create or replace function public.is_member(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agency_members m where m.agency_id = a and m.user_id = (select auth.uid()));
$$;
create or replace function public.is_owner(a uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agency_members m
                 where m.agency_id = a and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins p where p.user_id = (select auth.uid()));
$$;
-- Para Storage: la primera carpeta del archivo es el id de la inmobiliaria.
create or replace function public.is_member_path(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_member(split_part(p, '/', 1)::uuid)
    else false
  end;
$$;
revoke all on function public.is_member(uuid), public.is_owner(uuid), public.is_platform_admin(), public.is_member_path(text)
  from public, anon, authenticated;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.is_platform_admin(), public.is_member_path(text)
  to authenticated;

-- Público: ve las inmobiliarias activas (nombre, WhatsApp, ciudad) para armar su catálogo y su chat.
create policy "anon reads active agencies" on public.agencies
  for select to anon using (active);
create policy "auth reads agencies" on public.agencies
  for select to authenticated using (active or public.is_member(id) or public.is_platform_admin());
-- Los dueños editan los datos de su inmobiliaria (no el slug ni el estado: ver grants abajo).
create policy "owners update agency" on public.agencies
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
revoke update on public.agencies from authenticated;
grant update (name, whatsapp, country, city) on public.agencies to authenticated;

create policy "members read settings" on public.agency_settings
  for select to authenticated using (public.is_member(agency_id));
create policy "owners update settings" on public.agency_settings
  for update to authenticated using (public.is_owner(agency_id)) with check (public.is_owner(agency_id));

-- Membresías: solo lectura directa; las altas/bajas pasan por las funciones de más abajo.
create policy "read own or managed memberships" on public.agency_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(agency_id) or public.is_platform_admin());
create policy "read own admin row" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- Propiedades ----------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
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
create index if not exists properties_agency_idx on public.properties (agency_id, created_at desc);
alter table public.properties enable row level security;

create policy "public reads open properties" on public.properties
  for select to anon, authenticated using (status <> 'cerrada');
create policy "members manage properties" on public.properties
  for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));

-- Fotos: lectura pública del bucket; solo el equipo sube/borra en la carpeta de su inmobiliaria
-- (ruta: <agency_id>/<archivo>).
insert into storage.buckets (id, name, public) values ('property-photos', 'property-photos', true)
  on conflict do nothing;
create policy "members upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'property-photos' and public.is_member_path(name));
create policy "members delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'property-photos' and public.is_member_path(name));

-- ---------- Consultas (leads) ----------
-- 'whatsapp' = click de interés sin datos personales; 'consulta' = formulario;
-- 'chat' = conversación con el asistente de IA (hilo completo en messages).
-- status: 'nuevo', 'atencion' (la IA pide que intervenga una persona) o 'respondido'.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
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
create index if not exists leads_agency_idx on public.leads (agency_id, created_at desc);
create index if not exists leads_property_id_idx on public.leads (property_id);
alter table public.leads enable row level security;
-- Sin permiso de insert anónimo directo: los visitantes escriben solo con las funciones de abajo.
create policy "members manage leads" on public.leads
  for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));

-- ---------- CRM ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null, role text not null default 'comprador',
  phone text not null default '', email text not null default '', notes text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  title text not null, contact_name text not null default '', property_label text not null default '',
  stage text not null default 'consulta' check (stage in ('consulta', 'visita', 'negociacion', 'sena', 'cerrado', 'perdido')),
  value numeric not null default 0 check (value >= 0),
  commission_pct numeric not null default 3 check (commission_pct >= 0),
  stage_at timestamptz not null default now(), closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_name text not null, phone text not null default '',
  direction text not null default 'saliente', outcome text not null default 'contestó', notes text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_label text not null, contact_name text not null default '',
  at timestamptz not null, status text not null default 'confirmada' check (status in ('confirmada', 'realizada', 'cancelada')),
  created_at timestamptz not null default now()
);
create index if not exists contacts_agency_idx on public.contacts (agency_id);
create index if not exists deals_agency_idx on public.deals (agency_id);
create index if not exists calls_agency_idx on public.calls (agency_id);
create index if not exists visits_agency_idx on public.visits (agency_id);

alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.calls enable row level security;
alter table public.visits enable row level security;
create policy "members manage contacts" on public.contacts for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy "members manage deals" on public.deals for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy "members manage calls" on public.calls for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy "members manage visits" on public.visits for all to authenticated using (public.is_member(agency_id)) with check (public.is_member(agency_id));

-- ---------- Funciones públicas (visitantes anónimos) ----------
-- La inmobiliaria se deduce de la propiedad (no se puede falsear); sin propiedad se usa p_agency.
create or replace function public.save_chat(
  p_session uuid, p_agency uuid, p_property_id uuid, p_label text, p_name text, p_contact text, p_messages jsonb, p_status text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agency uuid;
  v_property uuid;
begin
  if p_session is null or p_messages is null or jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) > 60 or pg_column_size(p_messages) > 60000 then
    raise exception 'chat inválido';
  end if;
  if p_status not in ('nuevo', 'atencion') then raise exception 'estado inválido'; end if;
  select id, agency_id into v_property, v_agency from public.properties where id = p_property_id;
  v_agency := coalesce(v_agency, p_agency);
  if v_agency is null or not exists (select 1 from public.agencies where id = v_agency and active) then
    raise exception 'inmobiliaria inválida';
  end if;
  insert into public.leads (agency_id, session_id, property_id, property_label, kind, name, contact, messages, status)
  values (v_agency, p_session, v_property, left(coalesce(nullif(p_label, ''), 'Consulta general'), 120), 'chat',
          left(coalesce(p_name, ''), 80), left(coalesce(p_contact, ''), 120), p_messages, p_status)
  on conflict (session_id) do update
    set name = excluded.name, contact = excluded.contact, messages = excluded.messages, status = excluded.status;
end;
$$;

create or replace function public.log_whatsapp_click(p_property_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leads (agency_id, property_id, property_label, kind)
  select p.agency_id, p.id, left(p.title, 120), 'whatsapp'
  from public.properties p join public.agencies a on a.id = p.agency_id
  where p.id = p_property_id and a.active;
end;
$$;
revoke all on function public.save_chat(uuid, uuid, uuid, text, text, text, jsonb, text), public.log_whatsapp_click(uuid)
  from public, anon, authenticated;
grant execute on function public.save_chat(uuid, uuid, uuid, text, text, text, jsonb, text), public.log_whatsapp_click(uuid)
  to anon, authenticated;

-- ---------- Funciones de administración (usuarios logueados) ----------
-- Alta de una inmobiliaria: solo el administrador de la plataforma.
create or replace function public.admin_create_agency(
  p_slug text, p_name text, p_whatsapp text default '', p_country text default '', p_city text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.is_platform_admin() then raise exception 'no autorizado'; end if;
  insert into public.agencies (slug, name, whatsapp, country, city)
  values (lower(trim(p_slug)), trim(p_name), trim(coalesce(p_whatsapp, '')), trim(coalesce(p_country, '')), trim(coalesce(p_city, '')))
  returning id into v;
  return v;
end;
$$;

-- Agregar un usuario (que ya exista en Authentication) al equipo: administrador o dueño de esa inmobiliaria.
create or replace function public.add_member(p_agency uuid, p_email text, p_role text default 'owner')
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not (public.is_platform_admin() or public.is_owner(p_agency)) then raise exception 'no autorizado'; end if;
  if p_role not in ('owner', 'agent') then raise exception 'rol inválido'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No existe un usuario con ese email. Crealo primero en Authentication.';
  end if;
  insert into public.agency_members (agency_id, user_id, role) values (p_agency, v_user, p_role)
  on conflict (agency_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.remove_member(p_agency uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_platform_admin() or public.is_owner(p_agency)) then raise exception 'no autorizado'; end if;
  if exists (select 1 from public.agency_members where agency_id = p_agency and user_id = p_user and role = 'owner')
     and (select count(*) from public.agency_members where agency_id = p_agency and role = 'owner') <= 1 then
    raise exception 'No se puede quitar al único dueño.';
  end if;
  delete from public.agency_members where agency_id = p_agency and user_id = p_user;
end;
$$;

create or replace function public.list_members(p_agency uuid)
returns table (user_id uuid, email text, role text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_platform_admin() or public.is_owner(p_agency)) then raise exception 'no autorizado'; end if;
  return query
    select m.user_id, u.email::text, m.role
    from public.agency_members m join auth.users u on u.id = m.user_id
    where m.agency_id = p_agency order by m.created_at;
end;
$$;
revoke all on function public.admin_create_agency(text, text, text, text, text), public.add_member(uuid, text, text),
  public.remove_member(uuid, uuid), public.list_members(uuid) from public, anon, authenticated;
grant execute on function public.admin_create_agency(text, text, text, text, text), public.add_member(uuid, text, text),
  public.remove_member(uuid, uuid), public.list_members(uuid) to authenticated;

-- ---------- Después de crear tu usuario en Authentication ----------
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'vos@ejemplo.com';
--   select public.add_member(...)  -- o desde el panel (Plataforma > Agregar al equipo)

-- ---------- WhatsApp automático ----------
-- Canal de cada conversación (web o WhatsApp).
alter table public.leads add column if not exists channel text not null default 'web'
  check (channel in ('web', 'whatsapp'));

-- Número de WhatsApp Business de cada inmobiliaria. phone_number_id es el identificador que Meta
-- envía en cada mensaje entrante; el servidor lo usa para saber a qué inmobiliaria pertenece.
create table if not exists public.agency_whatsapp (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  phone_number_id text not null unique check (char_length(phone_number_id) between 5 and 40),
  display_phone text not null default '' check (char_length(display_phone) <= 30),
  created_at timestamptz not null default now()
);
alter table public.agency_whatsapp enable row level security;
-- El equipo ve si su número está conectado; el administrador de plataforma ve todos.
-- No hay políticas de escritura: se configura con admin_set_whatsapp (el webhook usa la clave de servicio).
create policy "members read whatsapp" on public.agency_whatsapp
  for select to authenticated using (public.is_member(agency_id) or public.is_platform_admin());

-- Conecta (o cambia) el número de una inmobiliaria. Con p_phone_number_id vacío lo desconecta.
create or replace function public.admin_set_whatsapp(p_agency uuid, p_phone_number_id text, p_display text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'no autorizado'; end if;
  if coalesce(trim(p_phone_number_id), '') = '' then
    delete from public.agency_whatsapp where agency_id = p_agency;
  else
    insert into public.agency_whatsapp (agency_id, phone_number_id, display_phone)
    values (p_agency, trim(p_phone_number_id), trim(coalesce(p_display, '')))
    on conflict (agency_id) do update
      set phone_number_id = excluded.phone_number_id, display_phone = excluded.display_phone;
  end if;
end;
$$;
revoke all on function public.admin_set_whatsapp(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_whatsapp(uuid, text, text) to authenticated;
