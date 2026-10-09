import { getSettings, saveSettings, isDemo, resetDemo } from "./data.js";
import { h, formPanel, demoNotice } from "./ui.js";

export async function render(root) {
  const s = await getSettings();
  const ok = h("p", { class: "ok" });
  const form = formPanel({
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
      document.getElementById("brand").textContent = v.business_name;
    },
  });
  root.replaceChildren(
    h("div", { class: "page-head" }, h("h1", {}, "Configuración")),
    demoNotice(isDemo), form, ok,
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
