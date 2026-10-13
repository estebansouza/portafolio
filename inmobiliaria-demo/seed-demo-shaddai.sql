-- Datos de EJEMPLO (ficticios) para mostrar el panel de 'shaddai' en la demo comercial.
-- Nombres y teléfonos inventados. Si el cliente firma, borrarlos antes de entregar el panel:
--   delete from public.contacts/deals/calls/visits/leads where agency_id = (select id from public.agencies where slug = 'shaddai')
--   y quitar las propiedades de ejemplo que no sean reales. Los valores de operaciones van en USD.
-- Idempotente: cada tabla se carga solo si está vacía para esa inmobiliaria.

insert into public.contacts (agency_id, name, role, phone, email, notes, created_at)
select a.id, v.name, v.role, v.phone, v.email, '', now() - v.d * interval '1 day'
from public.agencies a, (values
  ('Ana Techera',     'inquilino',   '59899200001', 'ana@correo.com',      2),
  ('Marcelo Núñez',   'comprador',   '59899200002', 'marcelo@correo.com',  5),
  ('Gabriela Sosa',   'propietario', '59899200003', 'gabriela@correo.com', 8),
  ('Nicolás Barreto', 'inquilino',   '59899200004', 'nicolas@correo.com', 11),
  ('Florencia Gómez', 'comprador',   '59899200005', 'florencia@correo.com',14),
  ('Hugo Cardozo',    'vendedor',    '59899200006', 'hugo@correo.com',    19),
  ('Romina Acosta',   'inquilino',   '59899200007', 'romina@correo.com',  23)
) as v(name, role, phone, email, d)
where a.slug = 'shaddai' and not exists (select 1 from public.contacts c where c.agency_id = a.id);

insert into public.deals (agency_id, title, contact_name, property_label, stage, value, commission_pct, stage_at, closed_at, created_at)
select a.id, v.title, v.contact, v.title, v.stage, v.value, 3,
  case when v.stage = 'cerrado'
       then least(now(), date_trunc('month', now()) + v.k * interval '2 days' + interval '11 hours')
       else now() - v.h * interval '1 hour' end,
  case when v.stage = 'cerrado'
       then least(now(), date_trunc('month', now()) + v.k * interval '2 days' + interval '11 hours') end,
  now() - interval '9 days'
from public.agencies a, (values
  ('Casa en Las Piedras',                 'Marcelo Núñez',   'cerrado',     42000, 0, 0),
  ('Apartamento en La Paz',               'Florencia Gómez', 'cerrado',     36000, 1, 0),
  ('Local en Progreso',                   'Hugo Cardozo',    'cerrado',     28000, 2, 0),
  ('Casa, monoambiente y terreno en 18 de Mayo', 'Marcelo Núñez', 'sena',   38000, 0, 2),
  ('Local en complejo con seguridad en La Paz',  'Florencia Gómez', 'negociacion', 30000, 0, 6),
  ('Casa de 2 dormitorios en La Paz',     'Nicolás Barreto', 'visita',      80000, 0, 28),
  ('Terreno en Progreso',                 'Gabriela Sosa',   'perdido',     22000, 0, 3),
  ('Chacra en Canelones',                 'Romina Acosta',   'consulta',    65000, 0, 4)
) as v(title, contact, stage, value, k, h)
where a.slug = 'shaddai' and not exists (select 1 from public.deals d where d.agency_id = a.id);

insert into public.calls (agency_id, contact_name, phone, direction, outcome, notes, created_at)
select a.id, v.contact, v.phone, v.direction, v.outcome, v.notes, now() - v.h * interval '1 hour'
from public.agencies a, (values
  ('Ana Techera',     '59899200001', 'saliente', 'contestó',    'Confirmamos visita a la casa de Las Piedras.', 2),
  ('Marcelo Núñez',   '59899200002', 'entrante', 'contestó',    'Pregunta por la forma de pago de la casa de 18 de Mayo.', 6),
  ('Nicolás Barreto', '59899200004', 'saliente', 'no contestó', 'Dejé mensaje de voz.', 10),
  ('Florencia Gómez', '59899200005', 'saliente', 'contestó',    'Quiere ver el local de La Paz el viernes.', 30)
) as v(contact, phone, direction, outcome, notes, h)
where a.slug = 'shaddai' and not exists (select 1 from public.calls c where c.agency_id = a.id);

-- Visitas de las últimas 4 semanas + próximas (misma lógica que seed-demo.sql, con propiedades de Shaddai).
insert into public.visits (agency_id, property_label, contact_name, at, status, created_at)
select a.id, pick.title, pick.name, g.at,
  case when g.at > now() then 'confirmada'
       when abs(hashtext(g.seed || 'st')) % 100 < 12 then 'cancelada'
       else 'realizada' end,
  case when g.at > now() then now() - (abs(hashtext(g.seed || 'cr')) % 360) * interval '1 minute'
       else g.at - interval '2 days' end
