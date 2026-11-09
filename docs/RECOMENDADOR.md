# El recomendador de BaleadaFit, explicado

Este documento explica cómo funciona hoy el recomendador, qué pieza hace cada cosa, cómo arma la semana y cómo se opera. Está escrito para que lo puedas leer de corrido sin tener que abrir el código.

---

## 1. Las tres piezas que se confunden

| Pieza | Qué es | Qué NO es |
|---|---|---|
| **Amazon Bedrock** | El servicio de modelos. Le mandás un prompt, te devuelve texto. | No es un agente. No recuerda nada. No decide cuándo llamar a nada. |
| **AgentCore** | La plataforma para *hospedar* un agente: Runtime (dónde corre), Memory (qué recuerda), Gateway (sus herramientas), Identity (quién es). | No es un MCP, y no es necesario para este proyecto. |
| **MCP** | Un protocolo para exponer herramientas a un modelo. | No es una plataforma ni un lugar donde corre nada. Gateway es la parte de AgentCore que *habla* MCP. |

**"Bedrock Agents"** (el servicio viejo de agentes) está siendo migrado por AWS a **AgentCore Harness**. Por eso el taller mezclaba los nombres.

La consecuencia práctica para BaleadaFit: **la inferencia alcanza**. No hay bucle de agente, ni herramientas que el modelo elija, ni memoria entre sesiones que valga la pena. Todo lo demás sería infraestructura pagando por nada.

---

## 2. Cómo funciona hoy, de punta a punta

```
POST /pacientes/:id/planes/generar        planes.controller.ts:67
  └─ PlanesService.generar                planes.service.ts:141
       ├─ pacientes.requerimiento         pacientes.service.ts:354   (meta calórica y macros)
       ├─ pacientes.contextoClinico       pacientes.service.ts:385   (perfil clínico)
       ├─ alimentos.catalogoParaPaciente   alimentos.service.ts:47   ← filtro de alergias en SQL
       └─ RecomendadorService.generar      recomendador.service.ts:118
            ├─ si hay IA → conIa                          recomendador.service.ts:272
            │                ├─ BedrockService.generarJson bedrock.service.ts:150
            │                │    └─ ConverseCommand       bedrock.service.ts:127
            │                └─ validarPlan                validacion-plan.ts:105
            ├─ si NO hay IA → semanaPorReglas              recomendador.service.ts:260
            │                └─ generarPlanPorReglas       generador-reglas.ts:236
            ├─ variedad    → ajustarVariedadSemanal        variedad-semanal.ts:55
            └─ clinica     → ajustarDiaClinico             ajuste-clinico.ts:73
  └─ PlanesService.detalleConTotales       planes.service.ts:96
```

### El detalle que más importa

El catálogo **nunca** lo decide el modelo. `catalogoParaPaciente` consulta Postgres y excluye los alimentos que contienen los alérgenos del paciente (`contiene hasSome`). El modelo recibe únicamente los ~150 alimentos que ya pasaron ese filtro y elige entre ellos devolviendo `alimentoId`.

Eso no es optimización, es seguridad clínica: si el filtro de alérgenos dependiera del criterio del modelo, un prompt mal escrito podría devolver un alimento con maní a un paciente alérgico.

### Las porciones tampoco las decide el modelo

`ajustarPorciones` (`generador-reglas.ts:75-192`) escala las porciones hasta alcanzar la meta calórica con búsqueda exhaustiva en pasos de 0.25, con mínimos y máximos por alimento. Es aritmética, y la aritmética va en código: un modelo la hace mal y con seguridad.

---

## 3. El flujo semanal, pieza por pieza

### El contrato: una semana, no un día

`ResultadoRecomendador` (`recomendador.service.ts:46`) devuelve `origen`, `justificacion` y `dias: DiaPropuesto[]` (`:39`): siempre los siete días, en el orden de `DIAS_SEMANA` (`nutricion.util.ts:51`). El campo `tiempos` del plan de un día ya no existe en el contrato. Cada `DiaPropuesto` es `{ dia, tiempos, justificacion? }`, y cada tiempo trae `tipo`, `pctKcal` e `items` (el tipo `TiempoPropuesto` del motor por reglas, `generador-reglas.ts:36`).

### Una sola llamada semanal a Bedrock

