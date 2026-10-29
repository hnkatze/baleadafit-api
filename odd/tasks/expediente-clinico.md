# Expediente clínico completo

El PPT de Semana 2 deja el expediente en pacientes + mediciones básicas. Un nutricionista en consulta necesita registrar objetivo, condiciones, medicación, hábitos, antropometría de composición corporal y notas de consulta. Este feature amplía el modelo y la API para cubrirlo, sin romper lo que el portal ya consume.

## Specs

- **S1** — Expediente, objetivo del paciente: peso objetivo en kg y fecha objetivo, además de `meta` (BAJAR / MANTENER / SUBIR) que ya existe.
- **S2** — Expediente, condiciones clínicas: catálogo de condiciones con N:M por paciente (diabetes, HTA, ERC, hipotiroidismo, dislipidemia, embarazo, lactancia), igual que el patrón `restriccion` + `paciente_restriccion`.
- **S3** — Expediente, estado fisiológico: `NINGUNO` / `EMBARAZO` / `LACTANCIA` en el paciente.
- **S4** — Expediente, medicación: medicamentos por paciente con nombre, dosis, frecuencia y si sigue activo.
- **S5** — Expediente, antecedentes y hábitos: cirugías, alergias declaradas (texto libre, complementa las restricciones del catálogo), suplementos, motivo de consulta, comidas al día, litros de agua, horas de sueño, frecuencia de alcohol y tabaco, quién cocina en casa y presupuesto.
- **S6** — Antropometría: la medición suma masa muscular, masa grasa, grasa visceral, agua intracelular y extracelular, ángulo de fase, cuatro pliegues cutáneos, perímetros de brazo, cadera y muslo, y presión arterial sistólica y diastólica.
- **S7** — Antropometría, trazabilidad: cada medición declara su `fuente` (`MANUAL`, `BASCULA`, `INBODY`, `OMRON`, `OTRO`) para distinguir lo medido de lo estimado.
- **S8** — Consulta: la cita guarda notas SOAP (subjetivo, objetivo, análisis, plan) y la fecha sugerida de la próxima cita.
- **S9** — La API expone todo lo anterior: actualizar el expediente y sus condiciones/medicamentos, registrar mediciones con composición corporal, y registrar SOAP al cerrar la cita.
- **S10** — Nada de esto rompe lo existente: los endpoints del portal siguen respondiendo igual y `npm test`, `npm run lint` y `npm run build` quedan verdes en cada tarea.

## Tasks

- [x] E1 — Modelo y migración: extender `paciente`, `medicion` y `cita`, agregar `condicion`, `paciente_condicion` y `medicamento`, y sembrar el catálogo de condiciones (S1-S8) — commit `e96eaa0`
- [x] E2 — Expediente en la API: detalle con condiciones, medicamentos y hábitos, más los endpoints para actualizarlos (S2-S5, S9) — worker `mvtu5bnr-4-ddlr`, revisado por el orquestador
- [x] E3 — Mediciones con composición corporal y fuente en la API (S6, S7, S9) — mismo worker
- [x] E4 — SOAP y próxima cita en la API (S8, S9) — worker `mvtu5bnx-5-rqpb`, commit `2afa627`
- [x] E5 — README y OpenAPI al día con los campos nuevos (S9)
- [x] F1 — Dejar de exponer notas internas y SOAP al paciente (S10) — commit `b6692f6`
- [x] F2 — Guardar `proximaCitaSugerida` con `aFecha`, sin corrimiento por zona horaria — commit `3614ec0`
- [x] F3 — Permitir borrar `fechaObjetivo` y `proximaCitaSugerida` con `null` — commit `3614ec0`
- [x] F4 — Bajar el mínimo de presión diastólica a 40 — commit `3614ec0`

## Log

