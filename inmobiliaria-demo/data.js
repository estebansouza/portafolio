// Capa de datos: Supabase si hay config, localStorage (demo) si no.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const DEFAULT_SETTINGS = {
  business_name: "Nexo Propiedades",
  whatsapp: "59800000000",
  country: "Uruguay",
  city: "Montevideo",
  goal_closings: 8,
  goal_listings: 12,
  goal_commission: 42000,
};

// Precios siempre en USD (alquiler = USD por mes).
const SAMPLE = [
  { title: "Casa con jardín y parrillero", operation: "venta", type: "casa", price: 285000, bedrooms: 3, bathrooms: 2, garage: 2, area_m2: 210, country: "Uruguay", city: "Montevideo", neighborhood: "Carrasco", status: "disponible", description: "Casa de dos plantas con jardín, parrillero y cochera para dos autos. Cocina renovada y calefacción central.", photos: ["img/casa.svg"] },
  { title: "Apartamento luminoso cerca del centro", operation: "alquiler", type: "apartamento", price: 750, bedrooms: 2, bathrooms: 1, garage: 0, area_m2: 62, country: "Uruguay", city: "Montevideo", neighborhood: "Cordón", status: "disponible", description: "Segundo piso por escalera, mucha luz natural, balcón y gastos comunes bajos.", photos: ["img/apartamento.svg"] },
  { title: "Terreno de 900 m² a minutos de la playa", operation: "venta", type: "terreno", price: 96000, bedrooms: 0, bathrooms: 0, garage: 0, area_m2: 900, country: "Uruguay", city: "Punta del Este", neighborhood: "Laguna del Sauce", status: "reservada", description: "Terreno llano con servicios en la puerta, ideal para casa de fin de semana.", photos: ["img/terreno.svg"] },
  { title: "Local comercial sobre avenida", operation: "alquiler", type: "local", price: 1400, bedrooms: 0, bathrooms: 1, garage: 0, area_m2: 85, country: "Uruguay", city: "Montevideo", neighborhood: "Tres Cruces", status: "disponible", description: "Local a la calle con vidriera amplia y depósito. Alto tránsito peatonal.", photos: ["img/local.svg"] },
  { title: "Casa en Punta Carretas con patio", operation: "venta", type: "casa", price: 372000, bedrooms: 4, bathrooms: 3, garage: 1, area_m2: 260, country: "Uruguay", city: "Montevideo", neighborhood: "Punta Carretas", status: "reservada", description: "Casa reciclada, living a doble altura, patio con deck y barbacoa.", photos: ["img/casa.svg"] },
  { title: "Apartamento 2 dormitorios con vista al mar", operation: "venta", type: "apartamento", price: 168000, bedrooms: 2, bathrooms: 2, garage: 1, area_m2: 78, country: "Uruguay", city: "Montevideo", neighborhood: "Pocitos", status: "disponible", description: "Piso alto, terraza, amenities y garaje. Muy buena orientación.", photos: ["img/apartamento.svg"] },
  { title: "PH reciclado con terraza", operation: "alquiler", type: "casa", price: 980, bedrooms: 2, bathrooms: 1, garage: 0, area_m2: 90, country: "Uruguay", city: "Montevideo", neighborhood: "Malvín", status: "disponible", description: "PH al frente, terraza propia y cocina equipada.", photos: ["img/casa.svg"] },
  { title: "Monoambiente a estrenar", operation: "alquiler", type: "apartamento", price: 520, bedrooms: 1, bathrooms: 1, garage: 0, area_m2: 34, country: "Uruguay", city: "Montevideo", neighborhood: "Centro", status: "disponible", description: "Edificio nuevo, balcón, gimnasio y lavandería compartida.", photos: ["img/apartamento.svg"] },
];

// ---------- Demo (localStorage) ----------
const HOUR = 36e5, DAY = 864e5;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
let seq = 0;
const newId = () => `${Date.now()}${seq++}`;

