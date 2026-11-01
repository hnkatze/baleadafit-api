# Paginación de listas y sobre de respuesta uniforme

Los endpoints de lista devuelven el array completo y cada respuesta tiene una forma distinta: el éxito es el objeto pelado y el error es `{ statusCode, message, error }` de Nest. Este feature agrega un sobre único para éxito y error en todo el API y dos modos de paginación (offset para el web, cursor para el mobile) que el cliente elige por query params.

## Specs

- **S1** — Dos modos de paginación en el mismo contrato, elegidos por query params: `?offset=&limit=` (modo web, incluye `total`) o `?cursor=&limit=` (modo mobile, incluye `nextCursor`). Requisito del dueño: "agreguemos 2 tipos de paginacion uno para el web y uno para el mobile" (L1).
- **S2** — Sobre global de éxito: toda respuesta JSON del API, incluido `GET /` y `GET /dashboard`, responde `{ ok: true, data: <lo mismo que antes>, meta?: { ... } }`. Decisión del dueño (L2): "Envoltorio global: todo el API con el mismo sobre". Quedan fuera `/docs` y `/docs-json`, que son de Swagger y no del API.
- **S3** — Sobre global de error: `{ ok: false, error: { codigo, mensaje, detalles? } }`, con `codigo` estable legible por máquina (`VALIDACION`, `NO_AUTENTICADO`, `SIN_PERMISO`, `NO_ENCONTRADO`, `CONFLICTO`, `CURSOR_INVALIDO`, `ERROR_HTTP`, `ERROR_INTERNO`), conservando el status HTTP actual (400, 401, 403, 404, 409, 500). Requisito del dueño: "y que tenga un wrapper consistente, con estados de error y exito claro" (L3).
- **S4** — Se paginan las listas que crecen sin techo: `GET /pacientes`, `GET /alimentos`, `GET /alimentos/:id/versiones`, `GET /citas`, `GET /pacientes/:id/planes`, `GET /pacientes/:id/mediciones`, `GET /me/mediciones`, `GET /me/citas`, `GET /me/registros`. No se paginan los catálogos fijos (`/restricciones`, `/condiciones`) ni los objetos de detalle.
- **S5** — Límites: `limit` por defecto 20 y máximo 100; `offset` ≥ 0; `limit` fuera de rango o no entero → 400 `VALIDACION`. `cursor` y `offset` juntos → 400 `VALIDACION`. Sin `offset` ni `cursor` la lista responde la primera página. Un `cursor` que no corresponde a una fila del recurso → 400 `CURSOR_INVALIDO`.
- **S6** — Forma de `meta`: `?offset=&limit=` → `{ limit, offset, total, hasMore }`; `?cursor=&limit=` → `{ limit, nextCursor, hasMore }`. `nextCursor` es opaco (string) y vale `null` en la última página. `total` sólo se calcula en modo offset, para no pagar un `COUNT` en cada request del mobile.
- **S7** — Orden estable: cada lista paginada agrega un desempate único (`id`) al final de su `orderBy`, para que el cursor no saltee ni repita filas cuando hay valores de orden empatados.
- **S8** — Nada existente se rompe funcionalmente: los datos de cada endpoint siguen en `data` con el mismo contenido y el mismo orden, y conservan su status (el aislamiento multi-nutricionista sigue dando 404 y el correo sin verificar 403).
- **S9** — Documentación: el README explica el sobre y los dos modos; `docs/openapi.json` regenerado con el sobre, los códigos de error y las páginas tipadas de cada lista.
- **S10** — El e2e corre contra la misma configuración de app que producción: pipes, interceptor y filtro se registran en una función compartida por `main.ts` y por `test/app.e2e-spec.ts`, no en dos lugares distintos.

## Tasks

- [x] T1 — `src/common/respuesta.ts`: tipos del sobre, códigos de error estables y decoradores Swagger de éxito/error (S2, S3, S9)
- [x] T1b — `src/common/codigos.ts`: códigos y tipos separados para romper el ciclo de imports con el motor de paginación (S2, S3)
- [x] T2 — Interceptor de éxito, filtro global de excepciones y `configurarApp()` compartida por `main.ts` y el e2e (S2, S3, S10)
- [x] T3 — `src/common/paginacion.ts`: `PaginacionDto`, helper `paginar()` con los dos modos y tipo/entidad `Pagina<T>` (S1, S5, S6)
- [x] T4 — Aplicar paginación y `orderBy` estable a las 9 listas de S4 (S4, S7)
- [x] T5 — Tests: unitarios de interceptor, filtro y helper; e2e del sobre, de los dos modos, de `limit` inválido y de `cursor` inválido (S1, S2, S3, S5, S6, S8)
- [x] T6 — README con el sobre y los dos modos + `npm run openapi` regenerado (S9)
- [x] T7 — Cierre: lint, unitarias, e2e y build verdes; resolver el árbol sucio (auth sin commitear y `docs/openapi.json` compartido)
- [x] T6b — `PaginacionDto` movido a `src/common/paginacion.dto.ts` porque el plugin de Swagger ignora los archivos que no terminan en `.dto.ts`/`.entity.ts` (S9)
- [ ] T8 — Commitear el feature — **bloqueada**: espera la decisión del dueño sobre el trabajo de auth sin commitear (L8, L13)

