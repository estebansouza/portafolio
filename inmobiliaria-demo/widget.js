/* Widget de chat para la web de una inmobiliaria. Instalación (una línea, antes de </body>):
 *   <script src="https://TU-SITIO/widget.js" data-agency="mi-inmobiliaria" async></script>
 * Opciones: data-color="#1f5a43"  data-label="Consultanos"  data-position="left" | "right"
 * El chat corre en un iframe de nuestro dominio, así no choca con los estilos ni los scripts de la web. */
(function () {
  var script = document.currentScript;
  if (!script || !script.dataset.agency) { console.warn("[widget] falta data-agency"); return; }
  if (document.getElementById("inmo-widget")) return;

  var base = script.src.replace(/[^/]*$/, ""); // carpeta desde donde se sirve widget.js
  var color = /^#[0-9a-fA-F]{3,8}$/.test(script.dataset.color || "") ? script.dataset.color : "#1f5a43";
  var label = script.dataset.label || "Consultanos";
  var side = script.dataset.position === "left" ? "left" : "right";

  var root = document.createElement("div");
  root.id = "inmo-widget";
  root.style.cssText = "position:fixed;bottom:16px;" + side + ":16px;z-index:2147483000;font-family:system-ui,sans-serif";

  var frame = document.createElement("iframe");
  frame.title = "Chat con la inmobiliaria";
  frame.src = base + "chat?agency=" + encodeURIComponent(script.dataset.agency);
  frame.loading = "lazy";
  frame.style.cssText = "display:none;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 96px));" +
    "border:0;border-radius:14px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);margin-bottom:12px";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "💬 " + label;
  btn.style.cssText = "display:block;margin-" + (side === "left" ? "right" : "left") + ":auto;padding:12px 18px;border:0;" +
    "border-radius:999px;background:" + color + ";color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer;" +
    "box-shadow:0 6px 20px rgba(0,0,0,.25)";

  btn.addEventListener("click", function () {
    var open = frame.style.display === "none";
    frame.style.display = open ? "block" : "none";
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "✕ Cerrar" : "💬 " + label;
  });

  root.appendChild(frame);
  root.appendChild(btn);
  document.body.appendChild(root);
})();
