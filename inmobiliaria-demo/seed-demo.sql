-- Datos de ejemplo para el dashboard de la inmobiliaria 'nexo' (opcional, para demos).
-- Las fechas son relativas a hoy: los cierres caen siempre dentro del mes en curso.
-- Es idempotente: cada tabla se carga solo si todavía está vacía para esa inmobiliaria.

-- Contactos
insert into public.contacts (agency_id, name, role, phone, email, notes, created_at)
select a.id, v.name, v.role, v.phone, v.email, '', now() - v.d * interval '1 day'
from public.agencies a, (values
  ('Valentina Rossi', 'comprador',   '59899100001', 'valentina@correo.com', 3),
  ('Martín Pereira',  'comprador',   '59899100002', 'martin@correo.com',    6),
  ('Lucía Fernández', 'vendedor',    '59899100003', 'lucia@correo.com',     9),
  ('Diego Álvarez',   'comprador',   '59899100004', 'diego@correo.com',    12),
  ('Camila Suárez',   'inquilino',   '59899100005', 'camila@correo.com',   15),
  ('Joaquín Techera', 'comprador',   '59899100006', 'joaquin@correo.com',  18),
  ('Sofía Ibarra',    'propietario', '59899100007', 'sofia@correo.com',    21),
  ('Andrés Cabrera',  'comprador',   '59899100008', 'andres@correo.com',   24)
) as v(name, role, phone, email, d)
where a.slug = 'nexo' and not exists (select 1 from public.contacts c where c.agency_id = a.id);

-- Operaciones (pipeline). k = orden del cierre dentro del mes; h = horas desde el último cambio de etapa.
insert into public.deals (agency_id, title, contact_name, property_label, stage, value, commission_pct, stage_at, closed_at, created_at)
select a.id, v.title, v.contact, v.title, v.stage, v.value, 3,
  case when v.stage = 'cerrado'
       then least(now(), date_trunc('month', now()) + v.k * interval '2 days' + interval '11 hours')
       else now() - v.h * interval '1 hour' end,
  case when v.stage = 'cerrado'
       then least(now(), date_trunc('month', now()) + v.k * interval '2 days' + interval '11 hours') end,
  now() - interval '9 days'
from public.agencies a, (values
  ('Casa en Carrasco',               'Valentina Rossi', 'cerrado',     150000, 0, 0),
  ('Apartamento en Pocitos',         'Martín Pereira',  'cerrado',     180000, 1, 0),
  ('PH en Malvín',                   'Lucía Fernández', 'cerrado',     210000, 2, 0),
  ('Casa en Cordón',                 'Diego Álvarez',   'cerrado',     240000, 3, 0),
  ('Monoambiente en Centro',         'Camila Suárez',   'cerrado',      95000, 4, 0),
  ('Casa en Punta Carretas',         'Joaquín Techera', 'sena',        172000, 0, 1),
  ('Apartamento con vista al mar',   'Sofía Ibarra',    'negociacion', 168000, 0, 5),
  ('Terreno en Laguna del Sauce',    'Andrés Cabrera',  'negociacion',  96000, 0, 20),
  ('Casa con jardín y parrillero',   'Valentina Rossi', 'visita',      285000, 0, 30),
  ('Local en Tres Cruces',           'Martín Pereira',  'perdido',     120000, 0, 2),
  ('Apartamento luminoso',           'Lucía Fernández', 'consulta',     90000, 0, 3)
) as v(title, contact, stage, value, k, h)
where a.slug = 'nexo' and not exists (select 1 from public.deals d where d.agency_id = a.id);

-- Llamadas
insert into public.calls (agency_id, contact_name, phone, direction, outcome, notes, created_at)
select a.id, v.contact, v.phone, v.direction, v.outcome, v.notes, now() - v.h * interval '1 hour'
from public.agencies a, (values
  ('Valentina Rossi', '59899100001', 'saliente', 'contestó',    'Confirmamos visita del sábado.',            1),
  ('Rodrigo Silva',   '59899123456', 'entrante', 'contestó',    'Consulta por casa en Carrasco.',            5),
  ('Martín Pereira',  '59899100002', 'saliente', 'no contestó', 'Dejé mensaje de voz.',                       9),
  ('Sofía Ibarra',    '59899100007', 'saliente', 'contestó',    'Quiere bajar el precio a US$ 160.000.',     28),
  ('Diego Álvarez',   '59899100004', 'entrante', 'contestó',    'Pide firmar el boleto de reserva.',         52)
) as v(contact, phone, direction, outcome, notes, h)
where a.slug = 'nexo' and not exists (select 1 from public.calls c where c.agency_id = a.id);