- **L1** (pedido del dueño, verbatim): "clareo la data yo entiendo que alguna paresca basica, pero debe tener todo lo que un nutricionista necesita,"
- **L2** (autorización, verbatim): "dale el refresh por el sdk entonces, y vamos con tus recomendacion, dale"
- **L3** (decisión): queda dentro del alcance la lista de data clínica propuesta por el orquestador y aceptada en L2: expediente (objetivo, condiciones, medicamentos, antecedentes y hábitos), antropometría (composición corporal, pliegues, perímetros, presión y fuente del dato) y consulta (SOAP y próxima cita).
- **L4** (fuera de alcance, para un feature aparte): versionado inmutable del plan aprobado y plantillas de plan reutilizables. Se registran como trabajo futuro y no entran en este feature.
- **L5** (decisión técnica): las condiciones clínicas usan catálogo + N:M como `restriccion`, para que una condición se pueda describir una sola vez y filtrar por código; la medicación va en tabla propia con `activo` para conservar el historial de lo recetado.
- **L6** (defecto encontrado al revisar el trabajo del worker): el detalle del paciente devolvía las mediciones sin `imc` (el resto de la API siempre lo incluye) y ordenaba solo por `fecha`, así que dos mediciones del mismo día quedaban en orden arbitrario y el portal podía mostrar como "última" la más vieja. Corregido con `orderBy: [{fecha:'desc'},{creadoEn:'desc'}]` y cálculo de `imc`; el OpenAPI del detalle pasó a `MedicionConImcEntity`.
- **L7** (evidencia contra la API viva): `GET /condiciones` devuelve 20 condiciones; el PATCH del expediente persiste objetivo, hábitos y `condiciones: [prediabetes, hta]`; un código inexistente da 400 con los códigos faltantes; la medicación se crea, se edita y la baja lógica la deja fuera de `medicamentos` (historial intacto); la medición con composición devuelve `imc` y `fuente`; y el detalle muestra como última la medición más reciente del día con su IMC.
- **L8** (aislamiento verificado con una segunda nutricionista registrada): `GET /pacientes/:id` de un paciente ajeno da 404 y `POST /pacientes/:id/medicamentos` sobre un paciente ajeno también da 404 (un 403 anterior era solo falta de rol de la cuenta de prueba).
- **L9** (incidente de entorno): detener el servidor de desarrollo no siempre mata el proceso hijo de `nest start --watch`; el puerto 3000 queda tomado por el build viejo y las pruebas en vivo responden con código anterior (EADDRINUSE en el log). Verificar el puerto y matar el PID huérfano antes de reiniciar. Además, correr `npm run build` con el watcher activo vuelve a romper `dist/`.
- **L10** (verificación independiente `mvtud3g8-6-f1ae`): S1-S9 aprobados, sin fugas entre nutricionistas (medicamento ajeno = 404, sin mass assignment, transacción segura). Encontró un defecto de privacidad que rompe S10: `GET /me/citas` y `GET /me/hoy` devolvían la cita completa, así que el paciente veía las notas internas y el SOAP de su nutricionista. También encontró el corrimiento de fecha y que un `null` no borraba las fechas.
- **L11** (correcciones F1-F4, todas reproducidas antes de tocar código): el portal del paciente ahora recibe solo `{id, fechaHora, duracionMin, motivo, estado, nutricionista.nombre}` vía `CITA_PACIENTE_SELECT`, y la documentación se partió en `CitaAgendaEntity` (paciente) y `CitaBasicaEntity` (nutritionista, con notas y SOAP). `proximaCitaSugerida: "2026-12-01T20:00:00-06:00"` pasó de guardarse como 2 de diciembre a 1 de diciembre con `aFecha`. Un `null` explícito borra `proximaCitaSugerida` y `fechaObjetivo`, y `presionDiastolica` acepta desde 40. **114 tests** verdes.
- **L12** (pendientes anotados, fuera de este feature): validación cruzada de signos vitales (diastólica < sistólica) y de composición (masa grasa + masa muscular ≤ peso); `PATCH /pacientes/:id` con correo duplicado responde 500 en vez de 409 (defecto que ya existía en la rama base); y el campo `plan` de la cita debe rotularse "Plan de la consulta" en el portal para no confundirlo con el plan de comida.
