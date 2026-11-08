# Cambios de contrato: el plan alimenticio ahora es semanal

**Para:** equipo de la app del paciente (mobile) y equipo del backoffice (BO)
**API:** `https://api-pro.baleadafit.com`
**Estado:** desplegado en producción

El plan alimenticio pasó de **un día** a **una semana completa**. Este documento dice qué cambió en el contrato, qué se rompe si no se adaptan, y qué tiene que hacer cada equipo.

---

## 1. Resumen en una línea

Un plan ya no es "el día del paciente": es **una semana de 7 días × 5 tiempos de comida (hasta 35 filas)**, y los `totales` del plan ahora son **semanales**; todo lo demás — ítems, porciones, versionado de nutrientes, activar/eliminar/listar — sigue igual.

Lo que se mantiene sin cambios: las rutas de activar, eliminar y listar planes, la forma de los ítems (`alimento`, `alimentoVersion`, `porciones`) y el versionado de nutrientes por ítem.

---

## 2. Qué cambia en `GET /planes/{id}`

`GET /planes/{id}` devuelve el plan completo y **es el endpoint que más cambió**. El sobre de respuesta no cambia (`{ ok: true, datos: {...} }`).

### 2.1 Los tiempos traen el día

Cada `tiempoComida` ahora lleva **`dia`**, además de lo que ya tenía:

```jsonc
{
  "id": "uuid",
  "planId": "uuid",
  "dia": "MARTES",          // NUEVO — LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO
  "tipo": "ALMUERZO",       // DESAYUNO | MERIENDA_AM | ALMUERZO | MERIENDA_PM | CENA
  "pctKcal": 0.35,
  "orden": 2,               // posición del tiempo dentro del día
  "items": [ /* sin cambios */ ],
  "kcalMeta": 578,          // meta de ESE tiempo en ESE día (siempre diaria)
  "totales": { /* sin cambios */ },
  "desviacion": 0.041       // real vs kcalMeta de este tiempo
}
```

- `tiempos` puede traer **hasta 35 filas** (7 días × 5 tiempos). Trae menos si la distribución de tiempos del plan dejó algún tiempo en 0 %.
- `DiaSemana` va **sin tilde**: `MIERCOLES`, `SABADO`. No es `MIÉRCOLES`.
- `(dia, tipo)` es único dentro de un plan: no hay dos `ALMUERZO` para el mismo día.

> ### ⚠️ Esto es lo que rompe
> Quien hoy pinte `tiempos` como "el día del paciente" va a mostrar **35 comidas en vez de 5**.
> Hay que **agrupar por `dia`** y quedarse con el día que corresponda.

**Sobre el orden del array:** `tiempos` viene ordenado por `orden` (el slot del día), **no por día**. Es decir, primero los 7 desayunos, después las 7 meriendas AM, etc. Y entre filas con el mismo `orden` el contrato **no garantiza** un orden estable. Agrupen por `dia` y ordenen por `orden` del lado del cliente; no confíen en la posición del array.

### 2.2 Aparece `dias[]`

Nuevo arreglo: un elemento por día, **solo para los días que tienen al menos un tiempo de comida** (si un día quedó vacío, no aparece; el arreglo puede traer 6 o menos).

```jsonc
"dias": [
  {
    "dia": "LUNES",
    "tiempos": [ /* los tiempos de ese día, mismo formato que arriba */ ],
    "totales": { "kcal": 1654, "proteinaG": 101.2, "...": "..." },
    "desviacion": 0.002   // (kcal del día − kcalObjetivo) / kcalObjetivo
  }
]
```

Viene en orden de lunes a domingo. `dias[].desviacion` se mide contra la **meta diaria** (`kcalObjetivo`), igual que `kcalMeta` de cada tiempo.

**Si solo les interesa un día, usen `dias[]`:** ya viene agrupado y totalizado. Es más simple que reagrupar `tiempos`.

