# Contrato de medicamentos: lectura con bajas, limpieza de campos, fecha de cambio y aviso de duplicado

El mobile publicó la tarjeta `baleadafit-api/medicamentos` (`medicamentos-sin-ruta-de-lectura`) con cuatro pedidos al backend. Verificado contra el código: no hay `GET /pacientes/:id/medicamentos` y las dos lecturas filtran `activo = true`, así que un medicamento dado de baja es invisible e irreparable. Faltaba además definir cómo se limpian `dosis` y `frecuencia`, exponer cuándo cambió el registro y avisar (sin bloquear) cuando se repite un fármaco.

## Specs

- **S1** — `GET /pacientes/{id}?incluirInactivos=true` devuelve también los medicamentos dados de baja; sin el parámetro la respuesta es la de hoy (solo vigentes, la más reciente primero). El parámetro se llama igual que el de `GET /pacientes`.
- **S2** — `PATCH /medicamentos/{id}` con `{"dosis": null}` o `{"frecuencia": null}` limpia el campo; omitirlo conserva el valor guardado; `""` responde 400.
- **S3** — `Medicamento` expone `actualizadoEn`, la fecha del último cambio, además de `creadoEn`.
- **S4** — `POST /pacientes/{id}/medicamentos` que repite un medicamento **activo** del mismo paciente (nombre normalizado: sin espacios en los extremos, en minúsculas y con espacios internos colapsados) responde 201 con el medicamento creado y `duplicadoDe: {id, nombre}`. No bloquea: el registro clínico se guarda igual.
- **S5** — La documentación declara que la medicación se lee embebida en el expediente y en la ficha, que ambas filtran por `activo` y ordenan por `creadoEn desc`, y que no hay autor por registro (cada paciente pertenece a una sola nutricionista).
- **S6** — Nada existente cambia: `POST` sin duplicado no gana campos, `PATCH` de `nombre`/`activo` y `DELETE` de baja lógica responden igual, y la ficha y el contexto clínico del recomendador siguen trayendo solo la medicación vigente.

## Tasks

- [x] M1 — Query `incluirInactivos` en `GET /pacientes/:id` y su filtro en `PacientesService.detalle` (S1, S6) — `e95f071`
- [x] M2 — Limpiar `dosis` y `frecuencia` con `null` en `ActualizarMedicamentoDto` (S2, S6) — `e95f071`
- [x] M3 — `actualizadoEn` en `Medicamento`, migración y entidad (S3) — `e95f071`
- [x] M4 — Aviso de duplicado por nombre normalizado en el alta (S4, S6) — `e95f071`
- [x] M5 — Documentación: descripciones del controlador, `docs/CONTEXTO.md`, `docs/openapi.json` regenerado (S5) — `e95f071` (openapi) y el commit de docs

## Log

- **L1** (pedido del dueño, verbatim): "el mobile publico algo enn el board, para que revisemos algo sobre medicamentos"
- **L2** (autorización, verbatim): "si si dale ahi completo pls"
- **L3** (fuente, tarjeta `baleadafit-api/medicamentos`, `medicamentos-sin-ruta-de-lectura`, actualizada 2026-11-16): pide `GET` con `?incluirInactivos=true` (o documentar el filtro de la ficha), cómo limpiar `dosis` y `frecuencia`, fechas y autor del registro, y aviso de duplicados por nombre.
- **L4** (verificación contra el código, esta sesión): solo existen `POST /pacientes/:id/medicamentos`, `PATCH /medicamentos/:id` y `DELETE /medicamentos/:id` (`src/pacientes/pacientes.controller.ts:144,160,177`); `detalle` (`pacientes.service.ts:105`) y `ficha` (`:470`) filtran `activo: true` y ordenan `creadoEn desc`, pero no lo documentan. `Medicamento` no tiene `actualizadoEn` ni autor (`prisma/schema.prisma:273-286`). `ActualizarMedicamentoDto` es `PartialType`, así que `""` pasa la validación y guarda string vacío en vez de limpiar. La tarjeta acierta en los cuatro puntos salvo en que el filtro de la ficha sí está definido: falta documentarlo.
- **L5** (decisiones de esta sesión): `incluirInactivos` reusa el nombre y la forma del query de `GET /pacientes` en lugar de una ruta nueva; limpiar es `null` y `""` pasa a ser 400 (una sola forma de hacerlo); el autor no se modela porque un paciente pertenece a una sola nutricionista y la columna pediría multi-usuario; el duplicado avisa en la respuesta del alta en lugar de bloquear con 409, porque el nombre es texto libre.
- **L6** (slice de commits): `e95f071` es el slice de código y contrato (413 líneas versionadas entre código, pruebas, migración y `docs/openapi.json`); este commit de documentación es el segundo slice y cierra la ficha.
- **L7** (verificación local observada antes del slice): RED con 7 casos en las tres specs nuevas y modificadas, GREEN después de la implementación; `npm run lint` sin errores (6 warnings previos del repo), 286/286 unitarias, 8/8 e2e, `npm run build` OK y 36 rutas en `docs/openapi.json`.
- **L8** (desvío corregido): el primer intento de pruebas del DTO escribió `src/pacientes/pacientes.dto.spec.ts` con `write` y borró las pruebas que ya existían del pipe de validación; se restauró el archivo desde `HEAD` y los casos nuevos se agregaron al final usando el mismo `ValidationPipe` del repo.
