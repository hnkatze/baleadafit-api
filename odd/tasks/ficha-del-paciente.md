# Ficha del paciente

La pantalla principal del BO es el expediente de un paciente. Hoy se arma con cuatro llamadas (`GET /pacientes/:id` + requerimiento + adherencia + mediciones) y el portal tiene que calcular los indicadores: IMC clasificado, progreso contra el objetivo y alertas. Eso es lógica de dominio, no de UI, así que va al backend en un endpoint compuesto de solo lectura.

## Specs

- **S1** — `GET /pacientes/:id/ficha` devuelve todo lo que la pantalla de expediente necesita en **una** llamada.
- **S2** — Cabecera con indicadores derivados: edad, IMC y su clasificación (bajo peso / normal / sobrepeso / obesidad I-III), % de grasa, masa magra y objetivo pactado.
- **S3** — Progreso contra el objetivo: peso inicial, peso actual, diferencia, ritmo en kg por semana y proyección a la fecha objetivo (declarada como proyección, no como promesa).
- **S4** — Situación clínica: condiciones, restricciones, medicación vigente y estado fisiológico.
- **S5** — Requerimiento calculado (kcal objetivo, TMB, gasto total) y adherencia de los últimos 30 días.
- **S6** — Alertas calculadas por el backend a partir de los datos: sin medición reciente, peso estancado (solo si la meta no es mantener), plan activo viejo o ausente, y adherencia baja.
- **S7** — Evolución completa (todas las mediciones con IMC), consultas pasadas con su SOAP y próximas citas, y planes con la tabla con la que se calcularon.
- **S8** — Nada se rompe: `GET /pacientes/:id`, requerimiento y adherencia siguen respondiendo igual.

## Tasks

- [ ] F1 — Utilidades puras de la ficha (clasificación de IMC, progreso y alertas) con tests (S2, S3, S6)
- [ ] F2 — `GET /pacientes/:id/ficha`: composición de los bloques con aislamiento por nutricionista (S1, S4, S5, S7, S8)
- [ ] F3 — README y OpenAPI al día

## Log

- **L1** (pedido del dueño, verbatim): "la fihca del paciente como esta pensada ?" y, ante la propuesta: "hagamos lo que sea logico para el negocio".
- **L2** (decisión de diseño): endpoint compuesto de lectura en el backend, no composición en el portal, porque los indicadores y las alertas son lógica de dominio y así también los puede reusar la app del paciente. Se mantienen los endpoints existentes para no romper nada.
- **L3** (límite clínico respetado): las alertas de nutrientes (sodio, carga glucémica) **no** entran todavía porque dependen de los umbrales de N5, que el dueño no definió. Inventar un umbral acá sería peor que no tener la alerta.
- **L4** (criterio de las alertas): se calculan solo con datos que el sistema ya tiene y con referencias públicas, sin diagnosticar: días sin medición, tres mediciones sin cambio, plan activo viejo o ausente y adherencia baja. La clasificación de IMC usa los rangos de la OMS.
