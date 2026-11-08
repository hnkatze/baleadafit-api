# El recomendador de BaleadaFit, explicado

Este documento explica cómo funciona hoy el recomendador, qué pieza hace cada cosa, qué falta para el plan semanal y cómo se opera. Está escrito para que lo puedas leer de corrido sin tener que abrir el código.

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
POST /pacientes/:id/planes/generar        planes.controller.ts:66
  └─ PlanesService.generar                planes.service.ts:121
       ├─ pacientes.requerimiento         (meta calórica y macros)
       ├─ alimentos.catalogoParaPaciente   alimentos.service.ts:54   ← filtro de alergias en SQL
       └─ RecomendadorService.generar      recomendador.service.ts:70
            ├─ si hay IA → BedrockService.generarJson   bedrock.service.ts:150
            │                └─ ConverseCommand          bedrock.service.ts:127
            └─ si NO hay IA → generarPlanPorReglas       generador-reglas.ts:236
```

### El detalle que más importa

El catálogo **nunca** lo decide el modelo. `catalogoParaPaciente` consulta Postgres y excluye los alimentos que contienen los alérgenos del paciente (`contiene hasSome`). El modelo recibe únicamente los ~150 alimentos que ya pasaron ese filtro y elige entre ellos devolviendo `alimentoId`.

Eso no es optimización, es seguridad clínica: si el filtro de alérgenos dependiera del criterio del modelo, un prompt mal escrito podría devolver un alimento con maní a un paciente alérgico.

### Las porciones tampoco las decide el modelo

`ajustarPorciones` (`generador-reglas.ts:75-192`) escala las porciones hasta alcanzar la meta calórica con búsqueda exhaustiva en pasos de 0.25, con mínimos y máximos por alimento. Es aritmética, y la aritmética va en código: un modelo la hace mal y con seguridad.

---

## 3. Qué falta hoy

1. **La dimensión día no existe.** `PlanAlimenticio` → `TiempoComida` con `@@unique([planId, tipo])` (`schema.prisma:423`) prohíbe 7 × 5 filas por plan. El prompt dice literalmente `'Armas planes alimenticios de un día'` (`recomendador.service.ts:176`). El motor de reglas también devuelve un día.
2. **Nadie valida la salida del modelo.** `bedrock.service.ts:161` hace `JSON.parse` y castea `as T`. Después, `recomendador.service.ts:130-152` repara a mano. Con 5 slots alcanza; con 35 no.
3. **Nadie controla la variedad entre días.** Ni el prompt ni las reglas. Un plan con el mismo plato típico siete días es válido para el código e inútil para el paciente.
4. **Las condiciones clínicas no se verifican.** HTA, ERC y diabetes viajan al prompt como texto, pero no hay ninguna regla que impida un plan con 4.000 mg de sodio para un hipertenso.

El punto 4 **ya no está bloqueado por datos**: el catálogo tiene `sodioMg`, `potasioMg`, `fosforoMg` (`schema.prisma:320-324`) e `indiceGlucemico` (`:330`), y el seed los carga. Está bloqueado por código.

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
- **Ojo con el prompt**: hoy el catálogo entero viaja en cada llamada (~150 alimentos con nombre, porción, macros, tiempos y nutrientes clínicos). Estimando ~40 tokens por línea son ~6.000 tokens de entrada por llamada; con 7 días son ~42.000. Vale recortar campos a lo que el modelo realmente usa, o evaluar prompt caching (Claude lo soporta; el skill `amazon-bedrock` tiene la referencia).

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
- **Motor por reglas**: el generador determinista que arma un plan sin IA. Es el fallback y es la red de seguridad.
- **Least privilege**: dar a cada identidad solo lo que necesita. Es la razón de existir de `baleadafit-app`.
- **CDK bootstrap**: preparación inicial que `agentcore deploy` hace en una cuenta para poder desplegar. No hace falta hoy porque no desplegamos nada a AWS.
