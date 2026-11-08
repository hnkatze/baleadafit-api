# Push · registro de dispositivos (corte 1 de #25)

Corte 1 de la fase #25 de `docs/CONTEXTO.md`: el API guarda los tokens de push de cada usuario. **No envía nada todavía**; el envío es el corte 2.

## Specs

- **S1** — Tabla `dispositivo`: `id`, `token` (único), `plataforma` (`ANDROID` | `IOS` | `WEB`), `pacienteId` **o** `nutricionistaId` (exactamente uno, con `onDelete: Cascade`), `creadoEn`, `ultimoUso`. Un usuario tiene N dispositivos y el mismo token no se duplica nunca. Un `CHECK` en la migración rechaza la fila que traiga los dos perfiles o ninguno, porque Prisma no expresa esa restricción en el schema.
- **S2** — `POST /me/dispositivos` con `{token, plataforma}` registra o refresca el dispositivo del usuario autenticado. Es idempotente sobre el token: si ya existía —de este usuario o de otro— se actualiza el dueño a quien lo registra y se refresca `ultimoUso`, sin crear filas nuevas. Responde `200` con el dispositivo en `data`.
- **S3** — `DELETE /me/dispositivos/:token` borra el dispositivo solo si pertenece al usuario autenticado. Token de otro usuario o inexistente → `404` `NO_ENCONTRADO` y **ninguna fila se borra** (tampoco se revela si el token existe).
- **S4** — `GET /me/dispositivos` devuelve solo los dispositivos del usuario autenticado, más nuevos primero.
- **S5** — El dueño lo pone el servidor desde el token de Firebase: el perfil del usuario autenticado, nunca el body. El `rol` no se guarda como columna, se deriva de cuál de las dos claves foráneas tiene valor. Roles admitidos: `nutricionista` y `paciente`; `sin_perfil` → `403` (lo frena el guard y, por defensa, también el servicio).
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
- **El dispositivo cuelga del perfil, no del `uid` de Firebase**: primera versión guardaba `uid` y un `rol` de texto. La corrección (L7) reemplazó las dos columnas por `pacienteId`/`nutricionistaId` con `onDelete: Cascade` y un `CHECK` de unicidad de dueño. El `rol` desapareció como columna: es derivable, y un dato derivable guardado es un dato que puede contradecirse. La versión con `uid` no llegó a producción, así que la migración se reescribió en vez de acumular un fixup.
- **El perfil se resuelve del guard, no de una consulta extra**: `UsuarioActual` ya trae `pacienteId`/`nutricionistaId`, así que cada operación filtra por esa columna sin joins.

## Deuda abierta (cortes 2 y 3)

El corte 1 está desplegado en producción (`main` = `75684fe`, 2026-11-08). Lo que falta, en orden:

1. **Corte 2 · envío.** `enviarPush()` en `FirebaseService` con `getMessaging()` sobre el `App` que ya inicializa `obtenerApp()`. Destinatario: las filas de `dispositivo` del perfil (`pacienteId` o `nutricionistaId`). Incluye la limpieza: cuando FCM responde `messaging/registration-token-not-registered`, hay que **borrar la fila** en vez de reintentar. Sin limpieza la tabla se llena de tokens muertos.
2. **Corte 2 · endpoint de prueba.** Uno administrativo (rol nutricionista) que mande un push a los propios dispositivos, para probar sin esperar un evento de negocio.
3. **Corte 3 · eventos y preferencias.** Qué se manda y con qué texto: cita agendada, plan nuevo, recordatorio de comida. Los recordatorios necesitan un cron, y **Railway no lo trae**: se resuelve con un workflow programado de GitHub Actions contra un endpoint, o con un servicio aparte. Las preferencias por usuario son tabla nueva. Antes de escribir hay que definirlo como producto: eventos, textos, horarios y a quién le llega.
4. **Deuda chica arrastrada:** 4 warnings de `unbound-method` en `dispositivos.service.spec.ts` por referenciar `prisma.dispositivo.create` como valor en `expect`. El lint sale 0 y el repo ya tenía 6 parecidos.

## Log

- **L1** — "ocupamos metodos para guardar push id y esas cosas que ocupamos para los push de las apps y eso, y para configs nose"
- **L2** — "mejor despues jeje, si cerramos la deuda, commit y push pls" (se cerró la deuda del catálogo y quedó pusheada; push se retoma después).
- **L3** — "dale vamos con las push pls": se autoriza el corte 1 (registro de dispositivos). El envío FCM y los eventos quedan para los cortes 2 y 3.
- **L4** — El `POST` documentaba un `201` vacío por el default de Swagger para `POST`. Se corrigió devolviendo `201` cuando crea y `200` cuando refresca: el contrato no puede declarar un estado que la ruta no usa.
- **L5** — `prisma migrate dev` en Prisma 7 no regeneró el cliente: `src/generated/prisma/enums.ts` quedó sin `Plataforma` hasta un `prisma generate` explícito.
- **L6** — Verificación contra Postgres real: `docker compose up -d db` y la migración aplicó desde cero con las cinco anteriores. El script de verificación se borró; no quedó código descartable en el repo.
- **L7** — "pero el push token se amarra a un usuario no ?": tenía razón en el fondo. La primera versión lo amarraba al `uid` de Firebase con un `rol` de texto, que es un dato derivable y libre. Se reemplazó por `pacienteId`/`nutricionistaId` con `onDelete: Cascade`, `CHECK` de un solo dueño, y el `rol` pasó a derivarse de la fila. Migración reescrita (`20261108050243`, la anterior nunca se publicó). 14 tests unitarios y 8 comprobaciones contra Postgres real, incluidas las dos que rechaza el `CHECK` y el cascade al borrar el paciente.
- **L8** — "si si de una vez pls": se hizo antes de pushear, mientras la tabla todavía no existe en producción.