`conIa` (`recomendador.service.ts:279`) hace **una** llamada por plan, con `MAX_TOKENS_SEMANA = 16000` (`:78`). El esquema que fija el prompt de sistema es `{resumen, dias:[{dia, tiempos, justificacion}]}` — la justificación va **por día**, no por tiempo: con 35 tiempos la salida se multiplicaba y la generación se pasaba del presupuesto de tokens y del timeout — y pide los siete días, en orden y una sola vez cada uno (`:407-419`). El cliente de Bedrock usa `requestTimeout` de **180 s** (`bedrock.service.ts:110`): una semana completa tarda alrededor de 63 s medidos, y con 60 s la llamada moría por timeout después de generar. El catálogo viaja con los nutrientes clínicos **por porción** — sodio, potasio, fósforo, fibra, azúcares, grasas saturadas e índice glucémico — en `promptUsuario` (`:485-520`).

### Validación estricta antes de persistir

`validarPlan` (`validacion-plan.ts:105`) revisa cada tiempo del modelo contra lo permitido: `alimentoId` del catálogo recibido, sin duplicados dentro del tiempo, porciones numéricas dentro de `[0.5, 4]` (`PORCION_MINIMA` / `PORCION_MAXIMA`, `:14-15`).

Un tiempo con cualquier ítem fuera de contrato queda en `parciales` (`validacion-plan.ts:168-170`) y **no se persiste a medias**: ese tiempo se regenera completo por reglas (`recomendador.service.ts:335-356`). Un día del que no sobrevive ningún tiempo válido se completa entero por reglas (`:315-323`).

La justificación distingue los dos casos, porque no son lo mismo para quien revisa: día que la IA **no devolvió** (`:308`) y día con **respuesta inválida** (`:321`). Además suma un contador por caso —`diasNoDevueltos`, `diasIlegibles`, `tiemposPorReglas` (`:297-299`, `:382-392`)— y lista el motivo de cada tiempo completado por reglas (`:339-345`).

### Variedad semanal en código

`ajustarVariedadSemanal` (`variedad-semanal.ts:55`) corre **antes** de las reglas clínicas (`recomendador.service.ts:120`), para que el último filtro que toque los alimentos sea el de los techos clínicos. Con `VARIEDAD_POR_DEFECTO` (`:26`) aplica tres reglas: máximo 3 apariciones por alimento en la semana (`:28`, `:146`), un `PLATO_TIPICO` no se repite en días consecutivos (`:123-136`) y mínimo 4 fuentes proteicas distintas, contando `PROTEINA` y `LEGUMINOSA` (`:29`, `:40`).

Es **best effort**: sin candidato en el catálogo el plan no se rompe, el alimento se queda y el límite no alcanzado se informa en `cambios` (`:196-201`). La justificación del plan muestra hasta seis ajustes y siempre los límites pendientes, nunca 35 líneas (`recomendador.service.ts:163-176`).

### Reglas clínicas en código

`detectarCondiciones` (`reglas-clinicas.ts:105`) reconoce HTA, ERC y diabetes por nombre o descripción de la condición; las demás se informan como no verificadas en vez de ignorarse (`reglas-clinicas.ts:202`).

Los techos diarios viven en `LIMITES_DIARIOS` (`:39`): sodio 2000 mg para HTA; potasio 3000 mg y fósforo 1000 mg para ERC. Para diabetes no hay techo por nutriente: se evalúa el índice glucémico **promedio del día** contra `IG_PROMEDIO_MAXIMO = 55` (`:46`, `:216`).

`ajustarDiaClinico` (`ajuste-clinico.ts:73`) corrige bajando porciones del alimento responsable en pasos de 0.25 (`:21`) y, cuando ya está en la porción mínima de 0.5, retirándolo (`:23`, `:108-118`). El índice glucémico no se escala por porción, así que ahí el alimento se retira directo (`:106-108`). El ciclo está acotado a 200 ajustes (`:29`) y lo que no se pudo corregir vuelve como `violaciones` para revisión clínica.

**Nada se da por cumplido sin datos.** Si a un alimento le falta el nutriente, `evaluarTecho` no lo suma como 0: devuelve una `incognita` con los alimentos sin dato y la suma conocida como piso (`reglas-clinicas.ts:166-178`). `ok` exige cero violaciones **y** cero incógnitas (`:248`), y ambas se escriben en la justificación del día (`recomendador.service.ts:206-214`).

### Persistencia y detalle

