// Si SUPABASE_URL y SUPABASE_ANON_KEY están vacíos, la app corre en modo demo
// (datos de muestra en localStorage, login admin / admin).
// La key publicable es pública por diseño; la seguridad la dan las políticas RLS de schema.sql.
// Para usar una base real: crear un proyecto Supabase, correr schema.sql y pegar las dos claves.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
