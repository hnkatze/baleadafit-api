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
- [x] N2 — Seed: valores para los 150 alimentos con validación de coherencia (S1, S2) — commit del seed con los seis nutrientes más fibra
- [x] N2b — Completar la fibra de los 150 alimentos (quedó nula en la primera pasada; la detectó el orquestador revisando la base)
- [ ] N3 — Totales del plan y de la ficha con los nutrientes nuevos y carga glucémica (S3, S6)
- [ ] N4 — Catálogo: DTO, validaciones y Swagger (S5)
- [ ] N5 — Reglas y agente: usar los nutrientes por condición (S3, siguiente slice)
- [ ] N6 — README y OpenAPI al día

## Log

- **L1** (pedido del dueño, verbatim): "a eso me refiero, todo eso deberia existir para los alimentos, y toda esa info deberia estar en los alimentos en la ficha del paciente, por eso vamos a registrar todo todo"
- **L2** (decisión): se elige la opción de nutrientes reales por alimento en lugar de etiquetas por condición, porque el objetivo es que la ficha clínica muestre números y que las reglas puedan aplicar umbrales.
- **L3** (límite asumido): los valores son estimaciones de receta, no mediciones de laboratorio. Se mantiene la advertencia de verificación INCAP que ya tiene el catálogo, y se valida coherencia interna (fibra y azúcares no pueden pasar los carbohidratos, IG entre 0 y 110) en vez de pretender exactitud.
- **L4** (pendiente de decisión clínica): los umbrales por condición (sodio diario en HTA, potasio y fósforo en ERC) los define el feature N5; se propondrán valores conservadores y documentados, no inventados en el código.
- **L5** (defecto encontrado al revisar el trabajo del worker): la primera pasada del mapa de nutrientes no incluía `fibraG`, así que los 150 alimentos quedaban con `fibra_g` nulo aunque la fibra es la que sostiene las recomendaciones en prediabetes y dislipidemia. Se completó en N2b: 150/150 con fibra, 115 con fibra > 0 (los 35 ceros son carnes, huevos, quesos, aceites y café solo, que efectivamente no aportan).
- **L6** (decisión sobre la banda de grasas): el worker rompió a propósito la banda "0-1 g de fibra" para aguacate, coco, maní, girasol y chía (2.4-8.2 g), porque esos alimentos aportan fibra real. Se acepta: la instrucción era una guía, y subestimar la fibra para cumplirla sería peor dato.
- **L7** (evidencia contra la API viva): el plan de prueba muestra por día 1537 kcal, fibra 27.5 g, sodio 3010 mg, potasio 3383 mg, fósforo 980 mg, azúcares 43.8 g, grasa saturada 16 g y carga glucémica 95.8, y el mismo desglose por tiempo de comida. El sodio del día queda 50 % arriba de la referencia de 2000 mg: es exactamente lo que N5 debe corregir para un paciente hipertenso.
- **L8** (aclaración): el reporte del worker decía que N3/N4 no totalizaban ni exponían la fibra; es incorrecto, `sumarNutrientes` ya la totaliza y `TotalesEntity` la declara — verificado con el plan de prueba (`fibraG: 27.5`).
