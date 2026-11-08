# BaleadaFit API

[![CI](https://github.com/hnkatze/baleadafit-api/actions/workflows/ci.yml/badge.svg)](https://github.com/hnkatze/baleadafit-api/actions/workflows/ci.yml)

API de **BaleadaFit**, una plataforma de nutrición clínica basada en comida hondureña. Sirve a una sola app móvil (Flutter) con dos roles:

- **Nutricionista:** gestiona pacientes, mediciones, catálogo de alimentos, planes y agenda.
- **Paciente:** consulta su plan, su progreso y sus citas, y registra si cumplió cada comida.

Proyecto de la clase **769 Ingeniería de Software I — CEUTEC**.

## Stack

| Pieza | Uso |
|---|---|
| NestJS 12 (TypeScript, ESM) | API REST |
| PostgreSQL + Prisma 7 | Datos clínicos y catálogo |
| Firebase Auth (Admin SDK) | Verificación de tokens y roles |
| AWS Bedrock (Converse API) | Propuesta de planes alimenticios |
| Railway | Hosting de la API y de Postgres |

## Recomendador de dietas (híbrido)

1. **NestJS calcula** el requerimiento con Mifflin-St Jeor × factor de actividad ± ajuste por meta, y reparte los macros (25 / 50 / 25 por defecto).
2. **Filtra el catálogo** quitando los alimentos que chocan con las restricciones del paciente (lactosa, gluten, cerdo…).
3. **Bedrock propone** qué alimentos del catálogo poner en cada tiempo de comida, con sus porciones.
4. **NestJS valida:** descarta IDs inventados, ajusta las porciones en cuartos hasta quedar a ±10 % de la meta de cada tiempo y recalcula los totales.
5. Si la IA no está configurada o falla, se usa el **generador por reglas**.
6. El plan queda en `BORRADOR`. La nutricionista lo edita y lo **activa**, y el plan activo anterior se archiva.

La lógica pura está en `src/nutricion/` y tiene pruebas unitarias.

## Conectar AWS Bedrock (IA real)

Sin credenciales el API funciona igual: el recomendador cae al **generador por reglas** y el plan se genera con el catálogo y las restricciones del paciente.

1. **Model access:** en la consola de Bedrock (la región que vayas a usar) pide acceso al modelo, por ejemplo Anthropic Claude 3.5 Sonnet.
2. **Variables de entorno** en `.env` (o en Railway):

   ```bash
   IA_HABILITADA=true
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
   ```

   La región y las credenciales salen de la cadena estándar de AWS (variables, perfil o rol de IAM). `BEDROCK_MODEL_ID` debe ser un ID de inferencia válido en esa región.
3. **Verificar** con la sesión de una nutricionista:

   - `GET /ia/estado` → `{ habilitado, modelo, region, ultimaLlamada }`. `habilitado` es `false` si `IA_HABILITADA=false` o si falta `BEDROCK_MODEL_ID`; `ultimaLlamada` es `null` hasta la primera llamada real.
   - `POST /ia/estado/probar` → envía una llamada mínima ("Responde OK", 16 tokens) y devuelve `{ ok: true }` o `{ ok: false, error }` sin lanzar error HTTP.

Para que una llamada lenta no cuelgue el request, el cliente usa timeout de conexión de 2 s y de request de 60 s, sin reintentos (el requestTimeout mide el socket inactivo y Converse sin streaming no envía nada hasta terminar); si se agota, la generación del plan sigue por reglas. Si la llamada falla, el portal ve un mensaje genérico y el detalle del proveedor queda solo en el log del servidor, porque puede incluir el ARN, la cuenta y el usuario de IAM.

## Correr en local

```bash
cp .env.example .env            # completar variables
docker compose up -d            # Postgres local
npm install                     # también genera el cliente de Prisma
npm run db:migrate -- --name init
npm run db:seed                 # restricciones + ~45 alimentos hondureños
npm run start:dev
```

- Swagger: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json
- Salud: `GET /`

### Documentación de la API

Swagger documenta cada endpoint con su resumen, parámetros, ejemplos, modelo de respuesta y errores (400, 401, 403, 404, 409 con el sobre `{ ok: false, error }` que se explica en [Respuestas y paginación](#respuestas-y-paginación)). Usa **Authorize** con un ID token de Firebase, o con `dev:<uid>:<correo>` en desarrollo.

`docs/openapi.json` tiene la especificación versionada; sirve para generar el cliente de la app. Para regenerarla:

```bash
npm run build && npm run openapi
```

### Probar sin Firebase

Con `AUTH_DEV_BYPASS=true` (se ignora en producción), cualquier petición acepta este encabezado:

```
Authorization: Bearer dev:<uid>:<correo>
```

Ejemplo: primero `POST /auth/registro-nutricionista` con `dev:nutri-1:sofia@demo.hn`; luego crea un paciente con correo `ana@demo.hn` y entra como `dev:pac-1:ana@demo.hn` para ver la app del paciente.

### Sesión en el cliente

El API **no emite ni renueva tokens**: solo verifica el ID token de Firebase en cada petición y no guarda refresh tokens. La sesión se mantiene del lado del cliente:

- **Portal web (Next.js):** `onAuthStateChanged` / `onIdTokenChanged` del SDK de Firebase; antes de una llamada, `await user.getIdToken()` (el SDK la renueva sola cuando le quedan menos de 5 minutos).
- **App móvil (Flutter):** `FirebaseAuth.instance.idTokenChanges()` y `await user.getIdToken()` por petición.

Con eso la sesión se mantiene indefinidamente sin que el backend tenga que rotar nada. La contrapartida, decidida a conciencia, es que **no se puede revocar una sesión desde el API**: para forzar un cierre hay que deshabilitar la cuenta en Firebase, que corta la renovación en la siguiente hora.

## Autenticación y roles

El API **no emite ni renueva tokens** ni guarda contraseñas: solo verifica el ID token de Firebase en cada petición. La cuenta la crea el cliente con el SDK de Firebase, por uno de dos caminos, y para el API los dos producen el mismo token:

| Flujo | Cómo se crea la cuenta | `email_verified` en el token |
|---|---|---|
| Google | `signInWithPopup` con `GoogleAuthProvider` (web) o el provider de Google (Flutter) | siempre `true`: Google ya confirmó el correo |
| Correo y contraseña | `createUserWithEmailAndPassword` + `sendEmailVerification` | `true` recién cuando el usuario abre el enlace del correo |

La consola de Firebase necesita dos ajustes para el flujo de correo:

- **Authentication → Sign-in method → Email/Password** habilitado.
- **Authentication → Settings → "One account per email address"** habilitado. Sin esto, quien se registra con correo y después entra con Google obtiene un `uid` distinto con el mismo correo: cae en `sin_perfil` y el registro le responde `409` porque el correo ya está tomado. Es un callejón sin salida.

Además, el dominio del portal tiene que estar en **Authentication → Settings → Authorized domains**; si no, el login con Google falla con `auth/unauthorized-domain`.

### Vinculación entre flujos

Vincular Google a una cuenta de correo y contraseña es **del lado del cliente**: `linkWithPopup(user, new GoogleAuthProvider())`. El `uid` no cambia, así que el `firebase_uid` guardado sigue siendo válido y el API no necesita ningún endpoint nuevo. Si el usuario no vincula y vuelve a entrar con Google, Firebase responde `auth/account-exists-with-different-credential` (con el ajuste de arriba) y la app decide si lo manda a vincular o a usar su método original.

### Roles

Un guard global resuelve el rol en cada petición:

- Si el `uid` pertenece a una nutricionista, el rol es `nutricionista`.
- Si pertenece a un paciente activo, el rol es `paciente`.
- En el primer inicio de sesión de un paciente, se vincula por **correo verificado** con el expediente que creó su nutricionista (guarda su `firebase_uid`).
- Si no coincide con nada, el rol es `sin_perfil`, que solo puede llamar a `GET /auth/me` y `POST /auth/registro-nutricionista`.

`GET /auth/me` devuelve `{ rol, perfil }`, y la app decide qué navegación mostrar según el rol.

### Registro de nutricionista

`POST /auth/registro-nutricionista` no crea usuarios de Firebase: crea el **perfil** de una cuenta que ya está logueada. El `uid` y el `correo` salen del token, nunca del body; el body solo lleva `nombre` (obligatorio), `colegiado` y `telefono`. El perfil es obligatorio para salir de `sin_perfil`.

El endpoint **exige el correo verificado** y responde `403 Verifica tu correo antes de registrar el perfil.` si no lo está. La razón: `correo` es `@unique`, y sin esa validación cualquiera podría reclamar el correo de otra persona y dejar a la dueña real sin poder registrarse.

En el cliente, antes de mostrar el formulario, conviene mirar `user.emailVerified` y ofrecer `sendEmailVerification()` en vez de dejar que el usuario llene todo para comerse un 403.

## Endpoints

| Rol | Método y ruta | Descripción |
|---|---|---|
| todos | `GET /auth/me` | Rol y perfil |
| sin perfil | `POST /auth/registro-nutricionista` | Crea el perfil de nutricionista (exige correo verificado) |
| nutricionista | `GET /dashboard` | Pacientes activos, borradores, citas de hoy |
| nutricionista | `GET/POST /pacientes`, `GET/PATCH/DELETE /pacientes/:id` | Expediente (el DELETE es baja lógica); acepta `condiciones` y devuelve condiciones, medicación vigente y las últimas mediciones |
| nutricionista | `GET /pacientes/:id/ficha` | Ficha completa en una llamada: cabecera con IMC clasificado, progreso contra el objetivo, situación clínica, requerimiento, adherencia de 30 días, alertas, evolución, consultas y planes |
| nutricionista | `POST /pacientes/:id/medicamentos`, `PATCH/DELETE /medicamentos/:id` | Medicación declarada (el DELETE es baja lógica: conserva el historial) |
| nutricionista | `GET/POST /pacientes/:id/mediciones`, `DELETE /mediciones/:id` | Peso, talla, % grasa, cintura (+ IMC) |
| nutricionista | `GET /pacientes/:id/requerimiento` | kcal y macros calculados |
| nutricionista | `GET /pacientes/:id/adherencia` | Diario del paciente y % de cumplimiento |
| nutricionista | `PUT/GET /pacientes/:id/registros` | Marcar o corregir comidas del paciente y auditar quién las marcó (`autor`) |
| nutricionista | `GET /pacientes/:id/planes`, `POST /pacientes/:id/planes/generar` | Planes y recomendador |
| nutricionista | `GET/PATCH/DELETE /planes/:id`, `PUT /planes/:id/tiempos/:tipo/items`, `POST /planes/:id/activar` | Editar y aprobar planes |
| nutricionista | `GET/POST /citas`, `PATCH /citas/:id` | Agenda (valida choques de horario) |
| nutricionista | `GET /ia/estado`, `POST /ia/estado/probar` | Estado de la IA y prueba de conexión con Bedrock |
| ambos | `GET /alimentos`, `GET /restricciones`, `GET /condiciones` | Catálogos (`?q=&categoria=&tipoComida=&excluir=lactosa,gluten`); los `codigo` de condiciones se usan al crear o actualizar pacientes |
| nutricionista | `POST/PATCH /alimentos` | Mantener el catálogo |
| paciente | `GET /me/hoy`, `GET /me/plan`, `GET /me/mediciones`, `GET /me/citas` | App del paciente |
| paciente | `PUT /me/registros`, `GET /me/registros` | Marcar comidas cumplidas |
| ambos | `POST/GET /me/dispositivos`, `DELETE /me/dispositivos/:token` | Registrar el dispositivo para push (token de FCM) y darlo de baja |

### Dispositivos y push

`POST /me/dispositivos` guarda el token que FCM le dio a la app, con su plataforma (`ANDROID`, `IOS` o `WEB`). La app lo vuelve a llamar en cada arranque de sesión, porque el token cambia cuando se reinstala.

- La clave es el **token**, no el usuario: repetir la llamada no duplica filas y refresca `ultimoUso`. Si el mismo celular se loguea con otra cuenta, el token **pasa a esa cuenta** en vez de quedar duplicado o huérfano.
- El dispositivo cuelga del **perfil** que hizo la llamada (`paciente` o `nutricionista`), con `onDelete: Cascade`: si se borra el perfil, sus dispositivos se van con él. Un `CHECK` en la migración impide las filas ambiguas (con los dos perfiles o con ninguno), porque Prisma no expresa esa restricción en el schema.
- El `rol` no es una columna: se deriva de cuál de los dos perfiles tiene valor, así que no puede contradecirse. El perfil lo resuelve el servidor desde el token de autenticación; mandar `rol` o `pacienteId` en el body da `400`.
- `DELETE /me/dispositivos/:token` filtra por token **y** dueño en la misma consulta, así que el token de otra cuenta responde `404` sin borrar nada y sin revelar si existe.
- Esta entrega **no envía notificaciones**. Es el corte 1 de la fase #25: deja el registro listo para que el envío por FCM (corte 2) tenga a quién mandarle.

### Ficha del paciente

`GET /pacientes/:id/ficha` arma la pantalla del expediente en **una** llamada. Los indicadores y las alertas se calculan en el backend porque son lógica de dominio, no de presentación:

- **Cabecera**: edad, IMC con clasificación de la OMS, y la composición corporal de la **última medición que la trae** (con su fecha), para que un control de peso sin bioimpedancia no borre el último % de grasa conocido. `masaMagraKg` sale del peso actual menos la masa grasa.
- **Progreso**: peso inicial, peso actual, diferencia, ritmo semanal y proyección a la fecha objetivo. La proyección es una extrapolación lineal y así se documenta: no es una promesa.
- **Situación clínica y hábitos**: condiciones, restricciones, medicación vigente, estado fisiológico, antecedentes y contexto de vida.
- **Requerimiento y adherencia**: kcal objetivo, TMB, gasto total y el cumplimiento de los últimos 30 días.
- **Alertas**: sin medición reciente (más de 30 días, grave después de 60), peso estancado (menos de 0.5 kg en las últimas tres mediciones, solo si la meta no es mantener), sin plan activo, plan activo con más de 90 días y adherencia por debajo del 50 % con al menos 10 registros.
- **Evolución, consultas y planes**: todas las mediciones con IMC, consultas pasadas con su SOAP y las próximas, y los planes con las tablas nutricionales con las que se calcularon.

Las alertas de nutrientes (sodio, carga glucémica) todavía no están: dependen de los umbrales por condición, que se definen como configuración clínica y no como constante escondida en el código.

## Respuestas y paginación

Toda respuesta JSON del API, incluidos `GET /` y `GET /dashboard`, viaja dentro de un mismo sobre: el cliente tiene un solo camino de parseo y decide si le fue bien mirando `ok`. `/docs` y `/docs-json` quedan afuera, son de Swagger y no del API.

### Éxito

```json
{ "ok": true, "data": { "id": "..." } }
```

`data` trae **exactamente lo mismo que el endpoint devolvía antes** del sobre: un objeto, un `null` o un array. Las listas paginadas mantienen las filas en `data` (sigue siendo un array) y la descripción de la página va aparte, en `meta`:

```json
{ "ok": true, "data": [ "..." ], "meta": { "limit": 20, "offset": 0, "total": 137, "hasMore": true } }
```

Las respuestas sin cuerpo (204) no se envuelven.

### Error

```json
{ "ok": false, "error": { "codigo": "NO_ENCONTRADO", "mensaje": "Paciente no encontrado." } }
```

El status HTTP **no cambia** (400, 401, 403, 404, 409, 500): lo que se lee para decidir es el `codigo`, porque es estable; el `mensaje` es para mostrar al usuario y puede cambiar. `detalles` sólo aparece cuando el fallo trae errores por campo.

| `codigo` | Cuándo |
|---|---|
| `VALIDACION` | Datos inválidos (400/422): pipe de validación, `limit` fuera de rango, `cursor` y `offset` juntos |
| `NO_AUTENTICADO` | Falta el token o no es válido (401) |
| `SIN_PERMISO` | El rol no alcanza o el correo no está verificado (403) |
| `NO_ENCONTRADO` | El recurso no existe o no te pertenece (404) |
| `CONFLICTO` | La operación choca con el estado actual (409) |
| `CURSOR_INVALIDO` | El cursor no corresponde a una fila de esa lista (400) |
| `ERROR_HTTP` | Cualquier otro 4xx que no tenga código propio |
| `ERROR_INTERNO` | Error inesperado (500); el detalle va al log, nunca al cliente |

### Paginación

Las listas paginadas aceptan dos modos y el cliente elige por query params. Nunca se mezclan: mandar `cursor` **y** `offset` responde `400 VALIDACION`.

**Modo web — `?limit=&offset=`** (lo que necesita un listado con paginador y número de páginas).

```json
{ "ok": true, "data": [ "..." ], "meta": { "limit": 20, "offset": 40, "total": 137, "hasMore": true } }
```

**Modo mobile — `?cursor=&limit=`** (scroll infinito).

```json
{ "ok": true, "data": [ "..." ], "meta": { "limit": 20, "nextCursor": "ZjQ3ZmYxYzIt", "hasMore": true } }
```

- `limit` por defecto **20**, máximo **100**. `offset` es base 0 y `limit` tiene que ser un entero entre 1 y 100; si no, `400 VALIDACION`.
- Sin `limit`, `offset` ni `cursor` la lista responde la **primera página** (equivale a `offset=0&limit=20`).
- `nextCursor` es opaco: se manda tal cual en la siguiente llamada y vale `null` en la última página. Si el cursor no es una fila de esa lista, responde `400 CURSOR_INVALIDO`.
- `total` sólo se calcula en modo offset. El modo cursor pide una fila extra para saber si hay siguiente y así no paga un `COUNT` en cada request del mobile.

Se paginan las listas que crecen sin techo:

| Lista |
|---|
| `GET /pacientes` |
| `GET /alimentos` |
| `GET /alimentos/{id}/versiones` |
| `GET /citas` |
| `GET /pacientes/{id}/planes` |
| `GET /pacientes/{id}/mediciones` |
| `GET /me/mediciones` |
| `GET /me/citas` |
| `GET /me/registros` |
| `GET /pacientes/{id}/registros` |

**No** se paginan los catálogos fijos (`GET /restricciones`, `GET /condiciones`) ni los endpoints de detalle (`GET /pacientes/{id}`, `GET /planes/{id}`, `GET /alimentos/{id}`, `GET /pacientes/{id}/ficha`): devuelven el objeto completo en `data`.

## Base de datos

Las tablas son `nutricionista`, `paciente`, `medicion`, `restriccion`, `paciente_restriccion` (N:M), `condicion`, `paciente_condicion` (N:M), `medicamento`, `cita`, `alimento`, `plan_alimenticio`, `tiempo_comida`, `plan_item` (N:M tiempo ↔ alimento con porciones) y `registro_comida`. Ver `prisma/schema.prisma`.

> Los valores nutricionales del seed son **aproximados** y sirven para desarrollo y demo. Antes de cualquier uso clínico hay que verificarlos contra la Tabla de Composición de Alimentos de Centroamérica (INCAP).

### Nutrientes clínicos

Cada alimento declara, **por porción** (igual que kcal y macros), además de `kcal`, `proteinaG`, `carbohidratoG` y `grasaG`:

| Campo | Unidad | Nota |
|---|---|---|
| `fibraG` | g | Sostiene las recomendaciones en prediabetes y dislipidemia |
| `azucaresG` | g | Incluye los azúcares naturales; nunca supera los carbohidratos |
| `grasasSatG` | g | Nunca supera la grasa total |
| `sodioMg` | mg | Clave en hipertensión |
| `potasioMg` | mg | Clave en enfermedad renal crónica |
| `fosforoMg` | mg | Clave en enfermedad renal crónica |
| `indiceGlucemico` | 0-110 | Nulo cuando la porción aporta menos de 2 g de carbohidratos |

`GET /alimentos` y `GET /alimentos/{id}` devuelven esos siete campos junto al resto de la porción (el esquema `AlimentoEntity` del OpenAPI los declara como numéricos y nullables), y `GET /alimentos/{id}/versiones` los repite en cada versión del historial.

Los totales del plan (`GET /planes/:id`, `GET /me/hoy`, `GET /me/plan`) suman todos esos nutrientes por tiempo de comida y por día, más la **carga glucémica** (índice glucémico × carbohidratos / 100 por alimento). Un nutriente sin dato aporta 0, así que el total es un **piso de lo conocido**, no una promesa: si un alimento no tiene el dato cargado, el total subestima.

El recomendador recibe estos valores por alimento en el catálogo del prompt, así que el agente puede razonar sobre sodio, potasio y carga glucémica al elegir los platos, además del perfil clínico del paciente.

### Versiones del catálogo

Los valores nutricionales son datos de referencia que cambian: revisiones del INCAP, leyes de fortificación (harina de trigo, sal yodada, azúcar con vitamina A), reformulación industrial y variedades nuevas. Por eso **no se editan en el pasado**: cada alimento tiene versiones.

- `alimento` guarda la identidad (nombre, categoría, tiempos de comida, restricciones) y una copia de los valores vigentes, para que el catálogo y el prompt sigan siendo una lectura simple.
- `alimento_version` guarda los valores con `version` (1, 2, 3…), `tabla` (por ejemplo `INCAP 2026`), `fuente`, `vigenteDesde` y `vigenteHasta`.
- Editar un valor de porción o de nutrición abre la versión siguiente y cierra la anterior. Editar solo el nombre no versiona.
- `GET /alimentos/:id/versiones` devuelve el historial, para ver qué cambió y cuándo.
- La revisión de la tabla se toma de `TABLA_NUTRICIONAL` (por defecto `Inicial`).

**Lo importante:** cada ítem de un plan (`plan_item.alimentoVersionId`) queda atado a la versión que usó. Los totales, la desviación y la ficha se calculan con esa versión, así que corregir un alimento **no cambia ningún plan existente**. Los ítems viejos sin versión siguen totalizando con el alimento actual (compatibilidad), por lo que conviene regenerar esos planes si su alimento se editó.

### Fechas y zonas horarias

Todo se guarda y se serializa en **UTC**; el cliente formatea para mostrar. Hay dos tipos de fecha y se tratan distinto:

| Tipo | Columnas | Regla |
|---|---|---|
| Solo fecha (`DATE`) | `paciente.fechaNacimiento`, `paciente.fechaObjetivo`, `medicion.fecha`, `cita.proximaCitaSugerida`, `registro_comida.fecha` | Se guardan como **medianoche UTC del día que envía el cliente** (`aFecha()`), sin convertir a la zona del servidor |
| Instante (`TIMESTAMP`) | `cita.fechaHora`, `creadoEn`, `actualizadoEn` | Instante UTC real; el cliente lo muestra en su zona (GMT-6 en Honduras) |

Un ISO con zona conserva el día de calendario que eligió la persona: `"2026-12-01T20:00:00-06:00"` se guarda como `2026-12-01T00:00:00Z`, **no** como el 2 de diciembre. Por eso las fechas de calendario nunca pasan por `new Date(iso)` directo: se usa `aFecha()` de `src/common/fechas.ts`, que está cubierta por `src/common/fechas.spec.ts`.

**Consecuencia a tener en cuenta:** la "fecha de hoy" del servidor es el día UTC, y en Honduras eso se adelanta a partir de las 18:00 (00:00 UTC). Para la pantalla "Hoy" y el registro de comidas, el cliente manda su fecha local en `GET /me/hoy?fecha=YYYY-MM-DD` y en `PUT /me/registros`; si no la manda, el API usa el día UTC. El Postgres del compose corre con `TZ=UTC` para que un `now()` no dependa del host.

## Pruebas

```bash
npm test          # unitarias (vitest)
npm run test:e2e  # arranque, Swagger y rutas protegidas
npm run test:cov  # cobertura de la lógica
```

Ninguna requiere base de datos: los servicios se prueban con `crearPrismaMock()` (`src/testing/prisma-mock.ts`), que simula cualquier `prisma.<modelo>.<método>`.

| Área | Qué se prueba |
|---|---|
| Nutrición | Mifflin-St Jeor, piso calórico, macros, IMC, generador por reglas y ajuste de porciones |
| Recomendador | Propuesta de la IA, descarte de alimentos inventados y respaldo por reglas |
| Auth | Resolución de rol, vinculación por correo verificado, `@Roles()` y modo de desarrollo |
| Pacientes | Búsqueda, restricciones, duplicados, aislamiento entre nutricionistas, requerimiento y adherencia |
| Planes | Totales y desviación, generación, edición, activación y archivado |
| Citas | Choques de horario, reprogramación y cancelación |
| App del paciente | Pantalla Hoy, plan activo y registro diario |

## Scripts

| Script | Acción |
|---|---|
| `npm run start:dev` | Desarrollo con recarga |
| `npm run build` / `npm run start:prod` | Compilar y correr |
| `npm test` / `npm run test:e2e` / `npm run test:cov` | Pruebas unitarias, e2e y cobertura (no requieren BD) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |
| `npm run openapi` | Exporta `docs/openapi.json` (después de `build`) |

## Integración continua

`.github/workflows/ci.yml` corre en cada push y en cada pull request:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run test:e2e`
5. `npm run build`

Ningún paso necesita base de datos: las pruebas unitarias usan dobles y el e2e levanta la app con una `DATABASE_URL` de mentira.

Si la rama es `main`, después del paso 5 el job `deploy` sube la imagen a Railway con `railway up --ci`. Ese `--ci` transmite solo el log del build y pone el job en rojo si el build falla; no espera a que la aplicación arranque, así que una migración o un arranque fallido se ve en el deploy de Railway, no en GitHub. En cualquier otra rama o en un pull request solo corre la validación.

## Deploy en Railway

La API corre en un servicio de Railway construido desde el `Dockerfile` del repo, con un servicio Postgres aparte. El contenedor corre `npx prisma migrate deploy` antes de arrancar `node dist/main.js`; si la migración falla, el contenedor no arranca y el deploy queda marcado como fallido en vez de servir tráfico con el esquema viejo.

**Una vez, a mano:**

1. Crear el proyecto en Railway con dos servicios: Postgres y la API.
2. En el servicio de la API, cargar las variables: `DATABASE_URL` (referencia al Postgres), `NODE_ENV=production`, `CORS_ORIGINS` con el dominio del portal, Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) y AWS (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_MODEL_ID`). `PORT` lo inyecta Railway.
3. En **Project Settings → Tokens** crear un **Project Token** y guardarlo en GitHub: *Settings → Secrets and variables → Actions* como secreto `RAILWAY_TOKEN`.
4. Si el servicio no se llama `baleadafit-api`, crear la variable de repositorio `RAILWAY_SERVICE` con su nombre (o su id).
5. Correr el seed una sola vez (`npm run db:seed`) apuntando `DATABASE_URL` a la base de Railway. Desde la máquina local la referencia interna (`*.railway.internal`) no resuelve: hay que usar `DATABASE_PUBLIC_URL`.

Después de eso, cada push a `main` que pase lint, pruebas y build despliega solo.

**Ajustes que no viven en el repo:**

- *Puerto del dominio*: el servicio escucha en el puerto que Railway inyecta en `PORT` (hoy 8080). El dominio de la API tiene que apuntar a ese mismo puerto; apuntando a otro, el edge contesta `502 Application failed to respond`.
- *Healthcheck path*: `/` (es el endpoint público que responde `{ servicio, estado }`).
- *Restart policy*: `ON_FAILURE`.
- Las migraciones corren al arrancar, así que el servicio está pensado para **una sola réplica**. Con dos o más, dos contenedores podrían migrar a la vez: en ese caso la migración se mueve al *Pre-Deploy Command* del dashboard (`npm run db:deploy`).

No se usa `railway.json` ni `railway.toml`: Railway deprecó Config as Code, los servicios nuevos ya no pueden adoptarlo y deja de leerse el 2026-12-01.
