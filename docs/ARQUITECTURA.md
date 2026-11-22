# Arquitectura de TRAPERO AI

## Decisiones principales (ver justificación en `DECISIONES.md`)

- **Un solo servicio Next.js** (frontend + API) desplegado en Vercel. Coste 0 y sin servidores que «se duermen».
- **PostgreSQL en Supabase** (incluye pgvector para la memoria semántica futura) y **Supabase Storage** para archivos.
- **Proveedores intercambiables** detrás de una interfaz común (`ProviderAdapter`): añadir o cambiar un proveedor no afecta al resto.
- **Python** se incorporará solo donde aporte algo que TypeScript no cubre bien (entorno de ejecución de código y agentes, fases 3-4), como servicio aislado.

## Estructura del proyecto

```
prisma/
  schema.prisma              Modelo de datos (PostgreSQL)
  seed.ts                    Inicialización opcional por terminal
src/
  middleware.ts              Protección de rutas y CSRF
  app/
    setup/                   Instalación inicial (primer administrador)
    login/                   Acceso
    (app)/                   Zona privada
      page.tsx               Panel de operaciones
      chat/                  Asistente (una respuesta / comparar / segunda opinión)
      search/                Búsqueda y análisis
      usage/                 Consumo y costes
      files/                 Archivos
      agents/                Agentes y programación (sin ejecución)
      admin/users|models|security
      settings/              Mi cuenta
    api/
      chat/                  Respuesta en streaming con selector y respaldo
      compare/               Comparación simultánea
      second-opinion/        Revisión por otro modelo
      messages/[id]/select   Elegir variante de comparación
      attachments/           Subida y extracción de documentos
      export/                Generación de archivos
      files/[id]/            Descarga
      conversations/[id]/    Renombrar / eliminar
    actions/                 Acciones de servidor (auth, setup, admin, agentes)
  lib/
    ai/                      Catálogo, proveedores, selector, precios, prompt de sistema
    chat/engine.ts           Motor común: guardas, historial, ejecución y registro de consumo
    auth/                    Sesiones y tokens
    files/                   Extracción, exportación, almacenamiento (local/Supabase)
    agents/registry.ts       Niveles de permiso, herramientas, bloqueo de ejecución
tests/                       Pruebas automáticas (node:test)
docs/                        Documentación
```

## Modelo de datos

### Implementado (v1.1)

| Tabla | Propósito |
|---|---|
| `User`, `Department`, `Session`, `LoginAttempt` | Usuarios, departamentos, sesiones revocables, bloqueo de intentos |
| `AiModel` | Catálogo editable: proveedor, ID de API, categoría, capacidades, precios, contexto, **gratuito**, visión, rol mínimo |
| `Conversation`, `Message` | Conversaciones; los mensajes guardan modelo, motivo del selector, tokens, coste, **tipo** (respuesta/comparación/revisión), **grupo de variantes** y **variante elegida** |
| `Attachment`, `GeneratedFile` | Documentos subidos (con texto extraído) y archivos generados |
| `UsageRecord` | Consumo por usuario, conversación, modelo, proveedor, tokens, coste, latencia, estado y **origen** (chat/comparación/revisión/agente) |
| `AuditLog`, `Setting` | Auditoría y políticas configurables |
| `Agent`, `ScheduledTask`, `AgentRun` | Estructura de agentes (sin ejecución) |

Aislamiento: todas las consultas filtran por el usuario de la sesión; las descargas comprueban la propiedad del archivo.

### Previsto (correspondencia con el prompt maestro)

| Entidad del prompt | Plan | Fase |
|---|---|---|
| `ORGANIZATIONS`, `ORGANIZATION_MEMBERS` | Tablas nuevas; `Department` pasa a depender de la organización; todas las consultas añaden `organizationId` | 6 |
| `PROJECTS` | Tabla nueva; `Conversation` y archivos con `projectId` opcional; «crear proyecto desde conversación» | 2 |
| `FILES` | Ya cubierto por `Attachment` + `GeneratedFile`; se unificarán con `projectId` | 2 |
| `AGENT_RUNS`, `AGENT_STEPS` | `AgentRun` existe; se añade `AgentStep` | 4 |
| `USAGE_EVENTS` | `UsageRecord` (añadir `projectId` y tipo de tarea) | 2 |
| `AUDIT_EVENTS` | `AuditLog` | ✓ |
| Memoria semántica | Tabla `MemoryChunk` con columna `vector` (pgvector), origen y propietario; RAG con citas | 2-4 |
| Políticas de acceso | Además del filtrado en la aplicación, Row Level Security en Supabase al exponer datos fuera de la API | 6 |

## Integración de proveedores

| Proveedor | SDK | Gratuito | Uso preferente en el selector |
|---|---|---|---|
| Google Gemini | `@google/genai` | Sí (con límites; puede usar datos) | Documentos largos, datos, general |
| Groq | `openai` (API compatible) | Sí (con límites) | GPT-OSS para código y razonamiento; Llama para consultas rápidas |
| OpenRouter | `openai` (API compatible) | Modelos `:free` | Alternativa gratuita y respaldo |
| Anthropic Claude | `@anthropic-ai/sdk` | No | Análisis, código, revisión (con respaldo en servidor ante negativas) |
| OpenAI GPT | `openai` | No | Redacción y general |

Funcionamiento:

1. **Selector** (`lib/ai/router.ts`): tarea → filtro por contexto → puntuación (capacidades, categoría, proveedor, coste según modo).
2. **Respaldo**: si un modelo falla antes de emitir texto, se pasa a otro proveedor de categoría similar.
3. **Comparación**: 2-3 modelos en paralelo, de proveedores distintos si la elección es automática.
4. **Segunda opinión**: un modelo de otro proveedor revisa una respuesta con criterios fijos.
5. **Claves**: solo en variables de entorno del servidor (Vercel las cifra); nunca llegan al navegador.

## Plan de fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Interfaz, login, 5 proveedores, selector, comparador, segunda opinión, historial, consumo, tema claro/oscuro | ✅ v1.1 |
| 2 | Documentos: PDF/PPTX/imágenes de entrada; PDF/PPTX/Excel con fórmulas y gráficos de salida; proyectos; memoria pgvector | Siguiente |
| 3 | Programador autónomo: editor, terminal y ejecución aislada (servicio de contenedores efímeros) | Pendiente |
| 4 | Agentes coordinados (LangGraph u orquestador equivalente) con aprobación humana | Pendiente |
| 5 | Automatizaciones (n8n u orquestador propio), integraciones y aprobaciones | Pendiente |
| 6 | Organizaciones, doble factor, RLS, copias de seguridad, optimización | Pendiente |

> **Coste 0 en fases 3-5:** un entorno de ejecución de código aislado y n8n requieren un servidor propio. Las opciones gratuitas existentes tienen límites estrictos; se evaluarán al llegar a esas fases.