La generación persiste una fila por (día, tiempo): `resultado.dias` se aplana en `tiempos.create` con `dia`, `tipo`, `pctKcal` y `orden` (`planes.service.ts:212-226`), y `TiempoComida` es única por `@@unique([planId, dia, tipo])` (`schema.prisma:436`).

El detalle (`detalleConTotales`, `planes.service.ts:96`) agrega a cada tiempo su `kcalMeta`, `totales` y `desviacion` (`:101-111`); agrupa por día en `dias[]`, cada uno con sus tiempos, totales y desviación contra la meta diaria (`:113-126`); y devuelve `totales` y `desviacion` **del plan como semana**, contra `kcalObjetivo × días` (`:130-137`), donde `días` son los días que el plan tiene con tiempos.

### Edición manual de un tiempo

`PUT /planes/:id/tiempos/:dia/:tipo/items` (`planes.controller.ts:126`) reemplaza la lista completa de ese tiempo en ese día; si el plan no tiene ese (día, tiempo) responde 404 (`planes.service.ts:254-259`). La ruta sin `dia`, `PUT /planes/:id/tiempos/:tipo/items` (`planes.controller.ts:154`), sigue existiendo marcada como obsoleta (`deprecated: true`, `:158-161`) y equivale a `dia = LUNES`, que es el valor por defecto de la columna (`schema.prisma:426`).

### Los umbrales son de referencia, no una prescripción

`LIMITES_DIARIOS` está centralizado justamente para que ajustarlo sea un cambio de una línea, pero son **valores clínicos de referencia**: requieren revisión de quien responda clínicamente por la app antes de producción, y ajuste por paciente — ERC tiene estadios, HTA tiene grados (`reglas-clinicas.ts:32-37`).

---

## 4. El diseño en tres capas

**Capa 1 — determinista (código, sin IA).** Filtro de alergias, meta calórica, porciones, reglas clínicas por condición, variedad semanal. Nada de esto se le pide a un modelo.

**Capa 2 — modelo.** Elige qué alimentos y en qué combinación dentro de lo permitido, adapta al presupuesto y a quién cocina, y redacta la justificación clínica. Es lo que un LLM hace bien y una regla no.

**Capa 3 — validación y reparación.** El modelo propone, el código valida con esquema estricto, repara lo reparable y, si un día no se puede reparar, cae al generador por reglas **solo de ese día**.

Resultado: el plan es válido siempre, haya modelo o no.

**Dónde está el valor del producto:** no en que un LLM arme un plan — eso lo hace cualquiera con un prompt. Está en **garantizar** que el plan sea seguro y variado, que es justamente lo que el LLM no garantiza. La IA redacta y elige; el motor firma.

---

## 5. Credenciales: local y producción son distintos

**En tu máquina** usás `aws login`: credenciales temporales de consola con refresh token automático, guardadas por el CLI. No hay access keys de larga vida.

**En Railway** eso no sirve: son credenciales de tu máquina. Ahí van variables de entorno propias.

### El usuario IAM `baleadafit-app`

