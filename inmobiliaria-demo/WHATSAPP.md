# Conectar WhatsApp (respuestas automáticas con IA)

El webhook está en `api/whatsapp.js`. Cuando alguien escribe al número de WhatsApp de una inmobiliaria,
Meta avisa a este endpoint, la IA responde con las propiedades de esa inmobiliaria y la conversación
aparece en **Conversaciones** (con la etiqueta "WhatsApp · IA"). Si hace falta una persona, queda en
**Requieren atención**.

## 1. En Meta (una sola vez para toda la plataforma)

1. Entrá a https://developers.facebook.com, **Mis apps > Crear app** (tipo *Empresa / Business*) y agregá el producto **WhatsApp**.
2. En **WhatsApp > API Setup** Meta te da un **número de prueba** gratis. Copiá el **Phone number ID**.
   El número de prueba solo puede escribir a hasta 5 teléfonos que verifiques ahí mismo: alcanza para probar.
3. **App secret:** *Configuración de la app > Básica > Clave secreta de la app*.
4. **Token permanente:** en *Business Settings > Usuarios > Usuarios del sistema* creá uno (rol administrador),
   asignale la app y la cuenta de WhatsApp, y generá un token con los permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
   (Para una prueba rápida sirve el token temporal de 24 h que muestra *API Setup*.)

## 2. En Vercel (proyecto `inmobiliaria-demo` > Settings > Environment Variables)

| Variable | Valor |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | un texto que inventes (lo vas a pegar también en Meta) |
| `WHATSAPP_APP_SECRET` | la clave secreta de la app (paso 1.3) |
| `WHATSAPP_TOKEN` | el token de acceso (paso 1.4) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > clave `service_role` (**secreta**: nunca va en el navegador) |

`ANTHROPIC_API_KEY` ya está cargada. Después de agregar variables hay que **redesplegar**.

## 3. Webhook en Meta

*WhatsApp > Configuration > Webhook*:
- **Callback URL:** `https://inmobiliaria-demo-liart.vercel.app/api/whatsapp`
- **Verify token:** el mismo `WHATSAPP_VERIFY_TOKEN`.
- Tocá **Verify and save** y suscribite al campo **`messages`**.

## 4. Conectar cada inmobiliaria

En el panel, `/admin#/plataforma` > **Conectar WhatsApp de una inmobiliaria**: elegí la inmobiliaria y pegá su
**Phone number ID**. Cada inmobiliaria tiene su propio número; el sistema sabe a cuál pertenece cada mensaje
por ese identificador.

## 5. Probar

Desde un teléfono verificado, escribí al número de prueba. Deberías recibir la respuesta en segundos y ver la
conversación en el panel de esa inmobiliaria.

## Para usarlo en serio

- Cada inmobiliaria necesita su número de WhatsApp Business (que no esté usado en la app de WhatsApp común) y
  la **verificación de negocio** de Meta. Con *Embedded Signup* se puede automatizar el alta de clientes más adelante.
- Meta cobra según su tarifa vigente de WhatsApp Business: revisala antes de ofrecer el servicio.
- Si falla el envío o la IA no está disponible, la conversación queda marcada **Requiere atención** para que
  una persona responda.
