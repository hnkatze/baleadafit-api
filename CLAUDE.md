# BaleadaFit API

Contexto completo del proyecto (alcance, modelo de datos, reglas de negocio, backlog): **`docs/CONTEXTO.md`**. Léelo antes de cambiar algo.

## Reglas rápidas

- NestJS 12 en **ESM**: los imports relativos llevan `.js` (`./x.js`).
- Prisma 7: el cliente se genera en `src/generated/prisma` (no se versiona). Los enums se importan de `../generated/prisma/enums.js`.
- DTO en `*.dto.ts` y respuestas en `*.entity.ts` (el plugin de Swagger solo lee esos sufijos). Cada endpoint lleva `@ApiOperation`, la respuesta tipada y `@ApiErrores(...)`.
- Los recursos de una nutricionista se validan con `AccesoService` (404 si no le pertenecen).
- Cada servicio lleva su `*.spec.ts`, con `crearPrismaMock()` de `src/testing/prisma-mock.ts`.
- Todo en español: código, mensajes y docs.

## Antes de hacer commit

```bash
npm run lint && npm test && npm run test:e2e && npm run build
```

Si cambian endpoints o DTO: `npm run openapi` y versionar `docs/openapi.json`.

## Git

- Commits con el usuario del autor, **sin co-autores ni atribución de agentes**.
- Commits pequeños por parte lógica, en formato Conventional Commits en español (`feat(planes): …`).
- `Refs #n` en commits intermedios y `Closes #n` en el que termina el issue.
