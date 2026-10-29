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

- [x] T1 — Corregir la convergencia de `ajustarPorciones` para que todo tiempo de comida quede dentro de ±10 % cuando el catálogo lo permite (S1, S2) — inline, test-first — commit `3078302`
- [x] T2 — `POST /pacientes/:id/mediciones` devuelve `imc` como el `GET` (S3) — inline, test-first — commit `7071680`
- [x] T3 — Versionar la migración inicial y dejar `db:deploy` operativo (S4) — inline — commit `69df422`
- [x] T4 — Diagnóstico de Bedrock: estado de la IA consultable y llamada con timeout (S5) — worker `mvtra91f-1-dl55`, revisado por el orquestador
- [x] T5 — Ampliar el catálogo de alimentos del seed (S6) — worker `mvtra91l-2-1rpy`, revisado por el orquestador
- [ ] T6 — Refresh de sesión (S7) — bloqueada hasta que el dueño decida qué necesita
- [x] T7 — Arreglar la regresión del ajuste con más de cinco alimentos escalables (ruta Bedrock) y no reescalar cuando la escala proporcional ya cumple (S1, S2) — commit `5844ab4`
- [x] T8 — Documentar `MedicionConImcEntity` en el 201 del POST de mediciones y regenerar el OpenAPI (S3) — commit `ccb9250`
- [x] T9 — Sanear el error de Bedrock expuesto en el portal y acotar reintentos y timeout (S5) — commit `9c8fac4`

## Log

- **L1** (pedido original, verbatim): "tenemos lo que vamos a entregar entonces podemos ir orientando el api a eso, nos faltan cosas como refresh, mas datos y eso y para el recomendador de dieta una forma de conectar un beadrock"
- **L2** (contexto entregado, verbatim): "C:\Users\Camilo\Downloads\BaleadaFit — Semana 2.pdf esto es lo que vamos a entregar, solo que haremos una app para el BO tambien,"
- **L3** (decisión de esta sesión): el PPT de Semana 2 manda sobre el HTML "Visión & Arquitectura de Producto", que queda como visión a largo plazo (480 platos, BaleadaNet, WhatsApp, InBody, FHIR, HIPAA) y no como alcance del curso.
- **L4** (abierto): "refresh" puede significar renovación de token de sesión o refresco de datos en el portal. Con Firebase Auth el SDK del cliente renueva el ID token (1 h) sin endpoint propio; un `/auth/refresh` del lado del API duplicaría al SDK. Se necesita la decisión del dueño antes de implementar.
- **L5** (evidencia T1/T2, mismo paciente de prueba, contra la API viva): MERIENDA_AM de 144 kcal pasó de 116 kcal (−19.4 %) a 143 kcal (−0.7 %); las cinco comidas entre −4.2 % y +1.4 %; plan total 1435 vs 1440 (−0.3 %). `POST /mediciones` devuelve `imc: 28.5` para 73 kg / 160 cm.
- **L6** (decisión sobre la validación del seed): la regla de coherencia de macros (>15 % de desvío) se aplica con un piso absoluto de 20 kcal, porque tres filas del catálogo original no se pueden tocar y fallan por redondeo en porciones chicas: Pataste cocido 22.8 %, Fresco de rosa de Jamaica sin azúcar 20.0 %, Elote cocido 15.7 %. Se agrega además que toda etiqueta de `contiene` exista como `restriccion.codigo`.
- **L7** (evidencia T4/T5, contra la API viva): `GET /ia/estado` → `{habilitado:false, region:"us-east-1", ultimaLlamada:null}` sin `BEDROCK_MODEL_ID`; `POST /ia/estado/probar` → 201 con `{ok:false, error:"IA deshabilitada o BEDROCK_MODEL_ID sin configurar."}`; 401 sin token. Catálogo: 150 alimentos / 150 nombres distintos en la DB, 30 platos típicos, 87 marcados como típicos. Plan generado con el catálogo ampliado: 1400 kcal vs 1440 (−2.8 %) y las cinco comidas entre −9.0 % y +3.5 %.
- **L8** (verificación independiente `mvtrgcq2-3-yyf4` y correcciones): S4 y S5 aprobados; S1/S2 y S3 con defectos reales, reproducidos por el orquestador antes de tocar código — con seis alimentos escalables el ajuste no corría (510 kcal sobre 620, −17.7 %) y la escala proporcional que ya cumplía se pisaba cambiando el reparto de macros ([0.5, 1.75, 1.25, 2] en vez de [1.25, 1.25, 1.25, 2]); el 201 del OpenAPI seguía apuntando a `MedicionEntity` sin `imc`; y el error de AWS con ARN/cuenta/usuario IAM se devolvía al portal. Corregidos en T7-T9 con test-first (91 tests) y verificados contra la API viva: comidas entre −2.1 % y +8.2 %, plan +5.3 %, `probar` devuelve solo un mensaje accionable.
