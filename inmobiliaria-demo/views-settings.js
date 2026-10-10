import { getSettings, saveSettings, isDemo, resetDemo, listMembers, addMember, removeMember, getWhatsapp } from "./data.js";
import { session, isOwner } from "./session.js";
import { h, formPanel, demoNotice } from "./ui.js";

export const widgetSnippet = (slug) =>
  `<script src="${new URL("widget.js", location.href).href}" data-agency="${slug}" async></script>`;

// Código para pegar en la web de la inmobiliaria + enlaces al catálogo y al chat de prueba.
export function installPanel(agency) {
  const code = h("code", { class: "code" }, widgetSnippet(agency.slug));
  const copied = h("span", { class: "ok" });
  const copy = h("button", { class: "btn ghost", type: "button", onclick: async () => {
    try { await navigator.clipboard.writeText(widgetSnippet(agency.slug)); copied.textContent = "Copiado."; }
    catch { copied.textContent = "Seleccioná el código y copialo con Ctrl+C."; }
  } }, "Copiar código");
  const catalog = new URL(`./?agency=${encodeURIComponent(agency.slug)}`, location.href).href;
  const chat = new URL(`chat?agency=${encodeURIComponent(agency.slug)}`, location.href).href;
  return h("div", { class: "card-box" },
    h("h3", { class: "sec" }, "Chat para tu página web"),
    h("p", { class: "muted" }, "Pegá esta línea antes de </body> en tu sitio (WordPress, Wix, a medida…). Aparece un botón de chat que responde con IA usando tus propiedades."),
    code,
    h("div", { class: "actions" }, copy, copied),
    h("p", { class: "muted" },
      "Catálogo público: ", h("a", { href: catalog, target: "_blank", rel: "noopener" }, catalog),
      h("br"), "Probar el chat: ", h("a", { href: chat, target: "_blank", rel: "noopener" }, chat)));
}

// Estado del WhatsApp automático (el número lo conecta el administrador de la plataforma).
async function whatsappPanel(agency) {
  const wa = await getWhatsapp(agency.id);
  return h("div", { class: "card-box" },
    h("h3", { class: "sec" }, "WhatsApp automático"),
    wa
      ? h("p", {}, h("span", { class: "badge disponible" }, "conectado"), ` ${wa.display_phone || "Número conectado"}. La IA responde al instante a los mensajes que reciba ese número; si hace falta una persona, la conversación queda en "Requieren atención".`)
      : h("p", { class: "muted" }, h("span", { class: "badge" }, "no conectado"), " Cuando se conecte el número de WhatsApp de la inmobiliaria, la IA va a responder ahí los mensajes automáticamente. Pedíselo al administrador de la plataforma."));
}

async function teamPanel(root) {
  const agency = session.agency;
  const members = await listMembers(agency.id);
  const msg = h("p", { class: "msg" });
  const email = h("input", { type: "email", placeholder: "email@ejemplo.com", required: true });
  const role = h("select", {}, [["owner", "Dueño"], ["agent", "Agente"]].map(([v, l]) => h("option", { value: v }, l)));
  const again = () => render(root);
  const act = async (fn) => { try { await fn(); again(); } catch (err) { msg.textContent = err.message; } };

  const form = h("form", { class: "form-grid", style: "align-items:end;margin-top:12px" },
    h("div", {}, h("label", {}, "Email del usuario"), email),
    h("div", {}, h("label", {}, "Rol"), role),
    h("button", { class: "btn", type: "submit" }, "Agregar al equipo"));
  form.addEventListener("submit", (e) => { e.preventDefault(); act(() => addMember(agency.id, email.value.trim(), role.value)); });

  return h("div", { class: "card-box" },
    h("h3", { class: "sec" }, "Equipo"),
    h("p", { class: "muted" }, "Los dueños gestionan todo, incluido el equipo; los agentes trabajan con propiedades, consultas y contactos. La persona debe tener su usuario creado (pedíselo al administrador de la plataforma)."),
    h("table", {}, h("tbody", {}, members.map((m) =>
      h("tr", {}, h("td", {}, m.email), h("td", {}, m.role === "owner" ? "Dueño" : "Agente"),
        h("td", {}, h("button", { class: "btn danger", title: "Quitar", onclick: () => {
          if (confirm(`¿Quitar a ${m.email} del equipo?`)) act(() => removeMember(agency.id, m.user_id));
        } }, "×")))))),
    form, msg);
}

export async function render(root) {
  const s = await getSettings();
  const ok = h("p", { class: "ok" });
  const canEdit = isDemo || isOwner();
  const form = canEdit
    ? formPanel({
        title: "Inmobiliaria y metas del mes",
        submitLabel: "Guardar configuración",
        fields: [
          { key: "business_name", label: "Nombre de la inmobiliaria", value: s.business_name, required: true },
          { key: "whatsapp", label: "WhatsApp (con código de país)", value: s.whatsapp },
          { key: "country", label: "País por defecto", value: s.country },
          { key: "city", label: "Ciudad por defecto", value: s.city },
          { key: "goal_closings", label: "Meta de cierres del mes", type: "number", value: s.goal_closings },
          { key: "goal_listings", label: "Meta de captaciones del mes", type: "number", value: s.goal_listings },
          { key: "goal_commission", label: "Meta de comisión (US$)", type: "number", value: s.goal_commission },
        ],
        onSubmit: async (v) => {
          await saveSettings(v);
          ok.textContent = "Guardado.";
          document.getElementById("brand-name")?.replaceChildren(v.business_name);
        },
      })
    : h("div", { class: "card-box" }, h("p", { class: "muted" }, "Solo los dueños de la inmobiliaria pueden cambiar la configuración."));

  root.replaceChildren(
    h("div", { class: "page-head" }, h("h1", {}, "Configuración")),
    demoNotice(isDemo), form, ok,
    installPanel(session.agency),
    !isDemo ? await whatsappPanel(session.agency) : null,
    !isDemo && isOwner() ? await teamPanel(root) : null,
    isDemo
      ? h("div", { class: "card-box" },
          h("h3", { class: "sec" }, "Datos de demostración"),
          h("p", { class: "muted" }, "Vuelve todo al estado inicial de la demo (propiedades, consultas, pipeline, etc.) en este navegador."),
          h("button", { class: "btn danger", onclick: () => {
            if (!confirm("¿Restablecer los datos de la demo?")) return;
            resetDemo();
            location.reload();
          } }, "Restablecer demo"))
      : null);
}
