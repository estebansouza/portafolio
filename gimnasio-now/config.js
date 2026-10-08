// Supabase: dejar vacío para usar el modo demo (datos en el navegador, login admin / admin).
// La clave "anon" / publishable es pública por diseño; la seguridad la dan las políticas RLS de schema.sql.
export const SUPABASE_URL = "https://peadyxgzkidckmgdxunm.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_oormBhvLAUklZNF7TO8F1A_gRfpg7Ve";

export const GYM = {
  name: "Gym Now Fitness",
  tagline: "Entrená a tu ritmo, en tu barrio.",
  address: "Doctor Pouey 667, esq. Soca",
  city: "Las Piedras, Canelones",
  whatsapp: "59897314341", // 097 314 341
  tz: "America/Montevideo",
  utcOffset: "-03:00", // Uruguay no usa horario de verano
  // days: 0 = domingo … 6 = sábado
  hours: [
    { days: [1, 2, 3, 4, 5], open: "08:30", close: "22:00", label: "Lunes a viernes" },
    { days: [6], open: "09:00", close: "13:00", label: "Sábados" },
  ],
};

// Planes iniciales (solo se usan en el modo demo; con Supabase se editan desde el panel).
export const DEFAULT_PLANS = [
  { name: "Pase libre", price: 1300, days: 30, description: "Acceso libre a la sala, todos los días en horario del gimnasio." },
  { name: "Pase libre + caminadora", price: 1500, days: 30, description: "Pase libre e incluye el uso de la caminadora." },
];
