-- Esquema para Supabase (proyecto propio de Gym Now Fitness). Ejecutar en el SQL editor.
-- Panel: crear el usuario en Authentication > Users y agregarlo a public.staff (ver al final).
-- Importante: solo los usuarios de public.staff pueden leer/escribir datos de socios; registrarse no da permisos.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  price numeric not null check (price >= 0),
  days int not null check (days between 1 and 366),
  description text not null default '' check (char_length(description) <= 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  document text not null default '' check (char_length(document) <= 30),
  phone text not null default '' check (char_length(phone) <= 30),
  plan_id uuid references public.plans (id) on delete set null,
  expires_on date,
  notes text not null default '' check (char_length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists members_plan_id_idx on public.members (plan_id);
create index if not exists members_expires_on_idx on public.members (expires_on);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  plan_name text not null,
  amount numeric not null check (amount >= 0),
  method text not null check (method in ('efectivo', 'transferencia', 'tarjeta')),
  paid_on date not null,
  covers_from date not null,
  expires_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists payments_member_id_idx on public.payments (member_id);
create index if not exists payments_plan_id_idx on public.payments (plan_id);
create index if not exists payments_paid_on_idx on public.payments (paid_on desc);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists checkins_member_id_idx on public.checkins (member_id);
create index if not exists checkins_created_at_idx on public.checkins (created_at desc);

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.checkins enable row level security;
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- Público: solo ve los planes activos (para la página del gimnasio).
create policy "public reads active plans" on public.plans
  for select to anon, authenticated using (active);

-- Panel: solo staff gestiona todo (incluye planes ocultos y todos los datos de socios).
create policy "staff manage plans" on public.plans
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage members" on public.members
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage payments" on public.payments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage checkins" on public.checkins
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff reads own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- Registra un pago y actualiza el vencimiento del socio en una sola transacción.
-- security invoker: corre con los permisos de quien llama, así que RLS exige ser staff.
create or replace function public.register_payment(
  p_member uuid, p_plan uuid, p_amount numeric, p_method text,
  p_paid_on date, p_covers_from date, p_expires_on date
) returns public.payments
language plpgsql security invoker set search_path = '' as $$
declare
  v_plan_name text;
  v_payment public.payments;
begin
  select name into v_plan_name from public.plans where id = p_plan;
  if v_plan_name is null then
    raise exception 'Plan inexistente';
  end if;
  insert into public.payments (member_id, plan_id, plan_name, amount, method, paid_on, covers_from, expires_on)
    values (p_member, p_plan, v_plan_name, p_amount, p_method, p_paid_on, p_covers_from, p_expires_on)
    returning * into v_payment;
  update public.members set plan_id = p_plan, expires_on = p_expires_on, active = true where id = p_member;
  if not found then
    raise exception 'Socio inexistente';
  end if;
  return v_payment;
end;
$$;
revoke all on function public.register_payment(uuid, uuid, numeric, text, date, date, date) from public, anon;
grant execute on function public.register_payment(uuid, uuid, numeric, text, date, date, date) to authenticated;

-- Planes iniciales de Gym Now Fitness (se editan desde el panel).
insert into public.plans (name, price, days, description) values
  ('Pase libre', 1300, 30, 'Acceso libre a la sala, todos los días en horario del gimnasio.'),
  ('Pase libre + caminadora', 1500, 30, 'Pase libre e incluye el uso de la caminadora.');

-- Después de crear el usuario del panel:
--   insert into public.staff (user_id) select id from auth.users where email = 'dueño@ejemplo.com';
