# Push · registro de dispositivos (corte 1 de #25)

Corte 1 de la fase #25 de `docs/CONTEXTO.md`: el API guarda los tokens de push de cada usuario. **No envía nada todavía**; el envío es el corte 2.

## Specs

- **S1** — Tabla `dispositivo`: `id`, `token` (único), `plataforma` (`ANDROID` | `IOS` | `WEB`), `uid` de Firebase, `rol`, `creadoEn`, `ultimoUso`. Un usuario tiene N dispositivos y el mismo token no se duplica nunca.
- **S2** — `POST /me/dispositivos` con `{token, plataforma}` registra o refresca el dispositivo del usuario autenticado. Es idempotente sobre el token: si ya existía —de este usuario o de otro— se actualiza el dueño a quien lo registra y se refresca `ultimoUso`, sin crear filas nuevas. Responde `200` con el dispositivo en `data`.
- **S3** — `DELETE /me/dispositivos/:token` borra el dispositivo solo si pertenece al usuario autenticado. Token de otro usuario o inexistente → `404` `NO_ENCONTRADO` y **ninguna fila se borra** (tampoco se revela si el token existe).
- **S4** — `GET /me/dispositivos` devuelve solo los dispositivos del usuario autenticado, más nuevos primero.
- **S5** — El dueño y el rol los pone el servidor desde el token de Firebase, nunca el body. Roles admitidos: `nutricionista` y `paciente`; `sin_perfil` → `403`.
- **S6** — Validación: `token` obligatorio entre 20 y 4096 caracteres; `plataforma` uno de los tres valores del enum; cualquier propiedad no declarada se rechaza (pipe global) con `400` `VALIDACION`.
- **S7** — Nada existente se rompe. README, `docs/CONTEXTO.md` y `docs/openapi.json` al día.
- **S8** — Migración aditiva: crea `dispositivo` y el enum `Plataforma`, sin tocar tablas existentes.

## Tasks

| ID | Qué | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Modelo `dispositivo` + enum `Plataforma` + migración | S1, S8 | inline | `d8f6292` |
| T2 | Módulo `dispositivos`: DTO, entity, service, controller, `AppModule` | S2-S6 | inline | `d8f6292` |
| T3 | Tests unitarios del service | S2-S6 | inline | `d8f6292` |
| T4 | Docs: README, CONTEXTO §9, OpenAPI regenerado | S7 | inline | `d8f6292` |
| T5 | Gate completo (lint, test, e2e, build) y commit | S7 | inline | `d8f6292` |

Rama `feat/push-dispositivos`. Evidencia: migración `20261108043717_dispositivos` aplicada sobre Postgres 16 local desde cero (junto con las cinco anteriores), 210 unitarias (12 nuevas), 8 e2e, `lint` exit 0, `build` OK, `npm run openapi` → 35 rutas. Las cuatro reglas de S2/S3/S4 se verificaron además contra la base real con un script descartable: creación, refresco sin duplicar, cambio de dueño y borrado ajeno rechazado.

Decisiones tomadas al implementar, para no reabrirlas:

- **Sin columna `activo`**: el borrado es real. Una bandera de "token activo" solo agrega un filtro en cada lectura; el corte 2 va a borrar igual las filas que FCM reporte como muertas.
- **Sin FK al perfil**: el dueño es `uid` de Firebase, que ya es único en `nutricionista` y en `paciente`. Guardar además `pacienteId`/`nutricionistaId` duplica un dato que se deriva del `uid` y puede quedar desincronizado.

## Log

- **L1** — "ocupamos metodos para guardar push id y esas cosas que ocupamos para los push de las apps y eso, y para configs nose"
- **L2** — "mejor despues jeje, si cerramos la deuda, commit y push pls" (se cerró la deuda del catálogo y quedó pusheada; push se retoma después).
- **L3** — "dale vamos con las push pls": se autoriza el corte 1 (registro de dispositivos). El envío FCM y los eventos quedan para los cortes 2 y 3.
- **L4** — El `POST` documentaba un `201` vacío por el default de Swagger para `POST`. Se corrigió devolviendo `201` cuando crea y `200` cuando refresca: el contrato no puede declarar un estado que la ruta no usa.
- **L5** — `prisma migrate dev` en Prisma 7 no regeneró el cliente: `src/generated/prisma/enums.ts` quedó sin `Plataforma` hasta un `prisma generate` explícito.
- **L6** — Verificación contra Postgres real: `docker compose up -d db` y la migración aplicó desde cero con las cinco anteriores. El script de verificación se borró; no quedó código descartable en el repo.