-- Visitas de las últimas 4 semanas (más demanda a fin de semana y por la tarde) + algunas próximas.
-- Horarios en hora de Montevideo; el mapa del dashboard los muestra en la hora del navegador.
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
  cross join generate_series(0, 5) as s(slot)
  cross join lateral generate_series(1,
    round(((abs(hashtext(d.back::text || '-' || s.slot)) % 1000) / 1000.0)
      * (array[1, 2, 1.5, 3, 4, 2])[s.slot + 1]
      * (array[1, 1, 1.2, 1.6, 2, 1.8, 0.6])[extract(isodow from current_date - d.back)::int])::int
  ) as n(i)
) g
cross join lateral (
  select (array['Casa con jardín y parrillero', 'Apartamento luminoso cerca del centro', 'Apartamento 2 dormitorios con vista al mar',
                'PH reciclado con terraza', 'Monoambiente a estrenar', 'Casa en Punta Carretas con patio'])[1 + abs(hashtext(g.seed || 'p')) % 6] as title,
         (array['Valentina Rossi', 'Martín Pereira', 'Lucía Fernández', 'Diego Álvarez', 'Camila Suárez'])[1 + abs(hashtext(g.seed || 'n')) % 5] as name
) pick
where a.slug = 'nexo' and not exists (select 1 from public.visits v where v.agency_id = a.id);

-- Conversaciones (chat con IA y consultas)
insert into public.leads (agency_id, session_id, property_id, property_label, kind, name, contact, message, messages, status, created_at)
select a.id, gen_random_uuid(), p.id, p.title, v.kind, v.name, v.contact, v.message, v.messages::jsonb, v.status, now() - v.mins * interval '1 minute'
from public.agencies a
join (values
  ('Casa en Punta Carretas con patio', 'chat', 'Rodrigo Silva', '59899123456', '¿Se puede visitar el sábado por la mañana?', 'atencion', 4,
   '[{"role":"user","text":"Hola, ¿se puede visitar el sábado por la mañana?"},{"role":"assistant","text":"¡Con gusto! Para coordinar una visita necesito tu nombre y un teléfono o email. Un asesor te confirma el horario a la brevedad."},{"role":"user","text":"Soy Rodrigo, mi cel es 099 123 456."},{"role":"assistant","text":"¡Gracias, Rodrigo! Ya avisé al equipo: te escriben para confirmar la visita."}]'),
  ('Apartamento 2 dormitorios con vista al mar', 'chat', 'Paula Méndez', 'paula@correo.com', 'Busco algo de 2 dormitorios en Pocitos, ¿acepta mascotas?', 'atencion', 52,
   '[{"role":"user","text":"Busco algo de 2 dormitorios en Pocitos, ¿acepta mascotas?"},{"role":"assistant","text":"Este apartamento tiene 2 dormitorios y está en Pocitos, con terraza y garaje. Lo de las mascotas lo tiene que confirmar un asesor: ¿me dejás tu email o teléfono?"},{"role":"user","text":"paula@correo.com"}]'),
  ('Casa con jardín y parrillero', 'whatsapp', '', '', '', 'nuevo', 180, '[]'),
  ('Casa con jardín y parrillero', 'chat', 'Gonzalo Ferreira', '59898765432', 'Me interesa, ¿tiene financiación el propietario?', 'respondido', 1560,
   '[{"role":"user","text":"Me interesa, ¿tiene financiación el propietario?"},{"role":"assistant","text":"Eso lo define el equipo comercial. Dejame tu nombre y un teléfono o email y un asesor te contacta."},{"role":"user","text":"Gonzalo, 098 765 432"}]')
) as v(title, kind, name, contact, message, status, mins, messages) on true
join public.properties p on p.agency_id = a.id and p.title = v.title
where a.slug = 'nexo' and not exists (select 1 from public.leads l where l.agency_id = a.id);
