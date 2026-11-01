# BaleadaFit — Contexto del proyecto

Documento de referencia para trabajar en la API: qué se construyó, cómo está organizado, qué decisiones se tomaron y qué falta por hacer.

> Estado al 29 de octubre de 2026 · 27 commits en `main` · 16 de 26 issues de la API cerrados.

---

## 1. Qué es BaleadaFit

Plataforma de **nutrición clínica basada en comida hondureña**. La nutricionista arma planes con platos típicos (baleadas, casamiento, sopa de frijoles…) en lugar de dietas importadas, y el paciente los sigue desde el celular.

- **Clase:** 769 Ingeniería de Software I — CEUTEC · Ing. Mario Nones
- **Alumno:** Hector Camilo Henriquez Flores (41611213)
- **Entregable de la clase:** una **app móvil Flutter con dos roles**, respaldada por esta API. El docente pidió que el backoffice de la nutricionista sea móvil, así que la web quedó fuera de la clase.

### Alcance del MVP

| Incluido | Fuera (fase futura) |
|---|---|
| Login con Firebase y roles | Notificaciones push (FCM) |
| Expediente: pacientes, restricciones y mediciones | Auditoría de comidas por foto (S3 + Rekognition) |
| Catálogo de alimentos hondureños | Portal web (uso personal, no de la clase) |
| Recomendador de dietas híbrido (reglas + AWS Bedrock) | |
| Edición y aprobación de planes | |
| Agenda de citas | |
| App del paciente: plan de hoy, registro de comidas, progreso y citas | |

---

## 2. Repositorios y tablero

