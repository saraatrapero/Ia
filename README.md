# TRAPERO AI

Centro de operaciones de inteligencia artificial privado para el equipo: **GPT + Claude + Gemini** en una sola plataforma, con control de acceso, consumo y seguridad.

## Primera entrega: qué incluye

| Área | Estado |
|---|---|
| Interfaz y panel de operaciones | ✅ Panel con gasto, peticiones, estado de proveedores, consumo por modelo y conversaciones recientes |
| Acceso privado y gestión de usuarios | ✅ Sin registro público; el administrador crea cuentas, roles (Miembro / Responsable / Administrador), departamentos y presupuestos |
| Conexión real con los tres proveedores | ✅ SDK oficiales de OpenAI, Anthropic y Google, con respuesta en streaming |
| Selector de modelo automático y manual | ✅ Reglas explicables (código, análisis, redacción, documentos largos, consultas breves) + respaldo automático a otro proveedor si uno falla |
| Chat con historial persistente | ✅ Conversaciones guardadas, buscables, renombrables y eliminables |
| Adjuntar documentos y analizarlos | ✅ PDF, Word, Excel, CSV, TXT, Markdown y JSON (arrastrar y soltar) |
| Generación y descarga de archivos | ✅ Cualquier respuesta a Word, Excel (tablas), Markdown, HTML o texto; cada bloque de código como archivo |
| Registro de consumo por modelo | ✅ Tokens, coste, latencia y errores por modelo, usuario y día; proyección mensual |
| Estructura para agentes y programación | ✅ Agentes, niveles de permiso, herramientas y programaciones cron (ejecución **desactivada**) |
| Seguridad y permisos | ✅ Matriz de permisos, políticas configurables, auditoría, sesiones revocables |

> **Agentes:** en esta fase no hay agentes con permisos ilimitados sobre sistemas reales. Se pueden definir y programar, pero el ejecutor (`src/lib/agents/registry.ts`) bloquea toda ejecución y el nivel «Ejecución» está deshabilitado.

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env        # y edítalo (ver abajo)
npm run setup               # crea la base de datos, el catálogo de modelos y el administrador
npm run dev                 # http://localhost:3000
```

Variables principales de `.env`:

| Variable | Descripción |
|---|---|
| `AUTH_SECRET` | Secreto para firmar sesiones. Genera uno con `openssl rand -base64 48` |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Administrador inicial (solo se usa en `npm run setup`) |
| `OPENAI_API_KEY` | Clave de OpenAI (GPT) |
| `ANTHROPIC_API_KEY` | Clave de Anthropic (Claude) |
| `GEMINI_API_KEY` | Clave de Google AI Studio (Gemini) |
| `DATABASE_URL` | SQLite en desarrollo (`file:./trapero.db`) |
| `STORAGE_DIR` | Carpeta donde se guardan documentos y archivos generados |

Un proveedor sin clave simplemente no aparece en el selector. El panel muestra qué proveedores están conectados.

## Producción

1. En `prisma/schema.prisma` cambia `provider = "sqlite"` por `"postgresql"` y apunta `DATABASE_URL` a tu base de datos.
2. `npm run build && npm run setup && npm start` detrás de HTTPS (la cookie de sesión es `Secure` en producción).
3. `STORAGE_DIR` debe estar en un disco persistente con copias de seguridad.
4. El limitador de peticiones es en memoria; con varias instancias, sustitúyelo por Redis (`src/lib/rate-limit.ts`).

## Modelos

El catálogo inicial está en `src/lib/ai/catalog.ts` y después se gestiona desde **Administración → Modelos y proveedores**: activar o desactivar modelos, cambiar el identificador de API, precios por millón de tokens y rol mínimo para usarlos.

| Proveedor | Avanzado | Equilibrado | Rápido |
|---|---|---|---|
| Anthropic | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Haiku 5.5 |
| OpenAI | GPT-6.2 Sol | — | GPT-5.4 mini |
| Google | Gemini 3.1 Pro | — | Gemini 3.8 Flash |

Los precios de Anthropic son tarifas oficiales; **los de OpenAI y Google son orientativos y deben revisarse** en la web de cada proveedor, igual que los identificadores de modelo de esos dos proveedores.

Los modelos de Claude Opus y Sonnet llevan activado el respaldo en servidor de Anthropic (`fallbacks: "default"`): si el modelo declina una petición por sus políticas, Anthropic la reintenta con otro modelo dentro de la misma llamada.

## Seguridad

- Contraseñas con bcrypt (coste 12) y cambio obligatorio en el primer acceso.
- Sesiones firmadas (JWT HS256) respaldadas en base de datos: caducan, se pueden revocar y se invalidan al desactivar un usuario.
- Bloqueo temporal tras varios intentos fallidos.
- Las claves de los proveedores solo existen en el servidor.
- Protección CSRF por origen en la API, cabeceras de seguridad (HSTS, `X-Frame-Options`, etc.).
- Aislamiento por usuario: cada persona solo ve sus conversaciones y archivos.
- Presupuestos mensuales por usuario y global, y límite de peticiones por minuto.
- Registro de auditoría de accesos, cambios de usuarios, modelos, políticas y archivos.

## Estructura

```
prisma/schema.prisma          Modelo de datos
prisma/seed.ts                Catálogo de modelos, administrador y agentes de ejemplo
src/middleware.ts             Protección de rutas y CSRF
src/lib/ai/                   Proveedores, selector automático, precios, prompt de sistema
src/lib/auth/                 Sesiones y tokens
src/lib/files/                Extracción de texto, almacenamiento y exportación
src/lib/agents/registry.ts    Niveles de permiso, herramientas y bloqueo de ejecución
src/app/api/                  Chat (streaming), adjuntos, exportación, descargas
src/app/(app)/                Panel, chat, búsqueda, consumo, archivos, agentes, administración
```

## Próximos pasos propuestos

- Imágenes y PDF escaneados (visión de los modelos).
- Búsqueda web y citas de fuentes.
- Activación controlada de agentes de solo lectura con revisión humana.
- Inicio de sesión con Microsoft o Google (SSO) y doble factor.
