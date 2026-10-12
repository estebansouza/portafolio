-- Datos de muestra (opcional, solo para demo). Las fotos son archivos de la carpeta img/ del sitio.
insert into public.agencies (slug, name, whatsapp, country, city) values
  ('nexo', 'Nexo Propiedades', '59800000000', 'Uruguay', 'Montevideo'),
  ('costa-sur', 'Costa Sur Inmobiliaria', '59800000001', 'Uruguay', 'Punta del Este')
on conflict (slug) do nothing;

insert into public.properties (agency_id, title, operation, type, price, bedrooms, bathrooms, garage, area_m2, country, city, neighborhood, status, description, photos)
select a.id, p.title, p.operation, p.type, p.price, p.bedrooms, p.bathrooms, p.garage, p.area_m2, p.country, p.city, p.neighborhood, p.status, p.description, p.photos
from public.agencies a
join (values
  ('nexo', 'Casa con jardín y parrillero', 'venta', 'casa', 285000, 3, 2, 2, 210, 'Uruguay', 'Montevideo', 'Carrasco', 'disponible', 'Casa de dos plantas con jardín, parrillero y cochera para dos autos. Cocina renovada y calefacción central.', '{img/casa.svg}'::text[]),
  ('nexo', 'Apartamento luminoso cerca del centro', 'alquiler', 'apartamento', 750, 2, 1, 0, 62, 'Uruguay', 'Montevideo', 'Cordón', 'disponible', 'Segundo piso por escalera, mucha luz natural, balcón y gastos comunes bajos.', '{img/apartamento.svg}'),
  ('nexo', 'Terreno de 900 m² a minutos de la playa', 'venta', 'terreno', 96000, 0, 0, 0, 900, 'Uruguay', 'Punta del Este', 'Laguna del Sauce', 'reservada', 'Terreno llano con servicios en la puerta, ideal para casa de fin de semana.', '{img/terreno.svg}'),
  ('nexo', 'Local comercial sobre avenida', 'alquiler', 'local', 1400, 0, 1, 0, 85, 'Uruguay', 'Montevideo', 'Tres Cruces', 'disponible', 'Local a la calle con vidriera amplia y depósito. Alto tránsito peatonal.', '{img/local.svg}'),
  ('nexo', 'Casa en Punta Carretas con patio', 'venta', 'casa', 372000, 4, 3, 1, 260, 'Uruguay', 'Montevideo', 'Punta Carretas', 'reservada', 'Casa reciclada, living a doble altura, patio con deck y barbacoa.', '{img/casa.svg}'),
  ('nexo', 'Apartamento 2 dormitorios con vista al mar', 'venta', 'apartamento', 168000, 2, 2, 1, 78, 'Uruguay', 'Montevideo', 'Pocitos', 'disponible', 'Piso alto, terraza, amenities y garaje. Muy buena orientación.', '{img/apartamento.svg}'),
  ('nexo', 'PH reciclado con terraza', 'alquiler', 'casa', 980, 2, 1, 0, 90, 'Uruguay', 'Montevideo', 'Malvín', 'disponible', 'PH al frente, terraza propia y cocina equipada.', '{img/casa.svg}'),
  ('nexo', 'Monoambiente a estrenar', 'alquiler', 'apartamento', 520, 1, 1, 0, 34, 'Uruguay', 'Montevideo', 'Centro', 'disponible', 'Edificio nuevo, balcón, gimnasio y lavandería compartida.', '{img/apartamento.svg}'),
  ('costa-sur', 'Chalet frente al mar en Manantiales', 'venta', 'casa', 640000, 5, 4, 2, 380, 'Uruguay', 'Punta del Este', 'Manantiales', 'disponible', 'Chalet de lujo a metros de la playa, piscina y quincho.', '{img/casa.svg}'),
  ('costa-sur', 'Apartamento en torre con servicios', 'alquiler', 'apartamento', 1800, 2, 2, 1, 95, 'Uruguay', 'Punta del Este', 'Península', 'disponible', 'Torre con piscina, gimnasio y seguridad 24 h. Alquiler de temporada.', '{img/apartamento.svg}')
) as p(slug, title, operation, type, price, bedrooms, bathrooms, garage, area_m2, country, city, neighborhood, status, description, photos)
  on p.slug = a.slug
where not exists (select 1 from public.properties x where x.agency_id = a.id);

-- Más propiedades de Costa Sur (las usa la página de demostración /demo).
insert into public.properties (agency_id, title, operation, type, price, bedrooms, bathrooms, garage, area_m2, country, city, neighborhood, status, description, photos)
select a.id, p.title, p.operation, p.type, p.price, p.bedrooms, p.bathrooms, p.garage, p.area_m2, 'Uruguay', 'Punta del Este', p.neighborhood, 'disponible', p.description, p.photos
from public.agencies a
join (values
  ('Casa moderna con piscina en Parque del Golf', 'venta', 'casa', 485000, 4, 3, 2, 320, 'Parque del Golf', 'Casa de líneas modernas en terreno arbolado, piscina, parrillero y galería con vista al jardín. A minutos del campo de golf.', '{img/casa.svg}'::text[]),
  ('Apartamento de 3 dormitorios en la Península', 'venta', 'apartamento', 295000, 3, 2, 1, 120, 'Península', 'Piso alto con balcón corrido y vista al mar, living amplio, cocina integrada y garaje. A pasos del puerto y de la rambla.', '{img/apartamento.svg}'),
  ('Terreno de 750 m² en La Barra a 300 m del mar', 'venta', 'terreno', 130000, 0, 0, 0, 750, 'La Barra', 'Terreno plano y arbolado con servicios, en zona residencial a 300 metros de la playa. Ideal para casa de veraneo.', '{img/terreno.svg}'),
  ('Local comercial sobre Av. Gorlero', 'alquiler', 'local', 2200, 0, 1, 0, 110, 'Centro', 'Local a la calle con doble vidriera y gran circulación peatonal, ideal para gastronomía o indumentaria. Depósito y baño.', '{img/local.svg}')
) as p(title, operation, type, price, bedrooms, bathrooms, garage, area_m2, neighborhood, description, photos) on true
where a.slug = 'costa-sur'
  and not exists (select 1 from public.properties x where x.agency_id = a.id and x.title = p.title);
