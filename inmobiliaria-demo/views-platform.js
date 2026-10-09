// Panel interno del administrador de la plataforma: alta de inmobiliarias y de sus dueños.
import { listAgencies, createAgency, addMember } from "./data.js";
import { widgetSnippet } from "./views-settings.js";
import { h, formPanel } from "./ui.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export async function render(root) {
  const agencies = await listAgencies();
  const again = () => render(root);

  const newAgency = formPanel({
    title: "Nueva inmobiliaria",
    submitLabel: "Crear inmobiliaria",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "slug", label: "Identificador (a-z, 0-9 y guiones)", required: true },
      { key: "whatsapp", label: "WhatsApp con código de país" },
      { key: "country", label: "País" },
      { key: "city", label: "Ciudad" },
    ],
    onSubmit: async (v) => {
      v.slug = v.slug.toLowerCase();
      if (!SLUG_RE.test(v.slug)) throw new Error("El identificador debe tener 3 a 40 caracteres: letras, números y guiones.");
      await createAgency(v);
      again();
    },
  });

  const addOwner = formPanel({
    title: "Agregar usuario a una inmobiliaria",
    submitLabel: "Agregar",
    fields: [
      { key: "agency", label: "Inmobiliaria", options: agencies.map((a) => [a.id, `${a.name} (${a.slug})`]) },
      { key: "email", label: "Email del usuario", type: "email", required: true },
      { key: "role", label: "Rol", options: [["owner", "Dueño"], ["agent", "Agente"]] },
    ],
    onSubmit: async (v) => {
      await addMember(v.agency, v.email, v.role);
      alert("Usuario agregado.");
    },
  });

  root.replaceChildren(
    h("div", { class: "page-head" }, h("h1", {}, "Plataforma")),
    h("div", { class: "card-box" },
      h("h3", { class: "sec" }, `Inmobiliarias (${agencies.length})`),
      h("table", {}, h("thead", {}, h("tr", {}, ["Nombre", "Identificador", "Ciudad", "Catálogo"].map((t) => h("th", {}, t)))),
        h("tbody", {}, agencies.map((a) => h("tr", {},
          h("td", {}, a.name), h("td", {}, a.slug), h("td", {}, [a.city, a.country].filter(Boolean).join(", ")),
          h("td", {}, h("a", { href: `./?agency=${encodeURIComponent(a.slug)}`, target: "_blank", rel: "noopener" }, "Ver"))))))),
    h("div", { class: "card-box" },
      h("h3", { class: "sec" }, "Cómo dar de alta a un cliente"),
      h("ol", { class: "muted" },
        h("li", {}, "Creá la inmobiliaria acá abajo."),
        h("li", {}, "En Supabase, Authentication > Users, creá el usuario del dueño (Add user, con Auto Confirm)."),
        h("li", {}, "Agregalo a la inmobiliaria por su email."),
        h("li", {}, "En Configuración de esa inmobiliaria está el código del chat para pegar en su web."))),
    newAgency, addOwner,
    agencies[0]
      ? h("div", { class: "card-box" },
          h("h3", { class: "sec" }, "Ejemplo de código del widget"),
          h("code", { class: "code" }, widgetSnippet(agencies[0].slug)))
      : null);
}
