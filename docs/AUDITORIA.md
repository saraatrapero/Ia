# Auditoría técnica — TRAPERO AI v1 → v1.1

Fecha: 22/11/2026

## Alcance

- **Auditado:** el código de la v1 en Next.js/TypeScript construido en la primera sesión de trabajo (incluido en este repositorio).
- **No auditado:** `TRAPERO_AI_v1.zip` (backend FastAPI) que menciona el prompt maestro. **No se ha recibido.** Si existe, súbelo al repositorio y se auditará por separado. No se afirma nada sobre su contenido.

## 1. Diagnóstico de la arquitectura v1

| Aspecto | Estado en v1 | Valoración |
|---|---|---|
| Stack | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4 + Prisma | Sólido, un solo servicio |
| Base de datos | SQLite local | ❌ No válido para producción ni para Vercel |
| Archivos | Disco local (`./storage`) | ❌ Vercel no tiene disco permanente: los archivos se perderían |
| Autenticación | bcrypt + sesiones JWT revocables en BD, bloqueo por intentos | ✅ Correcto |
| Permisos | Matriz de roles (Miembro/Responsable/Administrador) | ✅ Correcto |
| Proveedores | OpenAI, Anthropic y Google con SDK oficiales y streaming | ✅ Correcto, pero todos de pago salvo Gemini |
| Selector | Reglas por expresiones regulares, sin tener en cuenta coste ni tamaño de contexto | ⚠ Mejorable |
| Comparador / segunda opinión | No existía | ❌ Requisito del prompt maestro (fase 1) |
| Límite de peticiones | En memoria del proceso | ❌ No funciona con varias instancias/serverless |
| Instalación | Requiere ejecutar `npm run setup` en una terminal | ❌ La usuaria trabaja solo desde el navegador |
| Modo claro/oscuro | Solo oscuro | ❌ Requisito del prompt maestro |
| Inyección de instrucciones | Sin defensas | ⚠ Riesgo con documentos adjuntos |
| Pruebas | Solo pruebas manuales e2e en la sesión | ⚠ Sin pruebas automáticas en el repositorio |

## 2. Errores y riesgos detectados

### Corregidos en v1.1

1. **SQLite → PostgreSQL (Supabase).** Esquema migrado con `directUrl` para el pooler de Supabase.
2. **Almacenamiento local → Supabase Storage** (bucket privado, creado automáticamente). Se mantiene el disco local para desarrollo.
3. **Limitador en memoria → límite calculado en base de datos**, válido en serverless.
4. **Instalación sin terminal:** página `/setup` protegida por `SETUP_CODE` para crear el primer administrador; el catálogo de modelos se crea solo.
5. **Coste 0:** nuevos proveedores con plan gratuito (Groq, OpenRouter) además de Gemini; campo «gratuito» por modelo; **modo de coste** (solo gratuitos / económico / calidad), por defecto «solo gratuitos».
6. **Selector inteligente nuevo:** clasifica la tarea, descarta modelos sin contexto suficiente y puntúa por capacidades, categoría, proveedor y coste. Con pruebas automáticas.
7. **Comparador simultáneo** de 2-3 modelos y **segunda opinión** de otro proveedor.
8. **Comprobación de proveedores:** consulta en vivo qué identificadores de modelo existen (los modelos gratuitos cambian a menudo).
9. **Modo claro y oscuro** (con preferencia del sistema) y paleta de proveedores validada para daltonismo.
10. **Defensa frente a inyección de instrucciones** en documentos (instrucciones de sistema y saneado de etiquetas).
11. **Límite de subida ajustado a 4 MB** por la restricción de 4,5 MB por petición del plan gratuito de Vercel.
12. Errores de interfaz detectados en pruebas: el formulario de acceso se vaciaba tras un error; una conversación nueva enviaba `conversationId: null` y era rechazada; nombres de descarga con caracteres no ASCII sin alternativa; usuario con sesión que volvía a ver el formulario de acceso.

### Pendientes (riesgos conocidos)

| Riesgo | Impacto | Mitigación / fase |
|---|---|---|
| **Privacidad en planes gratuitos:** Google (nivel gratuito de Gemini) y algunos modelos `:free` de OpenRouter pueden usar o registrar las peticiones | Alto para datos personales o confidenciales (RGPD) | Aviso en Administración → Modelos. No enviar datos sensibles a modelos gratuitos. Pasar a modo «económico» con claves de pago para esos casos |
| **Vercel Hobby es solo para uso personal no comercial** | Uso por un equipo de trabajo puede incumplir sus condiciones | Alternativas gratuitas: Netlify o Render. Revisar antes de uso profesional |
| Supabase gratuito pausa el proyecto tras 7 días sin actividad; 500 MB de BD y 1 GB de archivos | Interrupción del servicio | Reactivar desde el panel de Supabase; vigilar uso |
| Límite de 60 s por función en Vercel gratuito | Respuestas muy largas pueden cortarse | Modelos rápidos; respuestas por partes |
| Límites de uso de los planes gratuitos (por minuto y por día) | Errores 429 en uso intensivo | Respaldo automático a otro proveedor |
| Identificadores de modelo de OpenAI, Google, Groq y OpenRouter no verificados con claves reales | Un modelo puede no existir | «Comprobar proveedores» y editar el ID en el panel |
| Sin doble factor | Seguridad de cuentas | Fase 6 |
| Sin copias de seguridad propias | Pérdida de datos | Supabase gratuito no incluye copias descargables: exportación periódica (fase 6) |
| Sin lectura de imágenes, PPTX ni generación de PDF/PPTX | Funcionalidad | Fase 2 |
| Sin memoria semántica (pgvector) | Funcionalidad | Fase 2-4 (Supabase incluye pgvector) |
| Agentes sin ejecución | Funcionalidad (deliberado) | Fases 3-4 con entorno aislado |

## 3. Verificación realizada

- `npm run typecheck`: sin errores.
- `npm test`: 27 pruebas automáticas (selector, exportación, permisos, agentes): todas correctas.
- `npm run build:local`: compilación de producción correcta.
- Prueba de extremo a extremo en navegador (Chromium) contra **PostgreSQL 16 real** y **servidores simulados** de Gemini, Groq, OpenRouter, OpenAI y Anthropic (no había claves reales disponibles): instalación, selector, documentos, segunda opinión, comparación con persistencia, exportación Word/Excel, comprobación de proveedores, coste 0, tema claro, móvil, usuarios, permisos, CSRF y aislamiento de archivos.
- **No verificado:** llamadas reales a las API de los proveedores y Supabase Storage real (no hay acceso de red a esos servicios desde el entorno de desarrollo). Es la primera comprobación a hacer tras el despliegue (ver `DESPLIEGUE.md`, paso 6).

## Actualización — despliegue simplificado

- La aplicación usa automáticamente las variables que crea la integración Supabase-Vercel (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Solo hay que configurar a mano `SETUP_CODE` y una clave de IA.
- `AUTH_SECRET` pasa a ser opcional: si falta, la clave de firma se deriva (SHA-256 con etiqueta propia) de un secreto de servidor de Supabase.
- Si falta configuración, la web lo explica en una pantalla «Configuración pendiente» en lugar de fallar; la compilación funciona aunque aún no haya base de datos.
- Verificado: compilación sin base de datos; pantalla de configuración pendiente; compilación y prueba completa de extremo a extremo usando solo los nombres de variables de la integración (sin `DATABASE_URL` ni `AUTH_SECRET`). No verificado contra Vercel y Supabase reales.
