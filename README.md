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
- Salud: `GET /`

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
| ambos | `GET /alimentos`, `GET /restricciones` | Catálogo (`?q=&categoria=&tipoComida=&excluir=lactosa,gluten`) |
| nutricionista | `POST/PATCH /alimentos` | Mantener el catálogo |
| paciente | `GET /me/hoy`, `GET /me/plan`, `GET /me/mediciones`, `GET /me/citas` | App del paciente |
| paciente | `PUT /me/registros`, `GET /me/registros` | Marcar comidas cumplidas |

## Base de datos

Las tablas son `nutricionista`, `paciente`, `medicion`, `restriccion`, `paciente_restriccion` (N:M), `cita`, `alimento`, `plan_alimenticio`, `tiempo_comida`, `plan_item` (N:M tiempo ↔ alimento con porciones) y `registro_comida`. Ver `prisma/schema.prisma`.

> Los valores nutricionales del seed son **aproximados** y sirven para desarrollo y demo. Antes de cualquier uso clínico hay que verificarlos contra la Tabla de Composición de Alimentos de Centroamérica (INCAP).

## Scripts

| Script | Acción |
|---|---|
| `npm run start:dev` | Desarrollo con recarga |
| `npm run build` / `npm run start:prod` | Compilar y correr |
| `npm test` / `npm run test:e2e` | Pruebas unitarias / e2e (no requieren BD) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |

## Deploy en Railway

1. Crear un servicio Postgres y un servicio desde este repo.
2. Variables: `DATABASE_URL` (referencia al Postgres), Firebase, AWS, `NODE_ENV=production` y `CORS_ORIGINS`.
3. Build: `npm run build`. Start: `npm run db:deploy && npm run start:prod`.
4. Correr el seed una vez: `npm run db:seed`.
