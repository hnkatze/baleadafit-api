# Registros de comida escritos por la nutricionista y autoría del registro

Feature #12 del backlog: hoy el único escritor de comidas es `PUT /me/registros` (rol paciente), así que un plan activo nunca acumula adherencia real. Se agrega la escritura y la lectura del lado de la nutricionista, más un campo que diga quién marcó la comida.

## Specs

- **S1** — `PUT /pacientes/{id}/registros` marca una comida del paciente con token de nutricionista. Body: `{tiempoComidaId, fecha (YYYY-MM-DD), cumplido (bool), comentario?}`, "usando el mismo shape que devuelve PUT /me/registros". Es un upsert sobre la clave natural `(paciente, tiempo, fecha)`: si la fila ya existe, actualiza `cumplido` y `comentario`; responde 200 con la fila.
- **S2** — `GET /pacientes/{id}/registros` lista los registros del paciente con `desde`/`hasta` "para corregir o auditar lo cargado". Ventana por defecto: 7 días, igual que `GET /me/registros`. Lista paginada por `offset`/`cursor` como el resto del API.
- **S3** — "Se necesita además un campo que distinga autoría (paciente vs nutricionista) en la respuesta de /me/registros y en /pacientes/{id}/adherencia; hoy no existe y sin él no se puede auditar quién marcó una comida." El campo se llama `autor` y vale `PACIENTE` o `NUTRICIONISTA`.
- **S4** — `PUT /me/registros` sigue siendo la marca del paciente y deja `autor = PACIENTE`; una escritura de nutricionista deja `autor = NUTRICIONISTA`. El último actor que escribe es el autor de la fila.
- **S5** — Aislamiento: paciente de otra nutricionista o `tiempoComidaId` que no pertenece a un plan de ese paciente responden 404, nunca 403 (regla de `docs/CONTEXTO.md`, sección Aislamiento).
- **S6** — "Un plan ACTIVO no implica adherencia: sin registros, el bloque adherencia30d devuelve porcentaje null con total 0, no 0%." Con los registros que cargue la nutricionista, `GET /pacientes/{id}/adherencia` y `GET /pacientes/{id}/ficha` pasan a devolver porcentaje real sin cambiar la forma 0–1 de `adherencia`.
- **S7** — `docs/CONTEXTO.md`, el Swagger y `docs/openapi.json` describen las rutas nuevas y el campo `autor`.

## Tasks

- [ ] T1 · S3 — enum `AutorRegistro` + columna `autor` con default `PACIENTE` (schema + migración). Commit: —
- [ ] T2 · S4 — `PUT /me/registros` escribe `autor = PACIENTE`. Commit: —
- [ ] T3 · S1, S5 — `PUT /pacientes/{id}/registros` (upsert, autor NUTRICIONISTA, 404 de aislamiento). Commit: —
- [ ] T4 · S2, S5 — `GET /pacientes/{id}/registros` paginado con ventana de 7 días. Commit: —
- [ ] T5 · S3, S6 — `autor` en las entidades y en las respuestas de adherencia y de `/me/registros`. Commit: —
- [ ] T6 · S7 — CONTEXTO.md, Swagger y `docs/openapi.json` al día; gate completo verde. Commit: —

## Log

- **L1** (pedido del usuario, verbatim): "miremos el board el mobile dejo un pendiente" y después "si si dale".
- **L2** (origen del requisito, card `baleadafit-api/registros` → `nutricionista-no-puede-registrar-comidas`, verbatim): "PUT /me/registros responde 403 SIN_PERMISO"; "Pedir a BE un endpoint de nutricionista para registrar o corregir comidas del paciente, en vez de resolverlo desde la app."; "Propuesta para BE, mínimo viable: POST /pacientes/{id}/registros con body {tiempoComidaId, fecha (YYYY-MM-DD), cumplido (bool), comentario?} usando el mismo shape que devuelve PUT /me/registros, y GET /pacientes/{id}/registros con desde/hasta para corregir o auditar lo cargado."
- **D1** (verbo de la ruta): la propuesta del board pedía `POST`, se implementa `PUT` porque la operación es un upsert sobre `(paciente, tiempo, fecha)` — el mismo caso que ya resuelve `PUT /me/registros`. Un `POST` que actualiza mentiría sobre su idempotencia, y el cliente todavía no está escrito. Se avisa en el board.
- **D2** (semántica de `autor`): una sola columna con el último actor que escribió la fila. No hay historial: si el paciente vuelve a marcar una comida que corrigió la nutricionista, `autor` pasa a `PACIENTE`. Queda explícito en CONTEXTO.md y en la entidad.
- **D3** (módulo): la escritura vive en `PacientesService`, no en `MiCuentaService`, para no invertir la dependencia `mi-cuenta → pacientes`.
