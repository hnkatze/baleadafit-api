/**
 * Valores que se copian del alimento a cada versión de la tabla nutricional.
 *
 * Módulo puro, sin dependencias de Nest: también lo usa `prisma/seed.ts`, que
 * corre fuera de la aplicación.
 */

/** Campos que, al cambiar, obligan a abrir una versión nueva del alimento. */
export const CAMPOS_VERSION = [
  'porcionDescripcion',
  'porcionGramos',
  'kcal',
  'proteinaG',
  'carbohidratoG',
  'grasaG',
  'fibraG',
  'sodioMg',
  'potasioMg',
  'fosforoMg',
  'azucaresG',
  'grasasSatG',
  'indiceGlucemico',
  'fuente',
] as const;

/** Valores nutricionales y de porción tal como los guarda el alimento. */
export interface ValoresAlimento {
  porcionDescripcion: string;
  porcionGramos: number;
  kcal: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
  fibraG: number | null;
  sodioMg: number | null;
  potasioMg: number | null;
  fosforoMg: number | null;
  azucaresG: number | null;
  grasasSatG: number | null;
  indiceGlucemico: number | null;
  fuente: string | null;
}

/** Fila lista para `alimentoVersion.create`, salvo el `alimentoId`. */
export interface DatosVersion extends ValoresAlimento {
  version: number;
  vigenteDesde: Date;
  tabla: string;
}

/** Cambios recibidos al editar: incluye la identidad, que no se versiona. */
type Cambios = Partial<ValoresAlimento>;

/**
 * Datos de la versión de un alimento. `tabla` es la revisión de la tabla de
 * composición en uso: se configura con `TABLA_NUTRICIONAL` porque cambia cuando
 * se publica una revisión nueva (INCAP, fortificación, reformulación).
 */
export function datosVersion(
  alimento: ValoresAlimento,
  version: number,
  vigenteDesde: Date,
): DatosVersion {
  return {
    version,
    vigenteDesde,
    tabla: process.env.TABLA_NUTRICIONAL ?? 'Inicial',
    fuente: alimento.fuente ?? null,
    porcionDescripcion: alimento.porcionDescripcion,
    porcionGramos: alimento.porcionGramos,
    kcal: alimento.kcal,
    proteinaG: alimento.proteinaG,
    carbohidratoG: alimento.carbohidratoG,
    grasaG: alimento.grasaG,
    fibraG: alimento.fibraG ?? null,
    sodioMg: alimento.sodioMg ?? null,
    potasioMg: alimento.potasioMg ?? null,
    fosforoMg: alimento.fosforoMg ?? null,
    azucaresG: alimento.azucaresG ?? null,
    grasasSatG: alimento.grasasSatG ?? null,
    indiceGlucemico: alimento.indiceGlucemico ?? null,
  };
}

/**
 * ¿La edición toca los valores nutricionales o la porción? Los nulos explícitos
 * cuentan como valor: vaciar un nutriente también es un cambio de la tabla.
 */
export function cambianValores(
  actual: ValoresAlimento,
  cambios: Cambios,
): boolean {
  return CAMPOS_VERSION.some((campo) => {
    const nuevo = cambios[campo];
    return nuevo !== undefined && (actual[campo] ?? null) !== (nuevo ?? null);
  });
}