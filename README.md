# BaleadaFit API

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

Swagger documenta cada endpoint con su resumen, parámetros, ejemplos, modelo de respuesta y errores (400, 401, 403, 404, 409 con formato `ErrorRespuesta`). Usa **Authorize** con un ID token de Firebase, o con `dev:<uid>:<correo>` en desarrollo.

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

## Autenticación y roles

Un guard global verifica el ID token de Firebase y resuelve el rol:

- Si el `uid` pertenece a una nutricionista, el rol es `nutricionista`.
- Si pertenece a un paciente, el rol es `paciente`.
- En el primer inicio de sesión de un paciente, se vincula por **correo verificado** con el expediente que creó su nutricionista.
- Si no coincide con nada, el rol es `sin_perfil` y solo puede llamar a `/auth/me` y `/auth/registro-nutricionista`.

`GET /auth/me` devuelve `{ rol, perfil }`, y la app decide qué navegación mostrar según el rol.

## Endpoints

| Rol | Método y ruta | Descripción |
|---|---|---|
| todos | `GET /auth/me` | Rol y perfil |
| sin perfil | `POST /auth/registro-nutricionista` | Crea el perfil de nutricionista |
| nutricionista | `GET /dashboard` | Pacientes activos, borradores, citas de hoy |
| nutricionista | `GET/POST /pacientes`, `GET/PATCH/DELETE /pacientes/:id` | Expediente (el DELETE es baja lógica) |
| nutricionista | `GET/POST /pacientes/:id/mediciones`, `DELETE /mediciones/:id` | Peso, talla, % grasa, cintura (+ IMC) |
| nutricionista | `GET /pacientes/:id/requerimiento` | kcal y macros calculados |
| nutricionista | `GET /pacientes/:id/adherencia` | Diario del paciente y % de cumplimiento |
| nutricionista | `GET /pacientes/:id/planes`, `POST /pacientes/:id/planes/generar` | Planes y recomendador |
| nutricionista | `GET/PATCH/DELETE /planes/:id`, `PUT /planes/:id/tiempos/:tipo/items`, `POST /planes/:id/activar` | Editar y aprobar planes |
| nutricionista | `GET/POST /citas`, `PATCH /citas/:id` | Agenda (valida choques de horario) |
| nutricionista | `GET /ia/estado`, `POST /ia/estado/probar` | Estado de la IA y prueba de conexión con Bedrock |
| ambos | `GET /alimentos`, `GET /restricciones` | Catálogo (`?q=&categoria=&tipoComida=&excluir=lactosa,gluten`) |
| nutricionista | `POST/PATCH /alimentos` | Mantener el catálogo |
| paciente | `GET /me/hoy`, `GET /me/plan`, `GET /me/mediciones`, `GET /me/citas` | App del paciente |
| paciente | `PUT /me/registros`, `GET /me/registros` | Marcar comidas cumplidas |

## Base de datos

Las tablas son `nutricionista`, `paciente`, `medicion`, `restriccion`, `paciente_restriccion` (N:M), `cita`, `alimento`, `plan_alimenticio`, `tiempo_comida`, `plan_item` (N:M tiempo ↔ alimento con porciones) y `registro_comida`. Ver `prisma/schema.prisma`.

> Los valores nutricionales del seed son **aproximados** y sirven para desarrollo y demo. Antes de cualquier uso clínico hay que verificarlos contra la Tabla de Composición de Alimentos de Centroamérica (INCAP).

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

## Deploy en Railway

1. Crear un servicio Postgres y un servicio desde este repo.
2. Variables: `DATABASE_URL` (referencia al Postgres), Firebase, AWS, `NODE_ENV=production` y `CORS_ORIGINS`.
3. Build: `npm run build`. Start: `npm run db:deploy && npm run start:prod`.
4. Correr el seed una vez: `npm run db:seed`.
