# Alineación del API con el entregable de Semana 2

Fuente de verdad: `BaleadaFit — Semana 2.pdf` (12 slides, CEUTEC 769). El MVP declarado es el portal web de la nutricionista; la app del paciente figura como fase futura. El API ya cubre el modelo ER y los endpoints del PPT; lo que falta es cerrar cuatro desalineaciones y preparar el catálogo y el conexionado de Bedrock.

## Specs

- **S1** — PPT slide 09 (Recomendador híbrido): "NestJS recalcula totales (±10%) y la nutricionista aprueba."
- **S2** — PPT slide 05 paso 04 (Valida): "NestJS recalcula totales (±10%) y la nutricionista aprueba." (el paso 03 "Propone" es de Bedrock; el 04 es la validación obligatoria del backend).
- **S3** — Contrato publicado en `docs/openapi.json` para `POST /pacientes/{id}/mediciones` (201 → `MedicionEntity`), cuyo campo `imc` está documentado en `src/pacientes/pacientes.entity.ts:51` como "Índice de masa corporal calculado." El `GET` de mediciones ya lo devuelve; el `POST` debe devolver el mismo contrato.
- **S4** — PPT slide 06 (Sprint 1): "Repos, BD en Railway, migraciones, login con Firebase." El repo debe versionar las migraciones de Prisma para que `npm run db:deploy` cree el esquema.
- **S5** — Pedido del usuario: "para el recomendador de dieta una forma de conectar un beadrock". El servicio `src/ia/bedrock.service.ts` ya usa la Converse API; falta una forma de saber, desde el portal, si la IA está conectada y con qué modelo, y que una llamada lenta no cuelgue el request.
- **S6** — Pedido del usuario: "nos faltan cosas como … mas datos". El catálogo es de 45 alimentos y 9 platos típicos (`prisma/seed.ts`); el PPT slide 03 declara "Catálogo de alimentos y platos típicos con macros por porción" como parte del MVP.
- **S7** — Pedido del usuario: "nos faltan cosas como refresh …". Sin definir: pendiente de decisión del dueño (ver Log L4).

## Tasks

- [ ] T1 — Corregir la convergencia de `ajustarPorciones` para que todo tiempo de comida quede dentro de ±10 % cuando el catálogo lo permite (S1, S2) — inline, test-first
- [ ] T2 — `POST /pacientes/:id/mediciones` devuelve `imc` como el `GET` (S3) — inline, test-first
- [ ] T3 — Versionar la migración inicial y dejar `db:deploy` operativo (S4) — inline
- [ ] T4 — Diagnóstico de Bedrock: estado de la IA consultable y llamada con timeout (S5) — inline, test-first
- [ ] T5 — Ampliar el catálogo de alimentos del seed (S6) — delegable
- [ ] T6 — Refresh de sesión (S7) — bloqueada hasta que el dueño decida qué necesita

## Log

- **L1** (pedido original, verbatim): "tenemos lo que vamos a entregar entonces podemos ir orientando el api a eso, nos faltan cosas como refresh, mas datos y eso y para el recomendador de dieta una forma de conectar un beadrock"
- **L2** (contexto entregado, verbatim): "C:\Users\Camilo\Downloads\BaleadaFit — Semana 2.pdf esto es lo que vamos a entregar, solo que haremos una app para el BO tambien,"
- **L3** (decisión de esta sesión): el PPT de Semana 2 manda sobre el HTML "Visión & Arquitectura de Producto", que queda como visión a largo plazo (480 platos, BaleadaNet, WhatsApp, InBody, FHIR, HIPAA) y no como alcance del curso.
- **L4** (abierto): "refresh" puede significar renovación de token de sesión o refresco de datos en el portal. Con Firebase Auth el SDK del cliente renueva el ID token (1 h) sin endpoint propio; un `/auth/refresh` del lado del API duplicaría al SDK. Se necesita la decisión del dueño antes de implementar.
