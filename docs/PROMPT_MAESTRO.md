# TRAPERO AI — Prompt maestro de desarrollo (versión 1.0)

Documento de referencia del proyecto, aportado por la propietaria. Las decisiones técnicas que se aparten de él se justifican en `docs/DECISIONES.md`.

## Resumen de requisitos

1. **Identidad:** centro de operaciones de IA privado (propietaria = administradora principal), en español, para navegador en ordenador, tablet y móvil, preparado para usuarios, departamentos y equipos.
2. **Filosofía:** convertir instrucciones en resultados reales y comprobados; nada simulado, sin datos ficticios ni botones decorativos; preguntar cuando falte información esencial; conservar decisiones y avances; no eliminar funcionalidades sin autorización.
3. **Multimodelo:** OpenAI, Anthropic y Google mediante API oficiales. Selector inteligente: automático, manual por proveedor, comparación simultánea, segunda opinión, criterio de complejidad y coste, sustitución ante fallos. Claves cifradas y nunca en el navegador.
4. **Módulos:** asistente IA, desarrollo de software (editor, terminal, ejecución aislada, versiones, pruebas, ZIP), documentos (XLSX, DOCX, PDF, PPTX, CSV, TXT), investigación con fuentes verificables, sistema multiagente (coordinador, programador, documental, investigador, financiero, Excel, auditor, automatizador) y automatizaciones.
5. **Arquitectura propuesta:** Next.js + React + TypeScript + Tailwind; Python + FastAPI; PostgreSQL / Supabase + pgvector; LangGraph; n8n; almacenamiento S3/Supabase; Vercel + servidor cloud + Docker; GitHub.
6. **Datos:** usuarios, organizaciones, miembros, proyectos, conversaciones, mensajes, archivos, ejecuciones y pasos de agentes, eventos de uso y de auditoría, con aislamiento entre usuarios y organizaciones.
7. **Memoria:** estructurada y semántica (RAG con pgvector), citando la procedencia y sin mezclar datos de usuarios.
8. **Programador autónomo:** ciclo completo (requisitos → código → pruebas → corrección → documentación → despliegue) en contenedores efímeros con límites de CPU, memoria, tiempo y red.
9. **Interfaz:** barra lateral (Inicio, Conversaciones, Desarrollo, Mis proyectos, Documentos, Investigación, Agentes IA, Automatizaciones, Memoria, Consumo y costes, Usuarios, Configuración), panel central y panel de control; modo claro y oscuro; responsive.
10. **Seguridad:** autenticación, roles, hash de contraseñas, sesiones, doble factor, cifrado de secretos, HTTPS, copias de seguridad, auditoría, aislamiento, defensa frente a inyección de instrucciones, límites de uso, RGPD.
11. **Control económico:** registro por proveedor, modelo, tokens, coste, usuario, proyecto, fecha y tipo de tarea; presupuestos, alertas y límites. Objetivo inicial orientativo: 100-200 €/mes. **Actualización de la propietaria: «Quiero que el coste sea 0».**
12. **Fases:** 1 núcleo, 2 documentos, 3 programador autónomo, 4 agentes, 5 automatizaciones, 6 escalabilidad.
13. **Reglas obligatorias:** sin funcionalidades simuladas, sin placeholders, código completo, comprobar y probar, control de versiones, seguridad y coste primero, instrucciones exactas.
14. **Entorno de la usuaria:** trabaja desde el navegador, sin instalar software; priorizar GitHub, servicios cloud y despliegues automáticos, con instrucciones paso a paso.
15. **Estado inicial:** se menciona un `TRAPERO_AI_v1.zip` (FastAPI) que **no se ha recibido**. La base existente y probada es la v1 construida en Next.js (este repositorio).