| Repo | Contenido | Estado |
|---|---|---|
| [`hnkatze/baleadafit-api`](https://github.com/hnkatze/baleadafit-api) | NestJS + Prisma + PostgreSQL | Base completa, con pruebas y Swagger |
| [`hnkatze/baleadafit-app`](https://github.com/hnkatze/baleadafit-app) | Flutter, una app con dos roles | Vacío, backlog listo |
| [`hnkatze/baleadafit-web`](https://github.com/hnkatze/baleadafit-web) | Next.js, portal personal | Vacío, backlog listo |

**Tablero:** proyecto **Baleadafit** (#6) en el perfil de `hnkatze`, con tres vistas:
- **Board:** Todo / In Progress / Done.
- **Roadmap:** usa el campo de iteración **Sprint**.
- **Table:** ordenada por sprint.

### Sprints

| Sprint | Fechas | Enfoque |
|---|---|---|
| Sprint 1 · Base | 26 oct – 8 nov | Repos, BD, auth, entorno |
| Sprint 2 · Expediente | 9 – 22 nov | Pacientes, mediciones, catálogo, despliegue |
| Sprint 3 · Recomendador | 23 nov – 6 dic | Requerimiento, recomendador, planes |
| Sprint 4 · Cierre y demo | 7 – 20 dic | Agenda, app del paciente, pruebas, demo |

Cada sprint existe como milestone en `api` y `app`, y como iteración en el proyecto. **Las fechas son supuestas: ajustarlas al calendario real de la clase.** La iteración 4 quedó con el nombre "Sprint 4" porque GitHub no guardó el nombre largo.

---

## 3. Arquitectura

```
Flutter (2 roles) ──HTTP + ID token──▶ NestJS API ──Prisma──▶ PostgreSQL (Railway)
                                          │
                                          ├── Firebase Admin: verifica tokens
                                          └── AWS Bedrock: propone planes
```

- La app **nunca** toca la base de datos: todo pasa por la API.
- **Postgres** guarda todos los datos clínicos. **Firebase** solo maneja la identidad (y FCM en el futuro). **AWS** se usa solo para la IA.
- No se usa Firestore, para no duplicar datos.

### Stack de la API

| Pieza | Versión / nota |
|---|---|
| NestJS | 12, TypeScript, **ESM** (`"type": "module"`) |
| Prisma | 7 con `@prisma/adapter-pg`; el cliente se genera en `src/generated/prisma` |
| Pruebas | vitest (unitarias + e2e) |
| Lint / formato | oxlint + prettier |
| Swagger | `@nestjs/swagger` con el plugin del CLI |
| Auth | `firebase-admin` |
| IA | `@aws-sdk/client-bedrock-runtime` (Converse API) |

---

## 4. Estructura del repo

```
prisma/
  schema.prisma        modelo de datos
  seed.ts              6 restricciones + 45 alimentos hondureños
src/
  main.ts              arranque: CORS, ValidationPipe, Swagger
  app.module.ts        registra los módulos
  openapi.ts           exporta docs/openapi.json
  common/
    acceso.service.ts  verifica que paciente/plan pertenezcan a la nutricionista
    fechas.ts          helpers de fechas (columnas DATE en UTC)
    swagger.ts         configuración, ErrorRespuesta y @ApiErrores()
  auth/                guard global, roles, Firebase, /auth/me, registro
  pacientes/           expediente, mediciones, requerimiento, adherencia
  alimentos/           catálogo y restricciones
  nutricion/           lógica pura: Mifflin-St Jeor y generador por reglas
  ia/                  cliente de Bedrock
  planes/              recomendador híbrido y gestión de planes
  citas/               agenda con validación de choques
  mi-cuenta/           endpoints /me del paciente
  dashboard/           GET / (salud) y /dashboard
  testing/             crearPrismaMock() para pruebas
  generated/           cliente de Prisma (ignorado por git)
test/app.e2e-spec.ts   arranque, Swagger y rutas protegidas
docs/openapi.json      especificación versionada
```

Cada módulo sigue la misma forma: `*.dto.ts` (entrada, con validaciones), `*.entity.ts` (modelos de respuesta, solo para Swagger), `*.service.ts`, `*.controller.ts`, `*.module.ts` y `*.spec.ts`.

---

## 5. Modelo de datos

| Tabla | Para qué | Relaciones |
|---|---|---|
| `nutricionista` | Usuario profesional (`firebase_uid` único) | 1:N paciente, cita, plan |
| `paciente` | Expediente; `firebase_uid` es null hasta su primer inicio de sesión | N:1 nutricionista |
| `medicion` | Peso, talla, % grasa, cintura por fecha | N:1 paciente |
| `restriccion` | Catálogo de restricciones (`codigo`: lactosa, gluten…) | — |
| `paciente_restriccion` | Intermedia N:M | paciente ↔ restriccion |
| `cita` | Agenda (`PROGRAMADA`, `COMPLETADA`, `CANCELADA`) | N:1 paciente y nutricionista |
| `alimento` | Catálogo con macros **por porción**, `tipos_comida[]` y `contiene[]` | — |
| `plan_alimenticio` | Meta de kcal y macros, estado (`BORRADOR`, `ACTIVO`, `ARCHIVADO`) y origen (`MANUAL`, `REGLAS`, `IA`) | N:1 paciente |
| `tiempo_comida` | Desayuno, merienda AM, almuerzo, merienda PM, cena, con `% kcal` | N:1 plan, único (plan, tipo) |
| `plan_item` | Intermedia N:M con `porciones` | tiempo_comida ↔ alimento |
| `registro_comida` | Diario del paciente: ¿cumplió este tiempo de comida este día? | único (paciente, tiempo, fecha) |

**Restricciones del catálogo:** cada alimento declara en `contiene[]` las etiquetas que tiene, por ejemplo `['gluten','lactosa']`. El paciente tiene códigos de restricción, y el catálogo apto excluye los alimentos que contengan alguno.

---

## 6. Reglas de negocio

### Autenticación y roles (`src/auth`)
- El guard es **global**: toda ruta requiere `Authorization: Bearer <ID token>`, salvo las marcadas con `@Public()`.
- El rol se resuelve así:
  1. Si el `uid` es de una nutricionista, el rol es `nutricionista`.
  2. Si es de un paciente activo, el rol es `paciente`.
  3. Si el correo está verificado y coincide con un paciente sin `firebase_uid`, se **vincula** y el rol es `paciente`.
  4. Si nada coincide, el rol es `sin_perfil`.
- `@Roles('nutricionista')` restringe el acceso. Sin ese decorador basta con estar autenticado.
- `GET /auth/me` es la primera llamada de la app y decide la navegación según `rol`.
- **Modo dev:** con `AUTH_DEV_BYPASS=true` (se ignora en producción) se acepta `Bearer dev:<uid>:<correo>`.

### Aislamiento
Una nutricionista **solo** ve a sus pacientes y planes. `AccesoService` responde 404, no 403, para no revelar que el recurso existe.

### Requerimiento (`src/nutricion/nutricion.util.ts`)
- **TMB (Mifflin-St Jeor):** `10·peso + 6.25·talla − 5·edad + 5 (H) / −161 (M)`.
- **Factor de actividad:** 1.2 / 1.375 / 1.55 / 1.725 / 1.9.
- **Ajuste por meta:** −500 para bajar, 0 para mantener, +300 para subir. Hay un piso de 1200 kcal (mujer) y 1500 (hombre), y el resultado se redondea a decenas.
- **Macros por defecto:** 25 % proteína, 50 % carbohidratos, 25 % grasa.
- **Reparto por tiempo de comida por defecto:** desayuno 25 %, merienda AM 10 %, almuerzo 35 %, merienda PM 10 %, cena 20 %.

### Recomendador híbrido (`src/planes/recomendador.service.ts`)
1. NestJS calcula kcal y macros.
2. Filtra el catálogo por las restricciones del paciente.
3. Bedrock recibe el catálogo (con ids) y devuelve JSON con `alimentoId` y `porciones` por tiempo de comida.
4. El backend **descarta ids que no existan**, redondea a cuartos de porción y ajusta a **±10 %** de la meta de cada tiempo.
5. Si un tiempo queda vacío, se completa por reglas. Si la IA falla o no está configurada, todo el plan se hace por reglas.
6. El plan se crea en `BORRADOR`. Al **activarlo**, el plan activo anterior pasa a `ARCHIVADO`. Solo los borradores se pueden eliminar, y los archivados no se editan.

### Citas
Al crear o reprogramar una cita se valida que no choque con otra `PROGRAMADA` de la misma nutricionista (responde 409). Cancelar una cita no revisa choques.

### App del paciente (`/me`)
Solo lectura de sus propios datos. La única escritura es `PUT /me/registros`, que hace un upsert del día por tiempo de comida.

---

## 7. Correr en local

```bash
cp .env.example .env
docker compose up -d                 # Postgres 16
npm install                          # genera el cliente de Prisma
npm run db:migrate -- --name init    # issue #17 (la migración aún no existe)
npm run db:seed
npm run start:dev                    # http://localhost:3000/docs
```

Para probar sin Firebase: `AUTH_DEV_BYPASS=true` en `.env`.
1. `POST /auth/registro-nutricionista` con `Bearer dev:nutri-1:sofia@demo.hn`.
2. Crea un paciente con `correo: ana@demo.hn`.
3. Entra como `Bearer dev:pac-1:ana@demo.hn` para usar las rutas `/me`.

| Comando | Para qué |
|---|---|
| `npm test` | 79 pruebas unitarias |
| `npm run test:e2e` | 8 pruebas e2e (sin BD) |
| `npm run test:cov` | Cobertura de la lógica (~86 % de líneas) |
| `npm run lint` | oxlint |
| `npm run build && npm run openapi` | Regenera `docs/openapi.json` |

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Cuenta de servicio (la llave en una línea, con `\n`) |
| `AUTH_DEV_BYPASS` | `true` solo en desarrollo |
| `IA_HABILITADA`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_MODEL_ID` | Recomendador con IA; sin `BEDROCK_MODEL_ID` usa reglas |
| `CORS_ORIGINS` | Lista separada por comas; vacío permite todos |

---

## 8. Convenciones

### Código
- **Imports ESM con extensión `.js`**, aunque el archivo sea `.ts`: `import { X } from './x.js'`.
- **Enums de Prisma** se importan de `../generated/prisma/enums.js` y el cliente de `../generated/prisma/client.js`.
- **Swagger:** el plugin solo lee archivos `*.dto.ts` y `*.entity.ts`. Los comentarios JSDoc y `@example` se convierten en descripción y ejemplo. Cada endpoint lleva:
  - `@ApiOperation({ summary, description })`
  - la respuesta tipada (`@ApiOkResponse({ type })`)
  - `@ApiErrores(...)` con los códigos que puede devolver.
- **Errores** con las excepciones de Nest y mensajes en español.
- **Pruebas:** los servicios se prueban con `crearPrismaMock()`, sin base de datos. Cada servicio nuevo lleva su `*.spec.ts`.
- Todo (nombres, mensajes y documentación) va en **español**.

### Git
- Commits **con tu usuario, sin co-autores ni atribución de agentes**.
- **Commits pequeños por parte lógica**: nada de un commit gigante con muchos archivos.
- Formato Conventional Commits en español: `feat(planes): …`, `fix(auth): …`, `test(citas): …`, `docs: …`, `chore: …`.
- Enlazar issues en el mensaje: `Refs #n` en los commits intermedios y `Closes #n` en el que lo termina.

---

## 9. Backlog de la API

### Cerrados (16)

| # | Issue | Sprint |
|---|---|---|
| 1 | Configurar proyecto base de NestJS | S1 |
| 2 | Diseñar esquema de base de datos con Prisma | S1 |
| 3 | Seed de restricciones y alimentos hondureños | S2 |
| 4 | Cálculo de requerimiento calórico (Mifflin-St Jeor) | S3 |
| 5 | Generador de planes por reglas | S3 |
| 6 | Autenticación con Firebase y roles | S1 |
| 7 | Módulo de pacientes y mediciones | S2 |
| 8 | Catálogo de alimentos y restricciones | S2 |
| 9 | Integración con AWS Bedrock | S3 |
| 10 | Recomendador híbrido y gestión de planes | S3 |
| 11 | Agenda de citas | S4 |
| 12 | Endpoints de la app del paciente (/me) | S4 |
| 13 | Dashboard de la nutricionista y health check | S2 |
| 14 | Documentar el proyecto en el README | S1 |
| 15 | Documentación completa en Swagger | S1 |
| 16 | Pruebas unitarias de servicios y guard | S2 |

### Pendientes, en orden sugerido

**#17 · Generar migración inicial de Prisma** (S1, base de datos)
- `npm run db:migrate -- --name init` con Postgres arriba, y versionar `prisma/migrations/`.
- Confirmar que `npm run db:seed` corre sobre la base migrada.
- No se pudo generar en el entorno donde se armó la API porque el motor de migraciones estaba bloqueado, así que este es el primer paso.

**#18 · Configurar proyecto de Firebase** (S1, infraestructura)
- Crear el proyecto, habilitar Auth por correo y descargar la cuenta de servicio para llenar `FIREBASE_*`.
- Probar `GET /auth/me` con un ID token real.
- Requisito: los pacientes deben **verificar el correo** para que funcione la vinculación automática.

**#19 · Desplegar API y PostgreSQL en Railway** (S2, infraestructura)
- Servicio Postgres más servicio desde el repo. Build `npm run build`; start `npm run db:deploy && npm run start:prod`.
- Variables: `DATABASE_URL` (referencia), `FIREBASE_*`, AWS, `NODE_ENV=production` y `CORS_ORIGINS`.
- Correr el seed una vez. La app necesita esta URL para todo lo demás.

**#20 · Integración continua con GitHub Actions** (S2, infraestructura y pruebas)
- Workflow en push y PR: `npm ci`, `npx prisma generate`, `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`.
- Agregar el badge al README.

**#22 · Verificar valores nutricionales del seed con INCAP** (S2, base de datos)
- Los 45 alimentos de `prisma/seed.ts` tienen valores **aproximados**.
- Contrastarlos con la Tabla de Composición de Alimentos de Centroamérica y actualizar el campo `fuente`.

**#21 · Probar Bedrock con credenciales reales y ajustar el prompt** (S3, ia)
- Habilitar un modelo en Bedrock (Model access), poner `BEDROCK_MODEL_ID` y probar `POST /pacientes/{id}/planes/generar` con 3 perfiles distintos.
- Ajustar el prompt en `RecomendadorService.promptSistema()` y `promptUsuario()`.
- El código solo se probó con la IA simulada.

**#23 · Mensajes de validación en español** (S4)
- class-validator responde en inglés. Agregar `message` en los decoradores o un `exceptionFactory` en el `ValidationPipe`.

**#24 · Endurecer seguridad de la API** (S4, infraestructura)
- `helmet`, rate limiting (`@nestjs/throttler`) y `CORS_ORIGINS` obligatorio en producción.

**#25 · Notificaciones push con FCM** y **#26 · Auditoría de comidas por foto**: fase futura.

---

## 10. Lo que la app necesita de la API

Referencia para no romper el contrato. El esquema completo está en `docs/openapi.json` y en `/docs`.

| Issue de la app | Endpoints |
|---|---|
| #3 Cliente HTTP | Todos, con `Authorization: Bearer <ID token>` |
| #4 Login y rol | `GET /auth/me` |
| #5 Registro de nutricionista | `POST /auth/registro-nutricionista` |
| #6 Inicio de la nutricionista | `GET /dashboard` |
| #7 Lista de pacientes | `GET /pacientes?q=` |
| #8 Crear/editar paciente | `POST /pacientes`, `PATCH /pacientes/{id}`, `DELETE /pacientes/{id}`, `GET /restricciones` |
| #9 Expediente y mediciones | `GET /pacientes/{id}`, `GET/POST /pacientes/{id}/mediciones`, `GET /pacientes/{id}/requerimiento`, `GET /pacientes/{id}/adherencia` |
| #10 Catálogo | `GET /alimentos`, `POST/PATCH /alimentos` |
| #11 Generar plan | `POST /pacientes/{id}/planes/generar` |
| #12 Editar y aprobar plan | `GET/PATCH /planes/{id}`, `PUT /planes/{id}/tiempos/{tipo}/items`, `POST /planes/{id}/activar`, `DELETE /planes/{id}` |
| #13 Agenda | `GET/POST /citas`, `PATCH /citas/{id}` |
| #14 Hoy del paciente | `GET /me/hoy`, `PUT /me/registros` |
| #15 Mi plan | `GET /me/plan` |
| #16 Progreso | `GET /me/mediciones` |
| #17 Citas y perfil | `GET /me/citas`, `GET /auth/me` |

Backlog completo de la app: 21 issues (S1: base, tema, cliente, login, onboarding · S2: inicio, pacientes, formulario, expediente, catálogo · S3: generar y editar plan, Hoy, Mi plan · S4: agenda, progreso, citas/perfil, pruebas, APK · futuro: push y foto).

Backlog de la web (fuera de la clase): 8 issues en el milestone "Portal web v1".

---

## 11. Decisiones y pendientes abiertos

**Decidido**
- Una app Flutter con dos roles, sin duplicar el backoffice en otra app.
- El recomendador es híbrido: el cálculo es determinista en el backend y la IA solo elige platos del catálogo.
- Las porciones van en cuartos, con tolerancia de ±10 % por tiempo de comida.
- Baja lógica de pacientes (`activo = false`) para conservar el historial.

**Por confirmar**
- Fechas reales de los sprints según el calendario de la clase.
- Qué modelo de Bedrock usar (depende de lo que esté habilitado en tu cuenta de AWS).
- Si la presentación de la semana 2 se actualiza: todavía muestra Next.js como portal del MVP, y ahora el MVP es la app Flutter de dos roles.
