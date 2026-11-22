# Puesta en producción paso a paso (coste 0, solo navegador)

Tiempo estimado: **10-15 minutos**. No hace falta instalar nada en tu ordenador.

Al terminar tendrás TRAPERO AI funcionando en una dirección `https://….vercel.app` con:
- **Vercel** (gratis): aloja la aplicación.
- **Supabase** (gratis): base de datos y archivos. **Vercel lo crea y lo conecta solo.**
- **Gemini** (gratis), y opcionalmente **Groq** y **OpenRouter** (gratis): modelos de IA.

> ⚠ **Antes de empezar:** el plan gratuito de Vercel es para uso personal no comercial, y los niveles gratuitos de Gemini y OpenRouter pueden usar o registrar lo que les envías. No envíes datos personales ni confidenciales a los modelos gratuitos. Más detalle en `AUDITORIA.md`.

El código ya está en la rama `main` del repositorio: no tienes que hacer nada en GitHub.

## Camino rápido (recomendado)

### 1. Clave gratuita de Gemini (2 minutos)

1. Abre **https://aistudio.google.com/apikey** e inicia sesión con tu cuenta de Google.
2. Pulsa **Create API key** y cópiala.

(Opcional, para tener más modelos gratis: **https://console.groq.com/keys** → *Create API Key*, y **https://openrouter.ai/settings/keys** → *Create API Key*.)

### 2. Publicar en Vercel (5 minutos)

1. Abre **https://vercel.com/signup** → **Continue with GitHub** → plan **Hobby**.
2. **Add New… → Project** → junto a `ia` pulsa **Import**. (Si no aparece: *Adjust GitHub App Permissions* y da acceso al repositorio `ia`.)
3. Abre **Environment Variables** y añade:

   | Key | Value |
   |---|---|
   | `SETUP_CODE` | Un código que inventes, de al menos 12 caracteres. Te lo pedirá la web para crear tu cuenta |
   | `GEMINI_API_KEY` | La clave del paso 1 |
   | `GROQ_API_KEY` | (opcional) |
   | `OPENROUTER_API_KEY` | (opcional) |

4. Pulsa **Deploy**. Tarda 2-3 minutos.
5. ✅ Al abrir la web verás **«Configuración pendiente»** pidiendo la base de datos. Es lo esperado.

### 3. Conectar Supabase desde Vercel (3 minutos)

1. En tu proyecto de Vercel, pestaña **Storage** → **Create Database** → elige **Supabase** → **Continue**.
2. Acepta las condiciones, elige una región de Europa (por ejemplo *Frankfurt*) y el plan **Free** → **Create**.
3. En la pantalla de conexión deja marcados todos los entornos y pulsa **Connect**.
4. Pestaña **Deployments** → en el primero, **⋯ → Redeploy** → **Redeploy**.

Vercel añade solas todas las variables de Supabase. TRAPERO AI las usa para la base de datos, los archivos y para firmar las sesiones: no tienes que copiar nada.

### 4. Crear tu cuenta y comprobar

1. Abre la dirección de tu proyecto. Aparecerá **Instalación de TRAPERO AI**.
2. Escribe tu `SETUP_CODE`, tu nombre, tu correo y una contraseña (mínimo 10 caracteres con letras y números) → **Crear administrador**.
3. **Modelos y proveedores** → **Comprobar ahora**. Si algún modelo aparece con ✗, cambia su **ID en la API** por uno de la lista del proveedor y pulsa **Guardar**.
4. **Nueva conversación** → «Hola» → responde un modelo con la etiqueta «gratis».
5. Adjunta un documento pequeño y pregunta por él (confirma que los archivos se guardan).
6. **Consumo y costes**: 0,00 $.

Si algo falla, la propia web te dirá qué falta; si no, anota el mensaje exacto.

---

## Alternativa: usar tu cuenta de Supabase existente

Si prefieres no crear Supabase desde Vercel, sigue estos pasos en lugar del paso 3 anterior.

### A. Supabase: base de datos

1. Entra en **https://supabase.com/dashboard** → **New project**.
2. Rellena:
   - *Name:* `trapero-ai`
   - *Database Password:* pulsa **Generate a password** y **cópiala en tu nota**.
   - *Region:* una de Europa (por ejemplo *Central EU (Frankfurt)*) — recomendable por RGPD.
3. Pulsa **Create new project** y espera 1-2 minutos.
4. Arriba pulsa **Connect**. En la pestaña de cadenas de conexión (*Connection String*):
   - Copia la de **Transaction pooler** (contiene `:6543`). Sustituye `[YOUR-PASSWORD]` por tu contraseña y añade al final `?pgbouncer=true&connection_limit=1`. Esta es tu **DATABASE_URL**.
   - Copia la de **Session pooler** (contiene `:5432`), sustituye `[YOUR-PASSWORD]`. Esta es tu **DIRECT_URL**.
5. ✅ Comprobación: ambas empiezan por `postgresql://postgres.` y contienen `pooler.supabase.com`.

### B. Supabase: claves para los archivos

1. En el menú izquierdo: **Project Settings** (rueda dentada) → **Data API** (o **API**): copia la **Project URL** (`https://xxxx.supabase.co`) → es tu **SUPABASE_URL**.
2. **Project Settings → API Keys**: abre la pestaña **Legacy API Keys** y copia la clave **service_role** (pulsa *Reveal*) → es tu **SUPABASE_SERVICE_ROLE_KEY**.
   - Esta clave da acceso total a tu proyecto: no la compartas ni la pegues en ningún otro sitio.
3. No hace falta crear el «bucket» de archivos: TRAPERO AI lo crea solo (privado) la primera vez que subas un documento.

### C. Variables en Vercel

1. Entra en **https://vercel.com/signup** → **Continue with GitHub** (plan **Hobby**).
2. **Add New… → Project** → busca `ia` → **Import**. Si no aparece, pulsa *Adjust GitHub App Permissions* y da acceso al repositorio.
3. Despliega **Environment Variables** y pega este bloque (Vercel permite pegarlo entero en el primer campo) sustituyendo cada valor por el de tu nota:

   ```
   DATABASE_URL=postgresql://postgres.xxxx:CONTRASEÑA@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   DIRECT_URL=postgresql://postgres.xxxx:CONTRASEÑA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   STORAGE_DRIVER=supabase
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
   SUPABASE_BUCKET=trapero-files
   AUTH_SECRET=tu-secreto-de-40-caracteres
   SETUP_CODE=tu-codigo-de-instalacion
   GEMINI_API_KEY=tu-clave-de-gemini
   GROQ_API_KEY=tu-clave-de-groq
   OPENROUTER_API_KEY=tu-clave-de-openrouter
   ```

   Si no tienes alguna clave de IA, borra esa línea.
4. Pulsa **Deploy** y espera 2-4 minutos. Durante la compilación se crean las tablas en Supabase.
5. ✅ Comprobación: aparece «Congratulations!» con una vista previa. Si sale un error, abre **Build Logs** y copia las últimas líneas para revisarlas.

Después continúa con el paso 4 del camino rápido. `AUTH_SECRET` es opcional: si no lo pones se deriva de la clave de Supabase.

## Invitar al equipo

**Usuarios y roles** → **Añadir usuario**. Se genera una contraseña temporal que debes enviar por un canal seguro; la persona deberá cambiarla en su primer acceso.

## Mantenimiento

- **Supabase gratuito se pausa tras 7 días sin uso.** Si la web da error de base de datos, entra en Supabase y pulsa **Restore project**.
- **Cada cambio que se fusione en `main` se publica solo** en Vercel.
- Para usar GPT o Claude oficiales (de pago): añade `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` en Vercel (*Settings → Environment Variables*), vuelve a desplegar (*Deployments → ⋯ → Redeploy*) y cambia el **Modo de coste** en *Seguridad y auditoría*. Fija antes un presupuesto mensual.

## Credenciales y servicios necesarios

| Servicio | Para qué | Coste | Obligatorio |
|---|---|---|---|
| GitHub | Código | Gratis | Sí |
| Vercel (Hobby) | Alojar la web | Gratis | Sí |
| Supabase (Free) | Base de datos y archivos | Gratis | Sí |
| Google AI Studio | Gemini | Gratis con límites | Al menos un proveedor |
| Groq | GPT-OSS y Llama | Gratis con límites | Recomendado |
| OpenRouter | Modelos `:free` | Gratis con límites | Recomendado |
| OpenAI / Anthropic | GPT y Claude oficiales | De pago | No |
