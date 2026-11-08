# Plan alimenticio semanal

El recomendador arma hoy planes de **un día**: schema, prompt, motor de reglas y persistencia asumen un solo conjunto de 5 tiempos. El dueño necesita que cubra **los siete días de la semana** con el mismo catálogo y el mismo expediente que ya existen, y necesita que el plan sea **clínicamente seguro y variado**, no solo plausible. Este feature agrega la dimensión día y el motor que garantiza esas dos cosas.

## Specs

- **S1** — El plan cubre los siete días de la semana, no un día suelto. Incluye la dimensión día en el schema, el contrato del recomendador, el prompt, el motor de reglas, la persistencia y la API.
- **S2** — La recomendación usa el catálogo existente (`Alimento`, ~150 filas del seed); no se crea un catálogo paralelo y el modelo no inventa alimentos: solo elige `alimentoId` del conjunto recibido.
- **S3** — La recomendación se basa en los parámetros del paciente: el expediente ya integrado en `PerfilClinico` (antropometría, condiciones con su descripción, estado fisiológico, alergias, medicación, hábitos incluido presupuesto y quién cocina, objetivo pactado).
- **S4** — El filtro de restricciones sigue resolviéndose **en la base de datos** (`AlimentosService.catalogoParaPaciente`); el modelo elige solo dentro de ese conjunto filtrado. Ninguna restricción de alergia depende del criterio del modelo.
- **S5** — El plan semanal garantiza variedad **controlada en código**: techo de apariciones por alimento, mínimo de fuentes proteicas distintas en la semana y no repetición del mismo plato típico en días consecutivos.
- **S6** — Las condiciones clínicas verificables con los nutrientes del catálogo (sodio, potasio, fósforo, índice glucémico) se aplican en código, no solo en el prompt. Habilita el cierre de C4 en `recomendador-contexto-clinico.md`.
- **S7** — La salida del modelo se valida con esquema estricto antes de persistir. Ningún JSON del modelo llega a la base con un cast sin verificar.
- **S8** — Si la IA no está disponible, cada día se arma por reglas y el plan semanal no se rompe ni queda incompleto.
- **S9** — El despliegue sigue en Railway y AWS se usa solo para Bedrock: no se agrega AgentCore Runtime, ni compute propio, ni un servicio nuevo.

## Tasks

- [x] **T1** — Migración: campo `dia` (`DiaSemana`, default `LUNES`) en `TiempoComida` y único relajado a `[planId, dia, tipo]` — S1 — inline — `Risk: item 1` — aplicada con `prisma migrate deploy` y verificada contra Postgres real — commit: pendiente
- [ ] **T2** — Contrato multi-día en `RecomendadorService` / `ResultadoRecomendador` — S1 — inline — commit: pendiente
- [ ] **T3** — Prompt de semana y presupuesto de tokens (`maxTokens` 3000 no alcanza para 35 slots; evaluar recorte de catálogo y prompt caching) — S1, S3 — inline — commit: pendiente
- [ ] **T4** — Validación estricta de la salida del modelo (esquema + reparación) — S7 — inline — commit: pendiente
- [ ] **T5** — Motor de reglas clínicas por condición usando sodio/potasio/fósforo/IG — S6 — inline — `Risk: item 6` (si no hay test, la regla clínica no está probada) — commit: pendiente
- [ ] **T6** — Motor de variedad semanal (techos, rotación, proteicas distintas) — S5 — inline — commit: pendiente
- [ ] **T7** — Fallback por día: un día ilegible no tumba la semana — S8 — inline — commit: pendiente
- [ ] **T8** — Persistencia y endpoints por (día, tiempo); revisar `PATCH planes/:id` y `reemplazarItems` — S1 — inline — commit: pendiente
- [ ] **T9** — Verificación end-to-end (IA disponible y no disponible) + documentación — S1..S9 — inline — commit: pendiente

## Log

