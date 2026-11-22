# Puesta en producción paso a paso (coste 0, solo navegador)

Tiempo estimado: 30-40 minutos. No hace falta instalar nada en tu ordenador.

Al terminar tendrás TRAPERO AI funcionando en una dirección `https://….vercel.app` con:
- **Vercel** (gratis): aloja la aplicación.
- **Supabase** (gratis): base de datos y archivos.
- **Gemini, Groq y OpenRouter** (gratis): modelos de IA.

> ⚠ **Antes de empezar, lee esto:** el plan gratuito de Vercel es para uso personal no comercial, y los niveles gratuitos de Gemini y OpenRouter pueden usar o registrar lo que les envías. No envíes datos personales ni confidenciales a los modelos gratuitos. Más detalle en `AUDITORIA.md`.

Durante el proceso irás copiando valores. Ábrete una nota de texto para pegarlos ahí temporalmente y **bórrala al final**: son secretos.

---

## Paso 0 — Pasar el código a la rama principal

El código está en la rama `claude/cool-mccarthy-7zyt0v`. Vercel publica la rama `main`.

1. Abre **https://github.com/saraatrapero/ia**.
2. Si aparece un aviso amarillo con el botón **Compare & pull request**, púlsalo. Si no aparece: pestaña **Pull requests** → **New pull request** → en *compare* elige `claude/cool-mccarthy-7zyt0v`.
3. Pulsa **Create pull request** y después **Merge pull request** → **Confirm merge**.
4. ✅ Comprobación: en la página principal del repositorio ves las carpetas `src`, `prisma` y `docs`.

## Paso 1 — Supabase: base de datos

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

## Paso 2 — Supabase: claves para los archivos

1. En el menú izquierdo: **Project Settings** (rueda dentada) → **Data API** (o **API**): copia la **Project URL** (`https://xxxx.supabase.co`) → es tu **SUPABASE_URL**.
2. **Project Settings → API Keys**: abre la pestaña **Legacy API Keys** y copia la clave **service_role** (pulsa *Reveal*) → es tu **SUPABASE_SERVICE_ROLE_KEY**.
   - Esta clave da acceso total a tu proyecto: no la compartas ni la pegues en ningún otro sitio.
3. No hace falta crear el «bucket» de archivos: TRAPERO AI lo crea solo (privado) la primera vez que subas un documento.

## Paso 3 — Claves de IA gratuitas

Consigue al menos una; lo ideal son las tres.

| Proveedor | Página | Qué pulsar | Variable |
|---|---|---|---|
| Google Gemini | https://aistudio.google.com/apikey | **Create API key** | `GEMINI_API_KEY` |
| Groq | https://console.groq.com/keys | **Create API Key** | `GROQ_API_KEY` |
| OpenRouter | https://openrouter.ai/settings/keys | **Create API Key** (sin añadir crédito) | `OPENROUTER_API_KEY` |

✅ Comprobación: tienes en tu nota entre una y tres claves.

## Paso 4 — Dos secretos propios

Inventa (o genera con un gestor de contraseñas) dos textos aleatorios:

- **AUTH_SECRET**: al menos 40 caracteres aleatorios (letras y números). Firma las sesiones.
- **SETUP_CODE**: al menos 12 caracteres. Lo pedirá la página de instalación para crear tu cuenta.

## Paso 5 — Vercel: publicar la aplicación

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

## Paso 6 — Instalación y comprobaciones

1. Abre la dirección de tu proyecto (por ejemplo `https://ia-xxxx.vercel.app`). Te llevará a **Instalación de TRAPERO AI**.
2. Escribe tu `SETUP_CODE`, tu nombre, tu correo y una contraseña (mínimo 10 caracteres con letras y números) → **Crear administrador**.
3. Ve a **Modelos y proveedores** → **Comprobar ahora**:
   - Cada proveedor con clave debe decir «conectado».
   - Si algún modelo aparece con ✗ («no existe»), cambia su **ID en la API** en su ficha por uno de la lista del proveedor y pulsa **Guardar**. (Los modelos gratuitos cambian con frecuencia.)
4. **Nueva conversación** → escribe «Hola» → debe responder un modelo con la etiqueta «gratis».
5. Adjunta un documento pequeño (PDF o Word) y pregunta por él. ✅ Esto confirma que Supabase Storage funciona.
6. Pulsa **Comparar**, haz una pregunta y comprueba que responden varios modelos.
7. En **Consumo y costes** el coste debe ser **0,00 $**.

Si algún paso falla, anota el mensaje exacto que aparece y la hora.

## Paso 7 — Invitar al equipo

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
