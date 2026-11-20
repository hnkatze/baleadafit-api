# Verificación del nutricionista: estado de aprobación y edad

Hoy el rol se deriva de la existencia de la fila en `nutricionista` (`auth.guard.ts:66-71`): cualquiera con un correo verificado en Firebase que llame a `POST /auth/registro-nutricionista` ejerce de inmediato. El `colegiado` es texto libre sin validar. Se agrega un estado de aprobación que bloquea de verdad, y la captura de la edad en el alta.

## Specs

- **S1** — Enum `EstadoNutricionista` (`PENDIENTE` | `APROBADO` | `RECHAZADO`) y columna `estado` en `nutricionista` con **default `APROBADO`**. El default es seguridad de la migración, no la regla de negocio: las filas existentes no pierden acceso. El alta nueva inserta `PENDIENTE` explícito.
- **S2** — "agregar un estado de verificacion" tiene que bloquear. El guard devuelve el rol `nutricionista_pendiente` cuando `estado !== APROBADO`, así los siete `@Roles('nutricionista')` existentes lo rechazan con `403 SIN_PERMISO` sin tocar un solo controller. Si el estado no se chequea en el guard, la aprobación es cosmética.
- **S3** — Un `nutricionista_pendiente` conserva su `nutricionistaId` y puede leer y editar su propio perfil. `GET /auth/me` devuelve su `perfil` completo —con `estado` adentro— en vez de `null`, para que la app muestre "cuenta en revisión" en vez de una pantalla vacía; la ruta no lleva `@Roles`, así que el rol nuevo pasa sin tocar el controller.
- **S4** — Rol `admin` derivado de una lista de correos en configuración (`ADMIN_CORREOS`, separados por coma, comparación sin distinguir mayúsculas). No se agrega un modelo ni una columna: un admin no es un perfil del dominio.
- **S5** — `GET /admin/nutricionistas?estado=` lista los perfiles filtrando por estado (por defecto `PENDIENTE`), y `PATCH /admin/nutricionistas/{id}/estado` con `{estado, motivo?}` aprueba o rechaza. Un `motivo` es obligatorio cuando `estado = RECHAZADO` y se **persiste** en `nutricionista.motivo_rechazo`; al pasar a `APROBADO` la columna se limpia a `null`, para que un motivo viejo no contradiga un estado nuevo. Sin rol admin → `403 SIN_PERMISO`.
- **S6** — El alta exige `fechaNacimiento` (`YYYY-MM-DD`) y rechaza con `400 VALIDACION` a quien no tenga al menos 18 años cumplidos. En la base la columna es nullable: las nutricionistas existentes no tienen el dato y no se inventa.
- **S7** — "deberia dejarlo entrar": el alta **no** exige evidencia de colegiatura. `colegiado` sigue siendo opcional y no bloquea el registro. Lo que queda cerrado hasta la aprobación es el acceso a datos, no la posibilidad de registrarse.
- **S8** — Nada existente se rompe: las nutricionistas ya aprobadas siguen operando igual. `docs/CONTEXTO.md`, el Swagger y `docs/openapi.json` al día.

## Tasks

| ID | Qué | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Enum `EstadoNutricionista`, `estado`, `fechaNacimiento`, `motivoRechazo` + migraciones | S1, S5, S6 | inline | `d3d113c` |
| T2 | Guard: `nutricionista_pendiente` y `admin`; `UsuarioActual.estado` | S2, S3, S4 | inline | `ace3b2e` |
| T3 | Alta con `PENDIENTE`, `fechaNacimiento` y regla de 18 años | S6, S7 | inline | `ace3b2e` |
| T4 | Módulo `admin`: listar y aprobar/rechazar | S5 | writer | `dabc878` |
| T5 | `/auth/me` con el perfil del pendiente | S3 | inline | `ace3b2e` |
| T6 | Docs, Swagger y `docs/openapi.json` | S8 | inline | `docs` |

## Log