Se creó para que la app tenga su propia identidad, acotada a una sola cosa:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": [
      "arn:aws:bedrock:us-east-1:443370683070:inference-profile/us.anthropic.*",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.*",
      "arn:aws:bedrock:us-east-2::foundation-model/anthropic.*",
      "arn:aws:bedrock:us-west-2::foundation-model/anthropic.*"
    ]
  }]
}
```

Las tres regiones no son un descuido: los **inference profiles `us.`** enrutan la llamada entre `us-east-1`, `us-east-2` y `us-west-2`, y Bedrock exige permiso sobre el modelo base en **cada** región que el perfil abarca.

Verificado que el usuario **no** puede hacer nada más: `s3:ListAllMyBuckets` e `iam:ListUsers` devuelven `AccessDenied`.

La access key quedó en `C:\Users\Camilo\.aws\baleadafit-app-key.json` (fuera del repo, a propósito). Pasala a los secretos de Railway y **borrá el archivo** después. Si se filtra, se rota: `aws iam delete-access-key` + `create-access-key`, y el usuario no puede hacer otra cosa que invocar Bedrock.

---

## 6. El prefijo `us.` que rompe todo si falta

Invocar con el ID pelado del modelo falla:

```
Invocation of model ID anthropic.claude-haiku-4-5-20251001-v1:0 with on-demand
throughput isn't supported. Retry your request with the ID or ARN of an
inference profile that contains this model.
```

Hay que usar el **inference profile**:

```
us.anthropic.claude-haiku-4-5-20251001-v1:0     ✅
anthropic.claude-haiku-4-5-20251001-v1:0        ❌
```

Tu código toma el modelo de la variable `BEDROCK_MODEL_ID` (`bedrock.service.ts:128`). Si en Railway está sin el prefijo, el recomendador falla en producción y el error no se parece a un problema de permisos.

Variables que necesita la app: `BEDROCK_MODEL_ID`, `AWS_REGION` (us-east-1), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Alternativa más simple que las dos últimas: una **Bedrock API key** en `AWS_BEARER_TOKEN_BEDROCK`, que el SDK ya instalado detecta solo (verificado en `@aws-sdk/core`, `getBearerTokenEnvKey`) sin cambiar una línea de código.

---

## 7. Bloqueo abierto: el formulario de caso de uso

Con el usuario acotado, la invocación devuelve:

```
Model use case details have not been submitted for this account.
```

No es un problema de permisos. `aws bedrock get-use-case-for-model-access` confirma que el formulario de primera vez de Anthropic **nunca se envió** en esta cuenta; root lo saltea, una identidad normal no.

Se resuelve una sola vez, de dos maneras:

- **Consola**: Bedrock → *Model access* → completar el formulario de Anthropic.
- **CLI**: `aws bedrock put-use-case-for-model-access` con `formData` en base64 de:

```json
{
  "companyName": "...",
  "companyWebsite": "...",
  "intendedUsers": "...",
  "industryOption": "...",
  "otherIndustryOption": "...",
  "useCases": "..."
}
```

Ojo con un detalle de AWS: si la cuenta no tiene método de pago verificado, el envío puede fallar con "Your account is not authorized to perform this action".

---

## 8. Costos

- **Railway**: el API, como hoy.
- **AWS**: solo tokens de Bedrock. Nada de ECS, ni clusters, ni Runtime hosteado.
- **Ojo con el prompt**: el catálogo entero viaja en **una** llamada por plan semanal (~150 alimentos con nombre, porción, macros, tiempos y nutrientes clínicos). Estimando ~40 tokens por línea son ~6.000 tokens de entrada **por plan**, y la salida de la semana ronda los 1.800 tokens (medido contra los tres modelos, `recomendador.service.ts:68-75`). Vale recortar campos a lo que el modelo realmente usa, o evaluar prompt caching (Claude lo soporta; el skill `amazon-bedrock` tiene la referencia).

---

## 9. Cómo verificar que algo anda

```bash
# 1. ¿Quién soy y con qué permisos?
aws sts get-caller-identity

# 2. ¿Puedo invocar el modelo? (debe responder "ok")
aws bedrock-runtime converse \
  --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  --messages '[{"role":"user","content":[{"text":"Responde solo: ok"}]}]' \
  --inference-config '{"maxTokens":16}'

# 3. ¿El usuario acotado NO puede hacer otras cosas? (debe dar AccessDenied)
aws s3 ls
```

---

## 10. Glosario

- **Inference profile**: capa sobre un modelo que permite enrutar entre regiones (prefijo `us.`). Obligatorio para los modelos Claude actuales.
- **Converse API**: la forma estándar y portable de invocar modelos en Bedrock. Es la que usa `bedrock.service.ts`.
- **Perfil clínico (`PerfilClinico`)**: el objeto que arma el expediente del paciente para el recomendador: antropometría, condiciones, estado fisiológico, alergias, medicación, hábitos y objetivo.
- **Motor por reglas**: el generador determinista que arma un plan sin IA. Es el fallback y es la red de seguridad: completa días enteros o tiempos sueltos que la IA no devolvió o devolvió mal.
- **Incógnita clínica**: un techo que no se puede verificar porque falta el nutriente en algún alimento del día. No cuenta como cumplido (`reglas-clinicas.ts:165-178`).
- **Variedad semanal**: el ajuste en código que limita repeticiones entre días. Best effort: informa lo que no pudo alcanzar, nunca rompe el plan (`variedad-semanal.ts:5-15`).
- **Least privilege**: dar a cada identidad solo lo que necesita. Es la razón de existir de `baleadafit-app`.
- **CDK bootstrap**: preparación inicial que `agentcore deploy` hace en una cuenta para poder desplegar. No hace falta hoy porque no desplegamos nada a AWS.