### 2.3 `totales` y `desviacion` del plan ahora son SEMANALES

Este es el cambio silencioso más peligroso: **cambia el significado de campos que ya existían**.

| Campo | Antes | Ahora |
| --- | --- | --- |
| `tiempos[]` | solo el día del paciente | toda la semana |
| `dias[]` | no existía | totales por día |
| `totales` (del plan) | kcal del día | **kcal de la semana entera** |
| `desviacion` (del plan) | vs `kcalObjetivo` | vs `kcalObjetivo` **× cantidad de días con tiempos** |

- `plan.totales.kcal` es la suma de **toda la semana**. Si antes mostraban esto como "kcal del día", ahora están mostrando 7 veces más.
- `plan.desviacion` compara las kcal de la semana contra `kcalObjetivo × días`. Ojo: se multiplica por los **días que tienen tiempos**, no por 7. Un plan de 5 días se mide contra `kcalObjetivo × 5`.
- Si `dias` viene vacío, la meta se calcula con 1 para no dividir por cero y **`desviacion` no significa nada**: trátenla como ausente.

Para las kcal del día, usen `dias[].totales` (o la suma de `tiempos[].totales` de ese día). **No usen `plan.totales` como si fuera el día.**

### 2.4 Pantallas del paciente (`/mi-cuenta/*`)

El mismo cambio aplica a lo que consume la app del paciente:

- **`GET /mi-cuenta/plan`** devuelve el mismo cuerpo que `GET /planes/{id}`: con `dias[]`, 35 `tiempos` y `totales` semanales.
- **`GET /mi-cuenta/hoy` filtra por día**: devuelve solo los tiempos de comida del día que corresponde a `fecha` (por defecto hoy), y la respuesta suma el campo `dia` con ese día de la semana. `plan.totales` son los del día, no los de la semana. Un plan de un solo día (anterior a los semanales) devuelve su único día, sin importar la fecha.
  - Si el plan activo no tiene ese día, `tiempos` viene vacío: la app debe mostrar un estado vacío, no inventar comidas.
  - `cumplidos` se cuenta sobre los registros del día pedido.

`POST /mi-cuenta/registros` **no cambia**: se envía `tiempoComidaId`, y el `id` de un tiempo ahora identifica (plan, día, tipo), así que sigue siendo unívoco.

---

## 3. Generación: sigue siendo síncrona y ahora tarda mucho más

`POST /pacientes/{id}/planes/generar` sigue siendo **síncrono**: una sola llamada HTTP que devuelve el plan creado.

- Con IA (`usarIa: true`, el valor por defecto) una semana completa tarda **alrededor de 63 segundos** medidos (7 días × 5 tiempos). No es un pico: es el tiempo normal.
- Sin IA (`usarIa: false`, o cuando la IA no está disponible y entra el generador por reglas) responde en **milisegundos**.

### Configuración obligatoria del cliente

1. **Timeout de la petición por encima de 90 s.** Recomendado: **120 s**. Con el default de la mayoría de los clientes HTTP (30–60 s) la generación **siempre** va a fallar del lado del cliente.
2. **Mostrar estado de carga explícito** ("generando plan…"), con opción de salir de la pantalla y volver: un minuto de pantalla congelada se lee como app colgada.
3. **Si el cliente corta antes de tiempo, el plan se crea igual.** El backend no aborta: cuando el timeout del cliente dispara, la generación sigue y el plan queda guardado en **`BORRADOR`**. Al volver a la pantalla, **refresquen la lista de planes** (`GET /pacientes/{id}/planes`) en vez de asumir que no se creó nada; si el usuario reintenta a ciegas, va a acumular borradores.

### Lo que todavía NO existe

- **No hay generación asíncrona**: no hay job id, no hay endpoint de estado, no hay webhook.
- **No hay streaming** de la respuesta.
- El único aviso de progreso posible es el estado local del cliente.

---