from public.agencies a
cross join lateral (
  select d.back, s.slot, n.i,
    (d.back::text || '-' || s.slot || '-' || n.i) as seed,
    ((((current_date - d.back) + time '09:00' + s.slot * interval '2 hours'
       + (abs(hashtext(d.back::text || '-' || s.slot || '-' || n.i || 'min')) % 100) * interval '1 minute')
      at time zone 'America/Montevideo')) as at
  from generate_series(-3, 28) as d(back)
  cross join generate_series(0, 4) as s(slot)
  cross join lateral generate_series(1,
    round(((abs(hashtext(d.back::text || '-' || s.slot)) % 1000) / 1000.0)
      * (array[1, 2, 1.5, 2.5, 1.5])[s.slot + 1]
      * (array[1, 1, 1.2, 1.4, 1.8, 1.8, 0.4])[extract(isodow from current_date - d.back)::int])::int
  ) as n(i)
) g
cross join lateral (
  select (array['Casa en alquiler con cochera en Progreso', 'Casa en alquiler con cochera en Las Piedras',
                'Casa en alquiler en La Paz', 'Apartamento de 1 dormitorio con fondo, cerca de Crami',
                'Local en venta en complejo con seguridad en La Paz'])[1 + abs(hashtext(g.seed || 'p')) % 5] as title,
         (array['Ana Techera', 'Marcelo Núñez', 'Nicolás Barreto', 'Florencia Gómez', 'Romina Acosta'])[1 + abs(hashtext(g.seed || 'n')) % 5] as name
) pick
where a.slug = 'shaddai' and not exists (select 1 from public.visits v where v.agency_id = a.id);

insert into public.leads (agency_id, session_id, property_id, property_label, kind, name, contact, message, messages, status, created_at)
select a.id, gen_random_uuid(), p.id, p.title, v.kind, v.name, v.contact, v.message, v.messages::jsonb, v.status, now() - v.mins * interval '1 minute'
from public.agencies a
join (values
  ('Casa en alquiler en La Paz', 'chat', 'Lorena Pintos', '59899333444', '¿Se puede visitar el sábado por la mañana?', 'atencion', 6,
   '[{"role":"user","text":"Hola, ¿se puede visitar la casa de La Paz el sábado por la mañana?"},{"role":"assistant","text":"¡Con gusto! Para coordinar la visita necesito tu nombre y un teléfono o email. Un asesor te confirma el horario a la brevedad."},{"role":"user","text":"Soy Lorena, mi cel es 099 333 444."},{"role":"assistant","text":"¡Gracias, Lorena! Ya avisé al equipo: te escriben para confirmar la visita."}]'),
  ('Casa en alquiler con cochera en Las Piedras', 'chat', 'Sebastián Rey', 'sebastian@correo.com', 'Busco casa con cochera en Las Piedras, ¿aceptan mascotas?', 'atencion', 55,
   '[{"role":"user","text":"Busco casa con cochera en Las Piedras, ¿aceptan mascotas?"},{"role":"assistant","text":"Tenemos una casa con cochera en Las Piedras a $ 18.000 por mes. Lo de las mascotas lo confirma un asesor: ¿me dejás tu email o teléfono?"},{"role":"user","text":"sebastian@correo.com"}]'),
  ('Local en venta en complejo con seguridad en La Paz', 'chat', '', '', '', 'nuevo', 190, '[]'),
  ('Casa, monoambiente y terreno amplio con jardín en 18 de Mayo', 'chat', 'Martina Olivera', '59898111222', 'Me interesa, ¿se puede financiar?', 'respondido', 1500,
   '[{"role":"user","text":"Me interesa, ¿se puede financiar?"},{"role":"assistant","text":"Eso lo define el equipo comercial. Dejame tu nombre y un teléfono o email y un asesor te contacta."},{"role":"user","text":"Martina, 098 111 222"}]')
) as v(title, kind, name, contact, message, status, mins, messages) on true
join public.properties p on p.agency_id = a.id and p.title = v.title
where a.slug = 'shaddai' and not exists (select 1 from public.leads l where l.agency_id = a.id and l.name = 'Lorena Pintos');

insert into public.leads (agency_id, session_id, property_id, property_label, kind, channel, name, contact, message, messages, status, created_at)
select a.id, gen_random_uuid(), null, 'Consulta por WhatsApp', 'chat', 'whatsapp', 'Diego Lemos', '59899555666',
  'Hola, busco un apartamento de 1 dormitorio para alquilar',
  '[{"role":"user","text":"Hola, busco un apartamento de 1 dormitorio para alquilar"},{"role":"assistant","text":"¡Hola Diego! Tenemos un apartamento de 1 dormitorio con fondo cerca de Crami Sanatorio, $ 18.000 por mes. Decime si querés coordinar una visita."},{"role":"user","text":"Perfecto, ¿puedo verlo mañana a la tarde?"},{"role":"assistant","text":"¡Claro! Ya avisé al equipo para que te confirme el horario por este mismo chat."}]'::jsonb,
  'atencion', now() - interval '30 minutes'
from public.agencies a
where a.slug = 'shaddai' and not exists (select 1 from public.leads l where l.agency_id = a.id and l.channel = 'whatsapp');
