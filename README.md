# TRAPERO AI

Centro de operaciones de inteligencia artificial privado: varios proveedores de IA (Gemini, Groq, OpenRouter, Claude y GPT) en una sola plataforma, con selector inteligente, comparación de modelos, control de acceso, consumo y seguridad. Diseñado para funcionar **con coste 0**.

| Documento | Contenido |
|---|---|
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | **Puesta en producción paso a paso desde el navegador** |
| [docs/AUDITORIA.md](docs/AUDITORIA.md) | Auditoría técnica, errores corregidos y riesgos pendientes |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Estructura, modelo de datos, integración de proveedores y fases |
| [docs/DECISIONES.md](docs/DECISIONES.md) | Decisiones técnicas y su justificación |
| [docs/PROMPT_MAESTRO.md](docs/PROMPT_MAESTRO.md) | Requisitos del proyecto |

## Qué incluye (v1.1 — fase 1)

- **Asistente multimodelo** con historial persistente, documentos adjuntos (PDF, Word, Excel, CSV, TXT, Markdown, JSON) y exportación a Word, Excel, Markdown, HTML y texto.
- **Selector inteligente**: elige según tipo de tarea, calidad necesaria, coste, tamaño del contexto y disponibilidad; explica su elección y cambia de proveedor si uno falla.
- **Modo de coste**: solo gratuitos (por defecto) · económico · calidad.
- **Comparación simultánea** de 2-3 modelos y **segunda opinión** de otro proveedor.
- **Panel de operaciones**, **consumo y costes**, **búsqueda**, **archivos**.
- **Usuarios, roles, departamentos y presupuestos**; **seguridad y auditoría**; instalación desde el navegador (`/setup`).
- **Agentes y programación**: estructura preparada; ejecución desactivada por seguridad.
- Modo claro y oscuro; ordenador, tablet y móvil.

## Desarrollo local (opcional)

Requisitos: Node.js 20+ y PostgreSQL.

```bash
npm install
cp .env.example .env     # STORAGE_DRIVER=local y tu PostgreSQL local
npx prisma db push
npm run dev              # http://localhost:3000 → /setup
```

Comprobaciones:

```bash
npm run typecheck        # tipos
npm test                 # pruebas automáticas
npm run build:local      # compilación de producción (sin tocar la base de datos)
```
