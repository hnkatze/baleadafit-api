# Nutrientes clínicos en los alimentos

El catálogo sabe kcal y macros, pero no sodio, potasio, fósforo, azúcares ni índice glucémico, así que las condiciones clínicas del expediente (HTA, ERC, prediabetes) se le pueden explicar al agente pero no verificarse. Este feature registra esos nutrientes en cada alimento, los totaliza en el plan y los muestra en la ficha del paciente.

## Specs

- **S1** — "todo eso debería existir para los alimentos": cada alimento registra sodio, potasio, fósforo, azúcares, grasa saturada e índice glucémico por porción, además de la fibra que ya tenía.
- **S2** — Los valores son por porción, igual que kcal y macros, y son estimaciones a verificar contra INCAP como el resto del catálogo.
- **S3** — "toda esa info debería estar en los alimentos en la ficha del paciente": el plan y la ficha muestran el total de esos nutrientes por tiempo de comida y por día, junto con la carga glucémica.
- **S4** — Un nutriente sin dato no se inventa: si el alimento no lo tiene, aporta 0 al total (el total es un piso, no una promesa) y `indiceGlucemico` puede quedar nulo en alimentos que no lo tienen (carnes, aceites).
- **S5** — La API expone los campos nuevos en el catálogo y valida rangos al crear o editar alimentos.
- **S6** — Nada de lo existente se rompe: los totales siguen trayendo kcal y macros como siempre.

## Tasks

- [ ] N1 — Modelo y migración: nutrientes clínicos en `alimento` (S1, S4)
- [ ] N2 — Seed: valores para los 150 alimentos con validación de coherencia (S1, S2)
- [ ] N3 — Totales del plan y de la ficha con los nutrientes nuevos y carga glucémica (S3, S6)
- [ ] N4 — Catálogo: DTO, validaciones y Swagger (S5)
- [ ] N5 — Reglas y agente: usar los nutrientes por condición (S3, siguiente slice)
- [ ] N6 — README y OpenAPI al día

## Log

- **L1** (pedido del dueño, verbatim): "a eso me refiero, todo eso deberia existir para los alimentos, y toda esa info deberia estar en los alimentos en la ficha del paciente, por eso vamos a registrar todo todo"
- **L2** (decisión): se elige la opción de nutrientes reales por alimento en lugar de etiquetas por condición, porque el objetivo es que la ficha clínica muestre números y que las reglas puedan aplicar umbrales.
- **L3** (límite asumido): los valores son estimaciones de receta, no mediciones de laboratorio. Se mantiene la advertencia de verificación INCAP que ya tiene el catálogo, y se valida coherencia interna (fibra y azúcares no pueden pasar los carbohidratos, IG entre 0 y 110) en vez de pretender exactitud.
- **L4** (pendiente de decisión clínica): los umbrales por condición (sodio diario en HTA, potasio y fósforo en ERC) los define el feature N5; se propondrán valores conservadores y documentados, no inventados en el código.