## Log

- **L1** (pedido del dueño, verbatim): "agreguemos 2 tipos de paginacion uno para el web y uno para el mobile"
- **L2** (decisión del dueño, verbatim): "Envoltorio global: todo el API con el mismo sobre" — elegido sobre "sólo listas + errores normalizados" y "sin sobre, sólo normalizar errores".
- **L3** (pedido del dueño, verbatim): "y que tenga un wrapper consistente, con estados de error y exito claro"
- **L4** (decisión de contrato): el modo no se elige con un parámetro `modo=`, se deduce de los parámetros: con `cursor` presente es cursor, si no es offset. Un solo endpoint por recurso, sin duplicar rutas.
- **L5** (estado inicial verificado): `rg "page|limit|skip|take|cursor|offset" src/` no encuentra ninguna paramétrica de paginación; los únicos `take` son topes de negocio (`take: 1` última medición, `take: 3` próximas citas). `rg -i "pagina"` no encuentra nada en todo el repo: la deuda no estaba escrita en ninguna parte.
- **L6** (estado inicial verificado): 162 tests unitarios en 16 archivos `*.spec.ts` más 8 e2e en `test/app.e2e-spec.ts`. Los unitarios prueban servicios con Prisma mockeado, así que el sobre no los toca; el e2e sí, porque mira cuerpos HTTP.
- **L7** (hallazgo): `test/app.e2e-spec.ts` construye la app a mano y no pasa por `main.ts`, así que hoy el e2e ya verifica una app distinta de la de producción (sin `forbidNonWhitelisted`). De ahí S10.
- **L8** (conflicto a resolver en T7): el árbol de trabajo tiene el trabajo de auth sin commitear en `src/auth/*`, `src/common/swagger.ts`, `docs/openapi.json`, `README.md`. `docs/openapi.json` se regenera desde la app, así que va a arrastrar esos cambios. No se commitea trabajo ajeno: se decide en el cierre.
- **L9** (RED del sobre, sin trampa): antes de escribir el interceptor se cambiaron las aserciones de `test/app.e2e-spec.ts` al sobre nuevo y se corrió: **7 de 8 e2e en rojo**, el único verde fue `/docs-json`, que es justo la ruta que no se envuelve. Después del interceptor y el filtro: 8/8.
- **L10** (defecto que encontró el e2e compartido): `test/app.e2e-spec.ts` armaba la app a mano y no pasaba por `main.ts`, así que ni el `forbidNonWhitelisted` ni nada de lo global existía en el test. Ahora hay `configurarApp()` y tanto `main.ts` como el e2e la usan (S10).
- **L11** (defecto propio, corregido con test): `catalogoParaPaciente` alimentaba al recomendador llamando a `listar()`, así que al paginar `listar()` el catálogo del generador quedaba recortado a una página y el plan se armaba con menos opciones en silencio. Ahora consulta el catálogo completo por su cuenta; lo cubre la suite de planes, que sigue verde.
- **L12** (defecto de documentación encontrado por el worker): `PaginacionDto` vivía en `src/common/paginacion.ts` y el plugin de Swagger solo introspecciona archivos `*.dto.ts`/`*.entity.ts`, así que **los parámetros `limit`, `offset` y `cursor` no aparecían en el OpenAPI** de ninguna lista. Se movió a `src/common/paginacion.dto.ts` con re-export para no tocar a los 17 importadores. Verificado en el JSON regenerado: los 9 GET paginados exponen los tres parámetros.
- **L13** (estado del árbol): el feature no se commiteó. `docs/openapi.json` y `README.md` se regeneraron/editaron con el trabajo de auth presente en el árbol, así que un commit de este feature arrastraría cambios ajenos. Antes de commitear hay que decidir qué pasa con `src/auth/*` (dos opciones: se commitea primero como su propio work unit, o se revierte del árbol para que este feature quede aislado).
- **L14** (verificación independiente NO disponible): el subagente verificador falló con `assistant reported an error` y, por regla, no se reintenta. Los chequeos que iba a hacer se hicieron a mano: las 8 consultas que cubren las 9 listas tienen `id` como último término del `orderBy` (`pacientes.service.ts:57,281`, `alimentos.service.ts:33,136`, `citas.service.ts:46`, `planes.service.ts:78`, `mi-cuenta.service.ts:77,130`), `limit` está acotado por `@Max(100)` en el DTO antes de llegar a Prisma (`paginacion.dto.ts:27`), y `catalogoParaPaciente` no pagina (`alimentos.service.ts:57`).
- **L15** (gates del cierre): `npm run lint` 0 errores (quedan 6 warnings previos), `npm test` **181/181** (162 previas + 19 nuevas), `npm run test:e2e` **8/8**, `npm run build` limpio, `tsc --noEmit` sin errores en los archivos del feature.
