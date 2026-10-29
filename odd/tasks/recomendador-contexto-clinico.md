# El recomendador recibe el expediente clínico

El expediente ya guarda condiciones, hábitos, composición corporal y objetivo, pero el recomendador solo recibía la meta, los macros, las restricciones y el catálogo: un paciente con hipertensión o en lactancia recibía el mismo plan que cualquiera. Este feature lleva ese contexto al agente y deja explícito qué falta para que las reglas también lo respeten.

## Specs

- **S1** — "la idea es que el agente tenga todos estos datos para poder recomendar platos y esas cosas": el recomendador recibe el expediente del paciente, no solo kcal y macros.
- **S2** — El contexto incluye edad, sexo, peso, talla, IMC, % de grasa, masa muscular y grasa visceral de la última medición.
- **S3** — El contexto incluye las condiciones clínicas **con la descripción de lo que implican en el plan** (es el texto que ya trae el catálogo de condiciones).
- **S4** — El contexto incluye el estado fisiológico (embarazo / lactancia) con la instrucción de no plantear déficit agresivo.
- **S5** — El contexto incluye alergias declaradas y la medicación vigente.
- **S6** — El contexto incluye los hábitos: comidas al día, agua, sueño, alcohol, tabaco, quién cocina y presupuesto.
- **S7** — El contexto incluye el objetivo pactado (peso y fecha) junto con la meta.
- **S8** — Solo viaja lo que existe: un paciente sin condiciones ni hábitos cargados no genera líneas vacías ni datos inventados.
- **S9** — El generador por reglas y el fallback siguen funcionando igual: si la IA no está disponible, el plan se arma por reglas sin romperse por el contexto extra.

## Tasks

- [x] C1 — `PerfilClinico` compartido y `PacientesService.contextoClinico()` que arma el contexto desde el expediente (S2-S8)
- [x] C2 — El recomendador manda el perfil clínico en el prompt y le dice al modelo que las condiciones mandan sobre la preferencia cultural (S1, S3-S4)
- [x] C3 — `PlanesService.generar` conecta el contexto con el recomendador (S1)
- [ ] C4 — Que el generador por reglas respete las condiciones que se pueden verificar (pendiente de decisión sobre nutrientes del catálogo)

## Log

- **L1** (pedido del dueño, verbatim): "la idea es que el agente tenga todos estos datos para poder recomendar platos y esas cosas"
- **L2** (hallazgo que motiva el feature): `promptUsuario()` enviaba meta, kcal y macros, restricciones, indicaciones libres y el catálogo. No enviaba condiciones, estado fisiológico, alergias, medicación, hábitos, composición ni objetivo, aunque el expediente ya los tenga desde el feature `expediente-clinico`.
- **L3** (desvío de proceso, declarado): C1-C3 se implementaron antes de escribir este documento; las specs S1-S9 se derivan del pedido L1 y del código ya escrito. C4 queda abierta.
- **L4** (límite conocido, abierto): el catálogo no tiene sodio, potasio, fósforo ni índice glucémico, así que las condiciones que dependen de esos nutrientes (HTA, ERC) solo se pueden comunicar al modelo, no verificar en el backend. El generador por reglas tampoco las considera. C4 necesita decidir si se agregan esos nutrientes al catálogo (valores estimados, misma advertencia que los macros) o si se resuelve con etiquetas por condición.