## 4. Edición manual por día

El BO ahora edita **por día y por tiempo**. Antes solo había un "tiempo" del único día.

### Ruta nueva (usar esta)

```
PUT /planes/{id}/tiempos/{dia}/{tipo}/items
```

- `dia`: `LUNES` | `MARTES` | `MIERCOLES` | `JUEVES` | `VIERNES` | `SABADO` | `DOMINGO`
- `tipo`: `DESAYUNO` | `MERIENDA_AM` | `ALMUERZO` | `MERIENDA_PM` | `CENA`
- Body sin cambios: `{ "items": [{ "alimentoId": "uuid", "porciones": 1.5 }] }` — reemplaza la lista **completa** de ese tiempo en ese día (máximo 12 ítems, porciones en múltiplos de 0.25 entre 0.25 y 6).

### Ruta anterior (obsoleta, pero viva)

```
PUT /planes/{id}/tiempos/{tipo}/items
```

Sigue funcionando por compatibilidad, está marcada `deprecated` en la especificación y **equivale a `dia = LUNES`**. Es decir: si el BO no migra, cada vez que lo usuario edite "el almuerzo" va a editar **el almuerzo del lunes**, aunque tenga otro día en pantalla. Ese es el bug silencioso más probable de esta migración.

### Respuesta

Ambas rutas devuelven el **plan completo** (`PlanDetalleEntity`, con `dias[]` y totales semanales recalculados). No hace falta un `GET` extra después de editar: repinten con la respuesta.

### Errores esperables

Todos los errores usan el sobre habitual: `{ ok: false, error: { codigo, mensaje, detalles? } }`. `codigo` es estable y sirve para decidir sin leer el texto.

| Código | Situación | `mensaje` |
| --- | --- | --- |
| 404 | El plan no existe o no es de la nutricionista | `Plan no encontrado.` |
| 404 | El plan existe pero no tiene ese tiempo en ese día | **`El plan no tiene CENA el VIERNES.`** — ahora nombra tiempo y día |
| 400 | El plan está archivado (no editable) | `El plan está archivado.` |
| 400 | Algún `alimentoId` no existe o está inactivo | `Hay alimentos que no existen o están inactivos.` |
| 400 | `dia` o `tipo` fuera del enum | Error de validación del parámetro |
| 400 | Body inválido (items vacío/malformado, porciones fuera de rango) | Error de validación con `detalles[]` por campo |
| 401 / 403 | Sin token, rol equivocado o correo sin verificar | — |

El 404 de "no tiene ese tiempo" es el caso nuevo que hay que manejar: el BO puede estar mostrando un día que el plan no incluye (por ejemplo, si la distribución de tiempos dejó un tiempo en 0 %).

---

## 5. Qué leer en `justificacion`

`justificacion` es **texto libre**, guardado tal cual, con **varias capas separadas por saltos de línea**. No es un campo estructurado: no lo parseen con regex frágiles ni lo usen para lógica de negocio. Si necesitan un dato para decidir, sale de `estado`, `origen`, `dias[].desviacion` o `tiempos`, no del texto.

Capas que pueden aparecer, en este orden:

| Capa | Ejemplo | Cuándo aparece |
| --- | --- | --- |
| Resumen del modelo | `Plan semanal con comida hondureña, variado y con cenas livianas.` | Generado con IA |
| Justificación por día (del modelo) | `MARTES: se baja el arroz y se sube la proteína.` | Generado con IA |
| Reparaciones tiempo a tiempo | `CENA: completado por reglas (ítems inválidos).` | La IA devolvió algo inválido en ese tiempo |
| Ítems descartados | `Descartados 5 ítem(s) fuera de contrato (…motivos…).` | Se descartaron ítems que la IA inventó o rompió el contrato |
| Días faltantes o inválidos | `2 día(s) completados por reglas porque la IA no los devolvió.` · `1 día(s) completados por reglas porque la respuesta de la IA no fue válida.` · `3 tiempo(s) completados por reglas porque la IA no devolvió alimentos válidos.` | La semana se completó parcialmente por reglas |
| Variedad | `Variedad semanal: 4 ajuste(s), +2 más. LUNES: Arroz → Frijoles (tope de 3 apariciones); …` | El backend cambió alimentos para no repetir. Muestra hasta 6 cambios y siempre los límites que no se pudieron alcanzar (`No se alcanzó el mínimo de fuentes proteicas…`) |
| Ajustes clínicos (agregado) | `Reglas clínicas aplicadas en código: HTA, ERC.` · `4 día(s) ajustados para respetar los techos clínicos.` · `Condiciones que el sistema no verifica en código: Gastritis.` | El paciente tiene condiciones detectables |
| Nota fija de verificación | `Porciones verificadas por el sistema (±10 % de la meta del tiempo de comida). Revisar antes de aprobar.` | Siempre, cuando generó la IA |

### Qué mostrar en cada cliente

- **BO: mostrar la justificación completa.** Es la información que la nutricionista necesita para revisar antes de aprobar: qué día se reparó, qué se recortó por clínica, qué no se pudo verificar. Rendericen por saltos de línea (`<li>` o párrafos), sin truncar y con scroll. La nota fija de ±10 % ya está redactada para leerse.
- **Mobile: nada, o solo lo amable.** No muestren la justificación cruda al paciente. Contiene jerga interna (`REGLAS`, `HTA`, `desviación`, "revisar clínicamente") y avisos de proceso. Si necesitan un texto para el paciente, escríbanlo ustedes a partir del plan; no reutilicen este campo.
- **Límite honesto:** las advertencias **por día** que el generador produce internamente ("Ajuste clínico: …", "No se pudo corregir sodioMg (2100 sobre 2000) de HTA: revisar clínicamente.", "Sin dato de sodioMg en 3 alimento(s): el techo de HTA no se pudo verificar.") **no se exponen en la API**: no se persisten. En `justificacion` solo quedan los agregados de la tabla. Si el BO necesita ver el detalle por día, hay que pedirlo como cambio de API; no está en esta versión.

---

## 6. Advertencias honestas

Cosas que son así a propósito y que conviene saber antes de reportarlas como bugs:

1. **Un día puede quedar corto y es correcto.** Las reglas clínicas recortan porciones o retiran alimentos para respetar techos (sodio en HTA, potasio y fósforo en ERC, índice glucémico en diabetes). Ese día puede terminar con **menos ítems o menos kcal** que la meta, y eso se ve en `dias[].desviacion`. Si la desviación de un día es muy negativa, es el precio de respetar el techo, no un error de cálculo. Preséntenla como información ("este día quedó 8 % por debajo de la meta"), no la escondan ni la "corrijan" sumando alimentos del lado del cliente.
2. **Los umbrales clínicos son de referencia y no están validados clínicamente.** Están centralizados para poder ajustarlos, pero son valores generales, no prescripción por paciente. No los muestren como recomendación médica, ni en el BO ni en mobile.
3. **`origen` puede ser `REGLAS` aunque se haya pedido IA.** Si Bedrock falla o devuelve algo inutilizable, el plan se genera igual por reglas y queda `origen: "REGLAS"` — con la razón escrita en `justificacion`. **La app no debe prometer IA.** Muestren `origen` con honestidad y no lo describan como "generado por inteligencia artificial" salvo que el valor sea `IA`. Valores posibles: `IA`, `REGLAS`, `MANUAL`.
4. **Distribución de tiempos parcial:** si un plan se generó con un tiempo de comida en 0 %, ese tiempo no existe para ningún día, y editar ese `tipo` va a devolver 404. El BO no debe asumir los 5 tiempos fijos; derive la grilla de `dias[].tiempos`.
5. **Los totales son un piso de lo conocido.** Los nutrientes sin dato suman 0, no se estiman. Un `sodioMg` bajo puede significar "no hay dato", no "bajo en sodio".
6. **Los totales salen de la versión del alimento, no del alimento actual.** Editar un alimento del catálogo no cambia un plan ya generado. Si un plan viejo muestra valores que no coinciden con el catálogo, es lo esperado.