const LS = { props: "inmo_demo_properties_v2", settings: "inmo_demo_settings", session: "inmo_demo_session", leads: "inmo_demo_leads_v3" };
const read = (k, fallback) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage bloqueado */ } };

function demoProps() {
  let props = read(LS.props, null);
  if (!props) {
    props = SAMPLE.map((p, i) => ({ ...p, id: String(i + 1), created_at: ago(i * 2 * DAY + 3 * HOUR) }));
    write(LS.props, props);
  }
  return props;
}

function demoLeads() {
  let leads = read(LS.leads, null);
  if (!leads) {
    const mk = (i, kind, name, contact, message, status, ms) => {
      const p = demoProps()[i];
      return { id: newId(), property_id: p.id, property_label: p.title, kind, name, contact, message, status, created_at: ago(ms) };
    };
    const chat = mk(4, "chat", "Rodrigo Silva", "59899123456", "¿Se puede visitar el sábado por la mañana?", "atencion", 4 * 60 * 1000);
    chat.session_id = newId();
    chat.messages = [
      { role: "user", text: "Hola, ¿se puede visitar el sábado por la mañana?", at: ago(5 * 60 * 1000) },
      { role: "assistant", text: "¡Con gusto! Para coordinar una visita necesito tu nombre y un teléfono o email. Un asesor te confirma el horario a la brevedad.", at: ago(5 * 60 * 1000) },
      { role: "user", text: "Soy Rodrigo, mi cel es 099 123 456.", at: ago(4 * 60 * 1000) },
      { role: "assistant", text: "¡Gracias, Rodrigo! Ya avisé al equipo: te escriben para confirmar la visita.", at: ago(4 * 60 * 1000) },
    ];
    leads = [
      chat,
      mk(5, "consulta", "Paula Méndez", "paula@correo.com", "Busco algo de 2 dormitorios en Pocitos, ¿acepta mascotas?", "nuevo", 52 * 60 * 1000),
      mk(1, "whatsapp", "", "", "", "nuevo", 3 * HOUR),
      mk(0, "consulta", "Gonzalo Ferreira", "59898765432", "Me interesa, ¿tiene financiación el propietario?", "respondido", 26 * HOUR),
    ];
    write(LS.leads, leads);
  }
  return leads;
}

