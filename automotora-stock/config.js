// Si SUPABASE_URL y SUPABASE_ANON_KEY están vacíos, la app corre en modo demo
// (datos de muestra en localStorage, login admin / admin).
// La key publicable es pública por diseño; la seguridad la dan las políticas RLS de schema.sql.
// Modo demo desde 2026-10-08: la base de Supabase (ref knmdrahnbasmoqprhzio) está pausada para liberar
// un lugar gratis. Para volver a la base real: restaurarla en Supabase y pegar de nuevo estas dos claves:
//   URL  = "https://knmdrahnbasmoqprhzio.supabase.co"
//   KEY  = "sb_publishable_6_0zIwp2NoQU3FW18nm3iA_p9v_ORtd"
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