---

## 7. Checklist por equipo

### Mobile (app del paciente)

- [ ] Agrupar `tiempos` por `dia`; no asumir que el array es "un día".
- [x] Pantalla "Hoy": el backend ya filtra por día y `plan.totales` son los del día; usar el `dia` que llega en la respuesta.
- [ ] Manejar `tiempos: []` cuando el plan activo no tiene ese día.
- [ ] Ajustar el timeout del `POST` de generación a **> 90 s** (recomendado 120 s).
- [ ] Mostrar estado de carga explícito durante la generación.
- [ ] Tras un timeout, **refrescar la lista de planes** en vez de reintentar a ciegas (el borrador se crea igual).
- [ ] No prometer IA: mostrar `origen` con honestidad.
- [ ] No renderizar `justificacion` cruda al paciente.
- [ ] Manejar `dias` vacío o con menos de 7 elementos sin romper el layout.
- [ ] Ignorar `MIERCOLES`/`SABADO` con tilde: el enum va sin acento.

### Backoffice (BO)

- [ ] Migrar las ediciones a `PUT /planes/{id}/tiempos/{dia}/{tipo}/items`; dejar de usar la ruta sin `dia` (edita **LUNES** silenciosamente).
- [ ] Construir la grilla de edición desde `dias[].tiempos`, no desde una lista fija de 5 tiempos.
- [ ] Manejar el 404 `El plan no tiene {TIPO} el {DIA}.` cuando el día/tiempo no existe.
- [ ] Usar la respuesta de cada `PUT` (plan completo) para repintar; no hace falta un `GET` extra.
- [ ] Mostrar `justificacion` completa, por líneas, sin truncar.
- [ ] Mostrar `dias[].desviacion` como información ("cortó por techo clínico"), no como error.
- [ ] Leer `totales` del plan como **semanales**; para el día, `dias[].totales`.
- [ ] En la generación, timeout > 90 s y aviso de espera de ~1 minuto.
- [ ] No asumir que `origen` es `IA`: puede ser `REGLAS` o `MANUAL`.

---

## 8. Lo que NO cambia

Para que no haya migración innecesaria:

- **Rutas de planes:** `GET /pacientes/{id}/planes` (listado paginado, sin detalle), `POST /planes/{id}/activar` (deja el plan `ACTIVO` y archiva el anterior), `DELETE /planes/{id}` (204, solo `BORRADOR`), `PATCH /planes/{id}` (nombre, metas y justificación).
- **Forma de los ítems:** `alimento`, `alimentoVersion`, `alimentoVersionId`, `porciones`. Las porciones siguen siendo múltiplos de 0.25.
- **Versionado de nutrientes por ítem:** los totales se calculan con la versión del alimento atada al crear el ítem; editar el alimento después no altera el plan.
- **`kcalMeta` y `desviacion` por tiempo:** se siguen midiendo contra la meta **diaria** de ese tiempo (`pctKcal` × `kcalObjetivo`). Lo único que pasó a semanal es el `totales`/`desviacion` **del plan**.
- **El sobre de respuesta:** `{ ok: true, datos }` y `{ ok: false, error: { codigo, mensaje, detalles? } }`.
- **Registro de comidas del paciente:** `POST /mi-cuenta/registros` con `tiempoComidaId` no cambia.
- **Autenticación y roles:** igual que antes.

---

## Dudas

Si algo de este documento no coincide con lo que devuelve la API en producción, gana la API: reporten el caso con el `id` del plan y la respuesta completa. La especificación viva está en `docs/openapi.json` del repositorio de la API.
