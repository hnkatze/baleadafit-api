# CI en GitHub Actions y despliegue en Railway

La API corre en local y las pruebas son 162 unitarias + 8 e2e, pero nada las corre fuera de la máquina del dueño, no hay imagen reproducible y el "Deploy en Railway" del README son cuatro pasos a mano. Este feature agrega la cadena: GitHub Actions valida (lint, pruebas, build), y si la rama es `main` despliega con el CLI de Railway.

## Specs

- **S1** — "podemos prepara esto con ci": un workflow de GitHub Actions corre en cada push y en cada pull request `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`.
- **S2** — "para desplegarlo el railway": cuando la rama es `main` y los pasos de S1 pasan, el workflow despliega con `railway up --ci` usando un Project Token guardado en el secreto `RAILWAY_TOKEN` y el servicio en la variable `RAILWAY_SERVICE`.
- **S3** — El deploy no arranca si falla lint, una prueba o el build: el job de deploy depende del job de validación.
- **S4** — Las migraciones se aplican antes de arrancar el proceso: `npx prisma migrate deploy` corre al inicio del contenedor y, si falla, el contenedor no arranca.
- **S5** — La imagen es reproducible: `Dockerfile` multi-stage con Node 24, `npm ci`, `prisma generate`, `nest build`, `node dist/main.js`, escuchando el `PORT` que inyecta Railway.
- **S6** — Nada de lo existente se rompe: `npm run build`, `npm run start:prod`, `npm run start:dev`, `docker compose up -d` y las pruebas siguen igual.
- **S7** — El README documenta la cadena completa: qué corre en CI, qué secretos y variables hay que crear en GitHub y en Railway, y cómo correr el seed una sola vez.

## Tasks

- [x] R1 — `Dockerfile` + `.dockerignore` con migraciones al arrancar (S4, S5, S6) — commit `1131c66`
- [x] R2 — `.github/workflows/ci.yml` con validación y deploy a `main` (S1, S2, S3) — commit `aa7c450`
- [x] R3 — README: sección de deploy reescrita con la cadena real (S7) — este commit
- [x] R4 — Verificación local: build de producción + arranque + lint/pruebas/e2e (S6) — ver L7
- [x] R6 — Hallazgos del verificador independiente: schema-engine en la imagen, CI en cada push, `permissions`, README (S1, S4, S5) — ver L10 y L11
- [ ] R5 — Despliegue real en Railway — **bloqueada**: espera `railway login` del dueño, el proyecto creado y el secreto `RAILWAY_TOKEN` en GitHub (S2)

## Log

- **L1** (pedido del dueño, verbatim): "podemos prepara esto con ci para desplegarlo el railway pls ? y lo podemos desplegar en railway pls"
- **L2** (estado inicial verificado): no hay `.github/workflows`, no hay `Dockerfile` ni `railway.json`; el README tiene 4 pasos manuales para Railway. Base sana: `npm run lint` sin errores (6 warnings), `npm test` 162/162, `npm run test:e2e` 8/8, `GET /` es el endpoint público de salud.
- **L3** (decisión: sin `railway.json`): Railway deprecó Config as Code (`railway.json`/`railway.toml`); los servicios nuevos ya no pueden adoptarlo y deja de leerse el 2026-12-01. Se usa `Dockerfile`, que Railway siempre detecta, y los ajustes que no viven en el repo (healthcheck, comando de pre-deploy) quedan en el dashboard.
- **L4** (decisión: deploy por CLI, no autodeploy de GitHub): el dueño pidió CI que despliegue. Se sube con `railway up --ci`, así que el servicio en Railway no necesita tener el repo conectado y el deploy queda condicionado a que pasen lint, pruebas y build.
- **L5** (decisión: `npm ci --ignore-scripts` en la imagen): el `postinstall` del proyecto corre `prisma generate`, que necesita `prisma/schema.prisma`, y en la capa de dependencias todavía no se copió el schema. Se instala sin scripts y se genera explícitamente después de copiar el schema.
- **L6** (límite asumido): el contenedor corre las migraciones al arrancar, así que está pensado para una sola réplica. Con dos o más, dos contenedores podrían migrar a la vez; si algún día hay que escalar, la migración se mueve al pre-deploy del dashboard o a su propio job.
- **L7** (evidencia local de la imagen): en un directorio temporal con solo `package.json`, el lock, `prisma/`, `prisma.config.ts`, los tsconfig, `nest-cli.json` y `src/` se corrieron los pasos del Dockerfile uno por uno: `npm ci --ignore-scripts` (exit 0), `npx prisma generate` sin `DATABASE_URL` (exit 0), `npm run build` (exit 0, `dist/main.js` presente). Después `node dist/main.js` con `NODE_ENV=production PORT=3999` y sin `.env`: `GET /` → 200 `{"servicio":"baleadafit-api","estado":"ok"}`, `GET /docs-json` → 200, `GET /pacientes` sin token → 401. Base del repo sin tocar: `npm run lint` exit 0 (6 warnings), 162/162 unitarias, 8/8 e2e.
- **L8** (verificación que no se pudo correr): `docker build` no corrió porque Docker Desktop está apagado (el CLI responde, el daemon no). Lo que se verificó son los comandos que van dentro de la imagen, no el armado de las capas.
- **L9** (bloqueo del deploy): `railway whoami` responde "Your saved login is no longer valid". No hay proyecto ni Project Token, así que R5 no se puede ejecutar desde acá: lo que falta es del dueño (login + crear proyecto + pegar el token en GitHub).
- **L10** (defecto que encontró el verificador y que yo confirmé con evidencia): la primera versión de la imagen copiaba `node_modules` desde la etapa `deps`, que corre `npm ci --ignore-scripts`. Medido en un directorio temporal: después de `npm ci --ignore-scripts` hay **0** binarios `schema-engine-*` en `node_modules/@prisma/engines`; recién `npx prisma generate` lo baja (1 binario). O sea que el contenedor arrancaba sin el motor de migraciones y `prisma migrate deploy` lo habría tenido que descargar en caliente contra un `node_modules` de root, con `USER node`. Arreglo: la etapa de runtime copia `node_modules` **desde build** (que ya tiene el binario), todo con `--chown=node:node`, y el build termina con `ls node_modules/@prisma/engines/schema-engine-*` para romper ahí y no en el deploy. Re-verificado: `npm ci --ignore-scripts` + `npx prisma generate` + `npm run build` + la guarda → OK, y el arranque de producción sigue respondiendo `GET /` 200, `/docs-json` 200, `/pacientes` 401.
- **L11** (otros hallazgos del verificador, corregidos): el workflow filtraba push solo a `main` mientras S1 y el README decían "cada push" → ahora corre en todo push y en todo pull request, y el deploy sigue limitado a `main`; se agregó `permissions: contents: read`; `cancel-in-progress` ya no cancela pushes a `main` (cortar un `railway up` a mitad de subida deja el deploy a medias); se aclaró en el README que `--ci` solo cubre el build y que el seed desde la máquina local necesita `DATABASE_PUBLIC_URL`; se eliminó el chequeo muerto de `RAILWAY_SERVICE` (el valor por defecto del `||` lo volvía inalcanzable).
- **L12** (límite que queda): `docker build` y `railway up` no se corrieron en esta sesión (Docker Desktop apagado y CLI sin sesión). Lo verificado son los comandos que van dentro de la imagen, ejecutados uno por uno. El primer `docker build` real lo va a hacer Railway en el primer deploy.
