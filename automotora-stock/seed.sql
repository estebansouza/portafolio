-- Datos de muestra (opcional, solo para demo). Las fotos son archivos de la carpeta img/ del sitio.
-- Créditos de las fotos: img/CREDITS.md
insert into public.vehicles (brand, model, year, km, price, currency, fuel, transmission, status, description, photos) values
('Toyota', 'Corolla XEi', 2021, 42000, 24500000, 'ARS', 'nafta', 'automática', 'disponible', 'Único dueño, service oficial al día.', '{img/corolla.jpg}'),
('Volkswagen', 'Amarok V6', 2022, 28000, 48000, 'USD', 'diesel', 'automática', 'disponible', 'Extreme 4Motion, cuero, techo corredizo.', '{img/amarok.jpg}'),
('Ford', 'Ranger XLS', 2019, 90000, 31000000, 'ARS', 'diesel', 'manual', 'reservado', '4x2, excelente estado.', '{img/ranger.jpg}'),
('Fiat', 'Cronos Precision', 2023, 12000, 17800000, 'ARS', 'nafta', 'manual', 'disponible', 'Como nuevo, 1.3 GSE, un solo dueño.', '{img/cronos.jpg}');
