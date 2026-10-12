# Alta de una inmobiliaria cliente

Guía para dar de alta a un cliente nuevo y checklist antes de mostrar el producto.

## 1. Antes de la reunión (checklist de demo)

- [ ] Entro al panel con mi usuario (`/admin`) y veo Nexo con su dashboard.
- [ ] `/demo` carga en escritorio y en celular; el chat se abre y responde con IA (no con el texto de respaldo).
- [ ] La cuenta de Anthropic tiene crédito (si se agota, el chat sigue andando pero con respuestas de reglas).
- [ ] El panel de Supabase del proyecto está activo (los proyectos gratuitos se pausan por inactividad).
- [ ] Tengo el video corto o la demo en vivo lista y el link del catálogo de ejemplo.

## 2. Qué preguntarle al cliente

- Dónde está su web hoy (WordPress, Wix, a medida…) y quién puede pegar un código ahí.
- Cuántas propiedades tienen y dónde están cargadas hoy.
- Quién va a ser el dueño del panel (email) y si habrá agentes.
- Si quieren WhatsApp automático (requiere su número de WhatsApp Business y la verificación de Meta).
- Color de su marca (para el chat) y nombre comercial.

## 3. Alta (en este orden)

1. **Crear la inmobiliaria:** `/admin#/plataforma`, formulario *Nueva inmobiliaria* (nombre, identificador, WhatsApp con código de país, país, ciudad).
2. **Crear el usuario del dueño:** Supabase, *Authentication > Users > Add user* (con *Auto Confirm*).
3. **Agregarlo al equipo:** en Plataforma, *Agregar usuario a una inmobiliaria* (rol Dueño).
4. **Cargar las primeras propiedades (5 a 10):** el administrador de la plataforma no ve los datos de las inmobiliarias, así que para cargarlas hay que agregarse como miembro de esa inmobiliaria, cargar, y después quitarse desde *Configuración > Equipo*. O que las cargue el dueño con vos al lado.
5. **Revisar Configuración:** nombre, WhatsApp, metas del mes.
6. **Instalar el chat en su web:** en *Configuración > Chat para tu página web* copiar el código y pegarlo antes de `</body>`. Agregar `data-color="#..."` con el color de su marca.
7. **Probar en su web:** escribir una consulta, comprobar que responde con sus propiedades y que aparece en *Conversaciones*. Probar "quiero visitar…": debe quedar en *Requieren atención*.
8. **Capacitar al dueño (15 minutos):** Conversaciones (responder desde WhatsApp o email, marcar respondida), Propiedades, Pipeline.
9. **Seguimiento:** a la semana, revisar con el cliente cuántas consultas entraron y cuántas pidieron visita.

## 4. Para cobrar a clientes

- Pasar Vercel y Supabase a planes de pago (los gratuitos no permiten uso comercial y se pausan por inactividad). Revisar los términos vigentes.
- Dejar por escrito: los datos son del cliente, las conversaciones se guardan, la IA puede equivocarse y siempre deriva a una persona cuando no sabe.
- Definir quién da soporte y en qué horario.
