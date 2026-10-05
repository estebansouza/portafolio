// Agregá tus proyectos acá: se muestran solos en la sección "Proyectos".
const projects = [
  {
    title: "Gestor de turnos para barbería",
    description: "Los clientes reservan online eligiendo servicio, barbero y horario libre. El dueño ve y cancela turnos desde un panel con login.",
    tags: "Supabase · Vercel · JavaScript",
    url: "https://barberia-turnos-sigma.vercel.app"
  },
  {
    title: "Stock y cotizador para automotoras",
    description: "Catálogo online con filtros y fotos, cotizador de cuotas que se envía por WhatsApp y un panel con login para cargar y administrar el stock.",
    tags: "Supabase · Vercel · JavaScript",
    url: "https://automotora-stock.vercel.app"
  },
  {
    title: "Web para negocio local",
    description: "Sitio de ejemplo con servicios, ubicación y botón de WhatsApp.",
    tags: "HTML · CSS · JS",
    url: ""
  }
];

const container = document.getElementById("projects");
for (const p of projects) {
  const card = document.createElement("article");
  card.className = "card";
  const h = document.createElement("h3");
  h.textContent = p.title;
  const d = document.createElement("p");
  d.textContent = p.description;
  const t = document.createElement("span");
  t.className = "tag";
  t.textContent = p.tags;
  card.append(h, d, t);
  if (p.url) {
    const a = document.createElement("a");
    a.className = "link";
    a.href = p.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Ver proyecto →";
    card.append(a);
  }
  container.append(card);
}

document.getElementById("year").textContent = new Date().getFullYear();