// ---------- Supabase ----------
let sbPromise;
function sb() {
  sbPromise ||= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
    .then((m) => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return sbPromise;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

// ---------- Inmobiliarias y sesión del panel ----------
const DEMO_AGENCY_ID = "demo";
const AGENCY_COLS = "id,slug,name,whatsapp,country,city,active";

function demoAgency() {
  const s = { ...DEFAULT_SETTINGS, ...read(LS.settings, {}) };
  return { id: DEMO_AGENCY_ID, slug: "nexo", name: s.business_name, whatsapp: s.whatsapp, country: s.country, city: s.city, active: true };
}

// Datos públicos de una inmobiliaria (catálogo y chat). null si no existe o está inactiva.
export async function getAgencyBySlug(slug) {
  if (isDemo) return demoAgency();
  return must(await (await sb()).from("agencies").select(AGENCY_COLS).eq("slug", String(slug)).eq("active", true).maybeSingle());
}

export async function getAgencyById(id) {
  if (isDemo) return demoAgency();
  return must(await (await sb()).from("agencies").select(AGENCY_COLS).eq("id", id).eq("active", true).maybeSingle());
}

// Nombre y WhatsApp con las claves que usan las pantallas.
export const publicSettings = (a) => ({ business_name: a.name, whatsapp: a.whatsapp, country: a.country, city: a.city });

// Inmobiliaria con la que trabaja el panel en esta sesión (la fija el panel al iniciar).
let panelAgency = null;
export function setPanelAgency(a) { panelAgency = a; }
const agencyId = () => {
  if (!panelAgency) throw new Error("No hay una inmobiliaria seleccionada.");
  return panelAgency.id;
};

// Quién es el usuario logueado: sus inmobiliarias (con rol) y si administra la plataforma.
export async function getMyContext() {
  if (isDemo) return { email: "admin", isAdmin: true, memberships: [{ role: "owner", agency: demoAgency() }] };
  const client = await sb();
  const { session } = must(await client.auth.getSession());
  if (!session) return { email: "", isAdmin: false, memberships: [] };
  const uid = session.user.id;
  const [mem, admin] = await Promise.all([
    client.from("agency_members").select(`role, agencies(${AGENCY_COLS})`).eq("user_id", uid),
    client.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  return {
    email: session.user.email ?? "",
    isAdmin: !!must(admin),
    memberships: must(mem).filter((m) => m.agencies).map((m) => ({ role: m.role, agency: m.agencies })),
  };
}

// ---------- Propiedades ----------
export async function listProperties({ agency = null, includeClosed = false } = {}) {
  if (isDemo) {
    return demoProps().filter((p) => includeClosed || p.status !== "cerrada")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  let q = (await sb()).from("properties").select("*").order("created_at", { ascending: false });
  const id = agency?.id ?? panelAgency?.id;
  if (id) q = q.eq("agency_id", id);
  if (!includeClosed) q = q.neq("status", "cerrada");
  return must(await q);
}

export async function getProperty(id) {
  if (isDemo) return demoProps().find((p) => p.id === id) || null;
  return must(await (await sb()).from("properties").select("*").eq("id", id).maybeSingle());
}

export async function saveProperty(p) {
  if (isDemo) {
    const props = demoProps();
    if (p.id) {
      const i = props.findIndex((x) => x.id === p.id);
      if (i >= 0) props[i] = { ...props[i], ...p };
    } else {
      props.unshift({ ...p, id: newId(), created_at: new Date().toISOString() });
    }
    write(LS.props, props);
    return;
  }
  const { id, created_at, agency_id, ...fields } = p;
  const table = (await sb()).from("properties");
  must(id ? await table.update(fields).eq("id", id) : await table.insert({ ...fields, agency_id: agencyId() }));
}

export async function deleteProperty(id) {
  if (isDemo) return write(LS.props, demoProps().filter((p) => p.id !== id));
  must(await (await sb()).from("properties").delete().eq("id", id));
}

// Configuración del panel = datos de la inmobiliaria + sus metas del mes.
export async function getSettings() {
  if (isDemo) return { ...DEFAULT_SETTINGS, ...read(LS.settings, {}) };
  const client = await sb();
  const [a, s] = await Promise.all([
    client.from("agencies").select("name,whatsapp,country,city").eq("id", agencyId()).maybeSingle(),
    client.from("agency_settings").select("goal_closings,goal_listings,goal_commission").eq("agency_id", agencyId()).maybeSingle(),
  ]);
  const ag = must(a) ?? {};
  return { ...DEFAULT_SETTINGS, business_name: ag.name ?? DEFAULT_SETTINGS.business_name, whatsapp: ag.whatsapp ?? "", country: ag.country ?? "", city: ag.city ?? "", ...(must(s) ?? {}) };
}

export async function saveSettings(s) {
  if (isDemo) return write(LS.settings, s);
  const client = await sb();
  must(await client.from("agencies").update({ name: s.business_name, whatsapp: s.whatsapp, country: s.country, city: s.city }).eq("id", agencyId()));
  must(await client.from("agency_settings").update({ goal_closings: s.goal_closings, goal_listings: s.goal_listings, goal_commission: s.goal_commission }).eq("agency_id", agencyId()));
  if (panelAgency) panelAgency = { ...panelAgency, name: s.business_name, whatsapp: s.whatsapp, country: s.country, city: s.city };
}

export async function uploadPhoto(file) {
  if (isDemo) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  const client = await sb();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${agencyId()}/${crypto.randomUUID()}.${ext || "jpg"}`;
  must(await client.storage.from("property-photos").upload(path, file, { contentType: file.type }));
  return client.storage.from("property-photos").getPublicUrl(path).data.publicUrl;
}

// ---------- Consultas (leads) ----------
// Click en "Consultar por WhatsApp" (sin datos personales). Nunca debe romper la página.
export async function logWhatsappClick(property) {
  try {
    if (isDemo) {
      const all = demoLeads();
      all.unshift({
        id: newId(), property_id: property.id, property_label: String(property.title).slice(0, 120), kind: "whatsapp",
        name: "", contact: "", message: "", messages: [], status: "nuevo", created_at: new Date().toISOString(),
      });
      write(LS.leads, all.slice(0, 500));
      return;
    }
    must(await (await sb()).rpc("log_whatsapp_click", { p_property_id: property.id }));
  } catch (e) {
    console.warn("No se pudo registrar el click", e);
  }
}

// Guarda (crea o actualiza) la conversación de chat de un visitante. status: "nuevo" | "atencion".
// property puede ser null (chat general de la inmobiliaria). Si falla no rompe el chat.
export async function saveChat({ session, agency, property = null, name = "", contact = "", messages, status }) {
  const label = property ? String(property.title).slice(0, 120) : "Consulta general";
  try {
    if (isDemo) {
      const all = demoLeads();
      const i = all.findIndex((l) => l.session_id === session);
      const message = messages.find((m) => m.role === "user")?.text.slice(0, 1000) ?? "";
      const row = {
        session_id: session, property_id: property?.id ?? null, property_label: label, kind: "chat",
        name: name.slice(0, 80), contact: contact.slice(0, 120), message, messages, status,
      };
      if (i >= 0) all[i] = { ...all[i], ...row };
      else all.unshift({ ...row, id: newId(), created_at: new Date().toISOString() });
      write(LS.leads, all.slice(0, 500));
      return;
    }
    must(await (await sb()).rpc("save_chat", {
      p_session: session, p_agency: agency?.id ?? null, p_property_id: property?.id ?? null, p_label: label,
      p_name: name.slice(0, 80), p_contact: contact.slice(0, 120), p_messages: messages, p_status: status,
    }));
  } catch (e) {
    console.warn("No se pudo guardar el chat", e);
  }
}

export async function listLeads(limit = 200) {
  if (isDemo) return demoLeads().slice(0, limit);
  return must(await (await sb()).from("leads").select("*").eq("agency_id", agencyId()).order("created_at", { ascending: false }).limit(limit));
}

export async function updateLead(id, patch) {
  if (isDemo) return write(LS.leads, demoLeads().map((l) => (l.id === id ? { ...l, ...patch } : l)));
  must(await (await sb()).from("leads").update(patch).eq("id", id));
}

export async function deleteLead(id) {
  if (isDemo) return write(LS.leads, demoLeads().filter((l) => l.id !== id));
  must(await (await sb()).from("leads").delete().eq("id", id));
}

// ---------- Equipo y plataforma ----------
const noDemo = () => { throw new Error("No disponible en modo demo."); };

export async function listMembers(agency) {
  if (isDemo) return [{ user_id: "demo", email: "admin", role: "owner" }];
  return must(await (await sb()).rpc("list_members", { p_agency: agency }));
}
export async function addMember(agency, email, role = "owner") {
  if (isDemo) return noDemo();
  must(await (await sb()).rpc("add_member", { p_agency: agency, p_email: email, p_role: role }));
}
export async function removeMember(agency, user) {
  if (isDemo) return noDemo();
  must(await (await sb()).rpc("remove_member", { p_agency: agency, p_user: user }));
}
// Número de WhatsApp conectado de una inmobiliaria (o null). El administrador ve todos si no se indica.
export async function getWhatsapp(agency) {
  if (isDemo) return null;
  return must(await (await sb()).from("agency_whatsapp").select("agency_id,phone_number_id,display_phone").eq("agency_id", agency).maybeSingle());
}
export async function listWhatsapp() {
  if (isDemo) return [];
  return must(await (await sb()).from("agency_whatsapp").select("agency_id,phone_number_id,display_phone"));
}
// Conecta el número (o lo desconecta si phoneNumberId viene vacío). Solo el administrador de la plataforma.
export async function setWhatsapp(agency, phoneNumberId, display = "") {
  if (isDemo) return noDemo();
  must(await (await sb()).rpc("admin_set_whatsapp", { p_agency: agency, p_phone_number_id: phoneNumberId, p_display: display }));
}

export async function listAgencies() {
  if (isDemo) return [demoAgency()];
  return must(await (await sb()).from("agencies").select(AGENCY_COLS).order("created_at", { ascending: true }));
}
export async function createAgency({ slug, name, whatsapp = "", country = "", city = "" }) {
  if (isDemo) return noDemo();
  return must(await (await sb()).rpc("admin_create_agency", {
    p_slug: slug, p_name: name, p_whatsapp: whatsapp, p_country: country, p_city: city,
  }));
}

// ---------- CRM: contactos, operaciones (pipeline), llamadas, visitas ----------
const PHONE = (n) => `59899${String(100000 + n * 7919).slice(0, 6)}`;
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SEEDS = {
  contacts: () => [
    ["Valentina Rossi", "comprador"], ["Martín Pereira", "comprador"], ["Lucía Fernández", "vendedor"],
    ["Diego Álvarez", "comprador"], ["Camila Suárez", "inquilino"], ["Joaquín Techera", "comprador"],
    ["Sofía Ibarra", "propietario"], ["Andrés Cabrera", "comprador"],
  ].map(([name, role], i) => ({
    name, role, phone: PHONE(i + 1), email: `${slug(name.split(" ")[0])}@correo.com`,
    notes: "", created_at: ago((i + 1) * 3 * DAY),
  })),
  deals: () => {
    const now = new Date();
    // Cierres siempre dentro del mes en curso (día 1 como mínimo, hoy como máximo).
    const day = (k) => new Date(now.getFullYear(), now.getMonth(), Math.max(1, Math.min(now.getDate(), 1 + k * 2)), 11).toISOString();
    const d = (title, contact_name, stage, value, extra = {}) => ({
      title, contact_name, property_label: title, stage, value, commission_pct: 3,
      stage_at: ago(2 * HOUR), closed_at: null, created_at: ago(9 * DAY), ...extra,
    });
    return [
      d("Casa en Carrasco", "Valentina Rossi", "cerrado", 150000, { closed_at: day(0), stage_at: day(0) }),
      d("Apartamento en Pocitos", "Martín Pereira", "cerrado", 180000, { closed_at: day(1), stage_at: day(1) }),
      d("PH en Malvín", "Lucía Fernández", "cerrado", 210000, { closed_at: day(2), stage_at: day(2) }),
      d("Casa en Cordón", "Diego Álvarez", "cerrado", 240000, { closed_at: day(3), stage_at: day(3) }),
      d("Monoambiente en Centro", "Camila Suárez", "cerrado", 95000, { closed_at: day(4), stage_at: day(4) }),
      d("Casa en Punta Carretas", "Joaquín Techera", "sena", 172000, { stage_at: ago(1 * HOUR) }),
      d("Apartamento con vista al mar", "Sofía Ibarra", "negociacion", 168000, { stage_at: ago(5 * HOUR) }),
      d("Terreno en Laguna del Sauce", "Andrés Cabrera", "negociacion", 96000, { stage_at: ago(20 * HOUR) }),
      d("Casa con jardín y parrillero", "Valentina Rossi", "visita", 285000, { stage_at: ago(30 * HOUR) }),
      d("Local en Tres Cruces", "Martín Pereira", "perdido", 120000, { stage_at: ago(2 * HOUR), created_at: ago(15 * DAY) }),
      d("Apartamento luminoso", "Lucía Fernández", "consulta", 90000, { stage_at: ago(3 * HOUR), created_at: ago(1 * DAY) }),
    ];
  },
  calls: () => [
    ["Valentina Rossi", "saliente", "contestó", "Confirmamos visita del sábado."],
    ["Rodrigo Silva", "entrante", "contestó", "Consulta por casa en Carrasco."],
    ["Martín Pereira", "saliente", "no contestó", "Dejé mensaje de voz."],
    ["Sofía Ibarra", "saliente", "contestó", "Quiere bajar el precio a US$ 160.000."],
    ["Diego Álvarez", "entrante", "contestó", "Pide firmar el boleto de reserva."],
  ].map(([contact_name, direction, outcome, notes], i) => ({
    contact_name, phone: PHONE(i + 11), direction, outcome, notes, created_at: ago((i * 3.5 + 1) * HOUR),
  })),
  visits: () => {
    // Visitas de las últimas 4 semanas, con más demanda a fin de semana y por la tarde.
    const slotW = [1, 2, 1.5, 3, 4, 2];
    const dayW = [1, 1, 1.2, 1.6, 2, 1.8, 0.6]; // lun..dom
    let x = 7;
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    const labels = SAMPLE.map((p) => p.title);
    const names = ["Valentina Rossi", "Martín Pereira", "Lucía Fernández", "Diego Álvarez", "Camila Suárez"];
    const rows = [];
    for (let back = 28; back >= -3; back--) {
      const base = new Date(Date.now() - back * DAY);
      const wd = (base.getDay() + 6) % 7;
      slotW.forEach((w, s) => {
        const n = Math.round(rnd() * w * dayW[wd]);
        for (let k = 0; k < n; k++) {
          const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9 + s * 2, Math.floor(rnd() * 100));
          const future = at.getTime() > Date.now();
          rows.push({
            property_label: labels[Math.floor(rnd() * labels.length)], contact_name: names[Math.floor(rnd() * names.length)],
            at: at.toISOString(), status: future ? "confirmada" : (rnd() < 0.12 ? "cancelada" : "realizada"),
            created_at: future ? ago(Math.floor(rnd() * 6 * HOUR)) : new Date(at.getTime() - 2 * DAY).toISOString(),
          });
        }
      });
    }
    return rows;
  },
};

// Misma API para demo (localStorage) y Supabase: list / add / update / remove.
export function collection(name) {
  const key = `inmo_demo_${name}_v1`;
  const all = () => {
    let rows = read(key, null);
    if (!rows) {
      rows = (SEEDS[name]?.() ?? []).map((r) => ({ id: newId(), ...r }));
      write(key, rows);
    }
    return rows;
  };
  return {
    async list() {
      if (isDemo) return all().sort((a, b) => b.created_at.localeCompare(a.created_at));
      return must(await (await sb()).from(name).select("*").eq("agency_id", agencyId()).order("created_at", { ascending: false }).limit(1000));
    },
    async add(row) {
      if (isDemo) return write(key, [{ ...row, id: newId(), created_at: new Date().toISOString() }, ...all()]);
      must(await (await sb()).from(name).insert({ ...row, agency_id: agencyId() }));
    },
    async update(id, patch) {
      if (isDemo) return write(key, all().map((r) => (r.id === id ? { ...r, ...patch } : r)));
      must(await (await sb()).from(name).update(patch).eq("id", id));
    },
    async remove(id) {
      if (isDemo) return write(key, all().filter((r) => r.id !== id));
      must(await (await sb()).from(name).delete().eq("id", id));
    },
  };
}

// Borra los datos de la demo en este navegador (no toca ninguna base real).
export function resetDemo() {
  if (!isDemo) return;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("inmo_demo_") && k !== LS.session) localStorage.removeItem(k);
  } catch { /* storage bloqueado */ }
}

// ---------- Auth ----------
export async function isLoggedIn() {
  if (isDemo) return read(LS.session, false) === true;
  return !!must(await (await sb()).auth.getSession()).session;
}

export async function login(email, password) {
  if (isDemo) {
    if (email === "admin" && password === "admin") return write(LS.session, true);
    throw new Error("En modo demo el usuario es admin / admin");
  }
  must(await (await sb()).auth.signInWithPassword({ email, password }));
}

export async function logout() {
  if (isDemo) return write(LS.session, false);
  await (await sb()).auth.signOut();
}
