# Ajustes de cuenta: perfil editable por la nutricionista

La nutricionista puede registrarse con `nombre`, `telefono` y `colegiado`, pero después no puede corregirlos: `mi-cuenta` no tiene ningún endpoint de perfil. El único `PATCH` de perfil es `PATCH /pacientes/:id`, que es del paciente. Los datos se guardan al registrarse y quedan congelados.

## Specs

- **S1** — `PATCH /me/perfil` edita el perfil de la **nutricionista autenticada**: `nombre`, `telefono` y `colegiado`. El perfil sale del token (`nutricionistaId`), nunca de un id del body; no existe forma de editar el perfil de otra. Responde `200` con el perfil actualizado.
- **S2** — Limpieza de campos opcionales, con el mismo contrato que `medicamentos`: `{"telefono": null}` limpia; omitir la propiedad conserva el valor guardado; el texto vacío `""` responde `400 VALIDACION`. Una sola forma de limpiar evita guardar `""`.
- **S3** — `nombre` es obligatorio y no se puede limpiar: `null` o `""` → `400 VALIDACION`. Entre 3 y 120 caracteres, igual que en el alta.
- **S4** — No son editables: `correo` (viene del token de Firebase, es la identidad de la cuenta), `estado` (lo cambia el admin) y `firebaseUid`. Mandarlos en el body da `400` por el pipe global con `forbidNonWhitelisted`.
- **S5** — Un perfil en estado `PENDIENTE` o `RECHAZADO` **también** puede editar su propio perfil: es la única escritura que un `nutricionista_pendiente` conserva. La ruta lleva `@Roles('nutricionista', 'nutricionista_pendiente')`.
- **S6** — Restablecer contraseña **no lleva endpoint**. La app llama a `sendPasswordResetEmail` del SDK de Firebase directamente: la contraseña vive en Firebase y un endpoint del API tendría que generar el enlace con `generatePasswordResetLink` y después mandar el correo por su cuenta, para terminar en el mismo lugar. Se documenta en `docs/CONTEXTO.md` para que nadie lo pida de nuevo.
- **S7** — Las preferencias de notificación quedan **fuera** de este alcance: `odd/tasks/push-dispositivos.md` ya las marca bloqueadas por producto ("eventos, textos, horarios y a quién le llega"). La captura de dispositivos existe desde el corte 1; falta decidir el producto, no el código.
- **S8** — `docs/CONTEXTO.md`, el Swagger y `docs/openapi.json` describen la ruta nueva.

## Tasks

| ID | Qué | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | `PATCH /me/perfil` con semántica de limpieza y roles | S1-S5 | writer | `2e6b953` |
| T2 | DTO, entity y spec del perfil | S1-S5 | writer | `2e6b953` |
| T3 | Docs: CONTEXTO, Swagger, `docs/openapi.json` | S6, S7, S8 | inline | `31641e6` |

## Log

- **L1** (pedido del usuario, verbatim): "y numero de telefono no estamos guardando tampoco"
- **D1** (verificación de L1): `telefono` **sí** se guarda en el alta. `Nutricionista.telefono` existe en `schema.prisma:123`, está en `RegistroNutricionistaDto` y entra por `...dto` en el `create`. El defecto real no es la captura: es que **no se puede editar después**. Por eso esta feature es un `PATCH`, no un campo nuevo.
- **L2** (pedido del usuario, verbatim): "lo que que vamos a ocupar en ajustes del app, seria para reestrabelcer contrasena, confirmar colegiatura, recibir notificaciones y lo que podamos capturar desde el BE"
- **D2** (restablecer contraseña se resuelve en el cliente): un endpoint del API que genere el enlace tendría que mandar el correo por su cuenta —volvería a meter SES por la ventana— para terminar en la misma pantalla de Firebase. La app usa el SDK y el API no participa. Ver S6.
- **D3** (notificaciones bloqueadas): no se implementan preferencias. El motivo no es técnico: la deuda #3 de `push-dispositivos.md` pide definir eventos, textos, horarios y destinatarios antes de escribir. Inventar esa tabla sería adivinar el producto.
- **D4** (confirmar colegiatura queda para después): el usuario decidió dejarlo fuera de esta entrega. `colegiado` sigue siendo texto libre y el `PATCH` solo permite corregirlo, no verificarlo.
- **L3** (evidencia funcional, contra Postgres real con `AUTH_DEV_BYPASS`): sobre un perfil en `RECHAZADO`, `PATCH /me/perfil` con `{"telefono":"+504 8888-7777","colegiado":null}` → 200, teléfono escrito y `colegiado` limpiado a null. El rechazo no encierra al usuario: puede corregir lo que le pidieron antes de volver a pedir revisión.
- **L4** (gate): 30 pruebas en `src/mi-cuenta` verdes (21 previas + 9 nuevas), `npm run lint` exit 0 tras corregir una promesa sin `await` en el spec, `npm run build` OK.
- **L5** (deuda conocida, no corregida acá): `nombre` no se recorta con `@Transform`, igual que en `ActualizarMedicamentoDto` y en el alta, así que `"   "` con tres espacios pasa la validación. Se dejó consistente con el resto en vez de arreglar solo esta ruta; si se corrige, va para las tres juntas.
