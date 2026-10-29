# Alimentos versionados y plan inmutable

Los valores nutricionales del catálogo son datos de referencia que cambian con el tiempo (revisiones del INCAP, leyes de fortificación, reformulación industrial). Hoy `detalleConTotales` recalcula los totales con los valores **actuales** del alimento, así que corregir un alimento cambia retroactivamente los planes ya aprobados. Este feature versiona los valores y hace que cada plan quede atado a la versión que usó.

## Specs

- **S1** — Cada alimento conserva la identidad (nombre, categoría, tiempos de comida, restricciones) y sus valores viven en versiones con `vigenteDesde`, `vigenteHasta`, `tabla` y `fuente`.
- **S2** — Editar un alimento crea una versión nueva y cierra la anterior; no se edita el pasado.
- **S3** — Cada ítem de un plan apunta a la versión que se usó al crearlo.
- **S4** — Los totales de un plan salen de las versiones que el plan referencia: **editar un alimento no cambia ningún plan existente**.
- **S5** — `GET /alimentos/:id/versiones` muestra el historial, para ver qué cambió y cuándo.
- **S6** — El catálogo, el prompt del agente y el alta/edición de alimentos siguen funcionando igual: la versión vigente es la que se ve.
- **S7** — Los datos existentes se migran: cada alimento arranca con su versión inicial y los ítems de planes existentes quedan atados a ella.
- **S8** — Los umbrales clínicos (N5) no entran acá: son política y van a configuración, no a versiones.

## Tasks

- [ ] V1 — Modelo y migración: `AlimentoVersion`, `PlanItem.alimentoVersionId` y backfill de los datos existentes (S1, S3, S7)
- [ ] V2 — Alta y edición de alimentos crean versión; `GET /alimentos/:id/versiones` (S2, S5, S6)
- [ ] V3 — Los planes atan la versión vigente al crear ítems y totalizan con la versión atada (S3, S4)
- [ ] V4 — Seed idempotente que crea la versión inicial de cada alimento (S7)
- [ ] V5 — README y OpenAPI al día (S5, S6)

## Log

- **L1** (preocupación del dueño, verbatim): "Bedrock tendra todos estos datso, pero las variaciones de los gramajes pueden cambiar, evolucionamos cada año debido al calor que aumenta en el planeta, vamos a llegar a un punto de mutacion, esos valores deberian ser configurables no o como _"
- **L2** (autorización, verbatim): "vamos con tu plan"
- **L3** (decisión): los **valores nutricionales se versionan**, no se configuran: son datos de referencia con fuente y vigencia. Lo que sí será configurable son los umbrales clínicos de N5, porque son política clínica. Los planes quedan atados a la versión usada, para que el historial no se mueva.
- **L4** (defecto que motiva el feature): `planes.service.ts:65,74` recalcula los totales con los valores actuales del alimento, así que un `PATCH /alimentos/:id` cambia retroactivamente los totales y la desviación de planes ya aprobados y archivados.
- **L5** (causa real declarada, no el cambio climático): lo que mueve la tabla son las revisiones del INCAP, las leyes de fortificación (harina de trigo, sal yodada, azúcar con vitamina A), la reformulación industrial y las variedades biofortificadas. El CO₂ alto reduce algo la proteína y los minerales de los cereales, pero en escala de años y de forma pequeña.