- **L1** (pedido del usuario, verbatim): "como estamos manejando el registro ? de los nutricionistas ?"
- **L2** (verbatim): "deberiamos pedir confirmacion por correo, podriamos configurar ses es barato, y agregar un estado de verificacion podria ser que dices ? lo ves bien ?"
- **L3** (verbatim): "ambas mejor"
- **L4** (verbatim): "y numero de telefono no estamos guardando tampoco"
- **L5** (verbatim): "dale en paralelo lo que podamos pls"
- **D1** (SES se descarta): la confirmación por correo **ya está resuelta y gratis** vía Firebase. `firebase.service.ts:50` lee `email_verified` y `auth.controller.ts:74` responde `403` si no está verificado. Configurar SES duplicaría eso y sumaría dominio verificado, DKIM, salida del sandbox y manejo de rebotes, sin cambiar el comportamiento observable.
- **D2** (un solo estado, no dos): no se separa "estado de la cuenta" de "estado de la colegiatura". El admin aprueba el perfil entero; si el motivo es la colegiatura, va en `motivo`.
- **D3** (default `APROBADO`): con default `PENDIENTE` la migración dejaría sin acceso a todas las nutricionistas existentes, incluida la cuenta de desarrollo.
- **D4** (edad mínima 18): L4 no definió el corte. Se toma 18 porque la colegiatura profesional implica mayoría de edad. Se documenta como supuesto: si el corte es otro, es una línea en `auth.controller.ts`. El consentimiento de tutor para pacientes menores **no** entra acá: el paciente nunca se autorregistra, lo crea la nutricionista, y ese es un alcance aparte.
- **L6** (hallazgo del writer de T4, verbatim): "el contrato pedido exige que el update persista `motivo`, pero el modelo `Nutricionista` ... no tiene columna para el motivo del rechazo". Era un hueco de S5: el `motivo` no tenía dónde guardarse. Se resuelve con la columna `motivo_rechazo` (migración `20261118000001`), no descartando el dato: un perfil rechazado sin motivo deja a la nutricionista sin nada que corregir.
- **L7** (evidencia de la migración, Postgres 16 local): sobre la base con las diez migraciones previas menos una y dos filas de `nutricionista` —la cuenta real `playercamiloh504@gmail.com` y una fila insertada a mano— `prisma migrate deploy` aplica `20261117000000`, `20261118000000` y `20261118000001`. Las dos filas quedan con `estado = APROBADO`, `fecha_nacimiento` y `motivo_rechazo` en null, y `colegiado`/`telefono` intactos: ninguna se reescribe ni pierde acceso. La fila de prueba se borró después.
- **L8** (gate, al cerrar): `npm run lint` exit 0, `npx vitest run` 27 archivos y 334 pruebas verdes (307 antes de la feature), `npm run test:e2e` 8 verdes, `npm run build` OK, `npm run openapi` → 39 rutas.
- **L9** (verificación funcional con `AUTH_DEV_BYPASS` contra Postgres real, once casos): `/auth/me` del pendiente → 200 con `rol: nutricionista_pendiente` y perfil no nulo; `GET /pacientes` del pendiente → 403 `SIN_PERMISO`; `/admin/nutricionistas` del pendiente → 403; del admin → 200 con el perfil y `motivoRechazo: null`; rechazo sin motivo → 400 `VALIDACION`; rechazo con motivo → 200 y el motivo persistido; `PATCH /me/perfil` estando RECHAZADO → 200 (teléfono escrito, `colegiado` limpiado a null); aprobar → 200 con `motivoRechazo: null`; `/auth/me` → `rol: nutricionista`; `GET /pacientes` → 200; sin token → 401.
- **L10** (defecto encontrado en el gate, corregido): el spec de `admin` tenía el `SELECT` copiado a mano y falló al agregar `motivoRechazo` al select real; se actualizó la copia, que es justo lo que la copia existe para hacer. Un test de `mi-cuenta` llamaba al handler sin `await` y el lint lo marcaba como promesa flotante.
- **D5** (teléfono, verificado contra L4): `telefono` **sí** se guarda en el alta (`Nutricionista.telefono`, `schema.prisma:123`; está en `RegistroNutricionistaDto` y entra por `...dto`). El defecto real es que **no se puede editar después**: `mi-cuenta` no tiene endpoint de perfil. Se resuelve en la unidad de ajustes, no acá.