- **L1** (pedido del dueño, verbatim): "el agente me ayudaria en base a los parametros del paciente a recomendar los alimentos para el paciente de los dias de la semana y eso"
- **L2** (dato de partida, verbatim): "yo ya tengo un catalogo de alimentos, montado"
- **L3** (define el valor del feature, verbatim): "la parte mas dificil de un nutricionista es disenar los planes alimenticios, y eso seria el plus de esto"
- **L4** (decisión de arquitectura): ante la pregunta "ok lo de agent core se hace aparte ? un nuevo directorio baleadafit-agentcore o dentro del api ?" se resolvió **no usar AgentCore** en este feature y **no crear** `baleadafit-agentcore`. El feature vive dentro del API, donde ya están catálogo, paciente, restricciones y persistencia. Motivo: no hay bucle de agente, ni elección de tools, ni memoria entre sesiones que justifiquen un servicio aparte.
- **L5** (restricción de despliegue, verbatim): "si ocupamos desplegar algo seria en railway y lo que ocupemos en aws, porque los ecs son caros en aws jajaj" → S9. Dato verificado: AgentCore Runtime no es ECS, es microVM serverless con precio por consumo, y `agentcore dev` corre local con Docker; aun así no hace falta para este feature.
- **L6** (hallazgo que motiva S7): `bedrock.service.ts:161` hace `JSON.parse` y castea `as T` sin validar; `recomendador.service.ts:130-152` repara a mano (id existente, dedupe, porciones 0.5-4, slot vacío por reglas). Con 5 slots es tolerable; con 35 y un JSON truncado, no.
- **L7** (hallazgo que motiva S6 y contradice el doc anterior): el catálogo **sí** tiene `sodioMg`, `potasioMg`, `fosforoMg` (`schema.prisma:320-324`) e `indiceGlucemico` (`:330`), y `prisma/seed.ts` los carga 154 veces sobre ~150 alimentos. Son nullable, así que el motor de reglas debe manejar nulos. L4 de `recomendador-contexto-clinico.md` es incorrecto.
- **L8** (hallazgo que motiva S1): no existe dimensión día en ningún nivel. `@@unique([planId, tipo])` (`schema.prisma:423`) prohíbe 7×5 filas por plan; `fecha` solo existe en `RegistroComida` (`:444`) para adherencia; el prompt dice literalmente `'Armas planes alimenticios de un día'` (`recomendador.service.ts:176`); `generarPlanPorReglas` (`generador-reglas.ts:236-256`) también devuelve un día.
- **L9** (decisión abierta, no cerrada): una llamada al modelo **por día** (7 llamadas, con la lista de alimentos ya usados para forzar variedad) versus **una sola llamada semanal** con esquema compacto y `maxTokens` mayor. Recomendación del agente: por día, porque el truncado deja de ser un riesgo y la variedad se vuelve controlable en código. El dueño todavía no respondió.
- **L10** (bloqueo externo, abierto): el usuario IAM `baleadafit-app` recibe `Model use case details have not been submitted for this account` al invocar Anthropic. `get-use-case-for-model-access` confirma que el formulario de caso de uso nunca se envió; con root la invocación funciona. Se desbloquea con `put-use-case-for-model-access` (o desde la consola de Bedrock → Model access). No bloquea el desarrollo local probado con root.
- **L11** (resuelto, reemplaza la apertura de L10): el bloqueo tenía dos causas, no una. (a) el formulario FTU nunca se envió y `intendedUsers` debe ser **numérico** (`"0"` = interno), no prosa; (b) faltaba además el **agreement de AWS Marketplace** por modelo (`agreementAvailability: NOT_AVAILABLE` con `entitlement: AVAILABLE`). Creados los agreements de haiku-4-5, sonnet-4-6 y sonnet-4-5, activaron a los ~6 minutos y el usuario acotado `baleadafit-app` invoca correctamente. Verificado también que `s3` e `iam` le siguen dando `AccessDenied`.
- **L12** (cierra L9, medido): una sola llamada semanal **no** trunca (≈1.800 tokens de salida para 7×5 slots) y los tres modelos devuelven JSON válido con 7/7 días y 0 ids inventados. Pero **los tres fallan el rango calórico** (Nova 7/7 días, Sonnet 6/7) y Nova Lite **repite el alimento principal en 5 de 7 días consecutivos** mientras los Claude no repiten ninguno. Decisión: **una llamada semanal con Sonnet 4.6** (~$0.036–0.05 por plan; 7 llamadas diarias costarían ~$0.20), Nova Lite para desarrollo, y regeneración por día solo de los días que fallen la validación. La aritmética queda en código: `reglas-clinicas.ts` y `validacion-plan.ts`.
- **L13** (evidencia de T1): migración `20261108120000_plan_semanal_dia` aplicada contra Postgres 16 real. `\d tiempo_comida` muestra `dia "DiaSemana" NOT NULL DEFAULT 'LUNES'` y el único `tiempo_comida_plan_id_dia_tipo_key (plan_id, dia, tipo)`; el índice viejo `tiempo_comida_plan_id_tipo_key` ya no existe. `prisma migrate status`: "Database schema is up to date". Suite 243/243, lint sin warnings nuevos, `nest build` OK. La tabla tenía 0 filas, así que el backfill no tocó datos.
- **L14** (límite honesto de T1): los umbrales de `LIMITES_DIARIOS` (sodio 2000 mg, potasio 3000 mg, fósforo 1000 mg, IG promedio 55) son valores de referencia elegidos en implementación. Los tests prueban que el código los aplica, no que sean los correctos para cada paciente: requieren revisión clínica antes de producción.
