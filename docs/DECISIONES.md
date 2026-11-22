# Registro de decisiones

Decisiones que se apartan del prompt maestro o que lo concretan, con su justificación.

## D1 — Next.js en lugar de FastAPI para el backend (22/11/2026)

- **Prompt maestro:** backend Python/FastAPI separado.
- **Decisión (aprobada por la propietaria):** mantener la v1 en Next.js/TypeScript (frontend + API en un solo servicio).
- **Motivos:** requisito de coste 0 (un segundo servidor gratuito se «duerme» y tarda en arrancar); la v1 ya funciona y está probada; un solo despliegue es más sencillo de mantener desde el navegador; los SDK oficiales de los tres proveedores existen en TypeScript.
- **Revisión:** Python se añadirá como servicio aislado cuando lo requiera el entorno de ejecución de código o la orquestación de agentes (fases 3-4).

## D2 — Coste 0: mezcla de proveedores gratuitos (22/11/2026)

- **Prompt maestro:** GPT + Claude + Gemini; presupuesto orientativo 100-200 €/mes. **Actualización:** «Quiero que el coste sea 0».
- **Hecho:** OpenAI y Anthropic no tienen nivel gratuito de API.
- **Decisión (aprobada):** combinar todos los proveedores gratuitos (Gemini, Groq, OpenRouter) con modo de coste «solo gratuitos» por defecto. GPT y Claude quedan integrados y se activan al añadir sus claves y cambiar el modo de coste.
- **Consecuencia:** en coste 0 no se usan GPT ni Claude oficiales; sí GPT-OSS (modelo abierto de OpenAI) a través de Groq.

## D3 — Supabase + Vercel como infraestructura (22/11/2026)

- Coincide con el prompt maestro. Planes gratuitos con límites documentados en `AUDITORIA.md`.

## D4 — Agentes sin ejecución en fase 1 (primera entrega)

- Coherente con el prompt maestro: ninguna acción externa sensible sin autorización. El ejecutor bloquea toda ejecución hasta la fase 3-4.
