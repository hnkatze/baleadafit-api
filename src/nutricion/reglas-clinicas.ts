/**
 * Reglas clínicas verificables sobre el plan de UN día.
 *
 * Viven en código y no en el prompt por una razón medida: un plan de 1800 kcal
 * pedido a tres modelos distintos salió entre 1540 y 2710 kcal, y en la misma
 * corrida un desayuno de 250-450 kcal salió en 636. El modelo elige bien los
 * alimentos; no hace aritmética ni respeta techos.
 *
 * Todo acá es puro: sin Nest, sin Prisma, sin Bedrock, sin I/O.
 */
import type { PerfilClinico } from '../pacientes/perfil-clinico.js';

/** Códigos de condición que esta capa sabe verificar. */
export type CondicionCodigo = 'HTA' | 'ERC' | 'DIABETES';

/** Nutrientes clínicos del catálogo. Los cuatro son nullable: el dato puede faltar. */
export interface NutrientesClinicos {
  sodioMg?: number | null;
  potasioMg?: number | null;
  fosforoMg?: number | null;
  indiceGlucemico?: number | null;
}

/** Un alimento tal como quedó seleccionado en el plan del día. */
export interface AlimentoDelDia extends NutrientesClinicos {
  id: string;
  nombre: string;
  porciones: number;
}

/**
 * Techos diarios por condición.
 *
 * ATENCIÓN: son valores clínicos de referencia, no una prescripción. Deben ser
 * revisados por quien responda clínicamente por la app antes de producción, y
 * ajustarse por paciente (ERC tiene estadios, HTA tiene grados). Están acá
 * centralizados justamente para que ese ajuste sea un cambio de una línea.
 */
export const LIMITES_DIARIOS: Readonly<Record<CondicionCodigo, Partial<Record<NutrienteLimitado, number>>>> = {
  HTA: { sodioMg: 2000 },
  ERC: { potasioMg: 3000, fosforoMg: 1000 },
  DIABETES: {},
};

/** Techo del índice glucémico promedio del día (diabetes). */
export const IG_PROMEDIO_MAXIMO = 55;

export type NutrienteLimitado = 'sodioMg' | 'potasioMg' | 'fosforoMg';

export interface Violacion {
  condicion: CondicionCodigo;
  nutriente: NutrienteLimitado | 'indiceGlucemico';
  limite: number;
  actual: number;
  excedidoEn: number;
  /** Alimentos que aportaron al exceso, de mayor a menor. */
  responsables: { id: string; nombre: string; aporte: number }[];
}

export interface Incognita {
  condicion: CondicionCodigo;
  nutriente: NutrienteLimitado | 'indiceGlucemico';
  /** Alimentos sin dato: no suman 0, se informan. */
  sinDato: { id: string; nombre: string }[];
  /** Lo que sí se pudo verificar, como piso. */
  conocido: number;
  nota: string;
}

export interface ResultadoReglasClinicas {
  /** Condiciones que esta capa supo interpretar del expediente. */
  evaluadas: CondicionCodigo[];
  /** Condiciones presentes en el expediente que esta capa NO verifica. */
  noVerificadas: string[];
  violaciones: Violacion[];
  incognitas: Incognita[];
  /**
   * true solo si no hay violaciones Y no hay incógnitas en una condición
   * evaluada. Una incógnita nunca se considera "pasa".
   */
  ok: boolean;
}

const SIN_ACENTOS = /[\u0300-\u036f]/g;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(SIN_ACENTOS, '').toLowerCase().trim();
}

const PATRONES: ReadonlyArray<{ codigo: CondicionCodigo; patrones: string[] }> = [
  { codigo: 'HTA', patrones: ['hta', 'hipertension', 'hipertenso'] },
  { codigo: 'ERC', patrones: ['erc', 'enfermedad renal', 'renal cronica', 'rinon cronico', 'insuficiencia renal'] },
  { codigo: 'DIABETES', patrones: ['diabetes', 'diabetico', 'diabetica'] },
];

export interface CondicionesDetectadas {
  evaluadas: CondicionCodigo[];
  noVerificadas: string[];
}

/**
 * Separa las condiciones del expediente en las que esta capa sabe verificar y
 * las que no. Las no verificadas se informan en vez de ignorarse en silencio.
 */
export function detectarCondiciones(perfil: Pick<PerfilClinico, 'condiciones'>): CondicionesDetectadas {
  const evaluadas = new Set<CondicionCodigo>();
  const noVerificadas: string[] = [];

  for (const condicion of perfil.condiciones ?? []) {
    const texto = normalizar(`${condicion.nombre} ${condicion.descripcion ?? ''}`);
    const match = PATRONES.find((p) => p.patrones.some((patron) => texto.includes(patron)));
    if (match) {
      evaluadas.add(match.codigo);
    } else if (condicion.nombre.trim()) {
      noVerificadas.push(condicion.nombre.trim());
    }
  }

  return { evaluadas: [...evaluadas], noVerificadas };
}

function aporte(alimento: AlimentoDelDia, nutriente: NutrienteLimitado): number | null {
  const valor = alimento[nutriente];
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  return valor * alimento.porciones;
}

function evaluarTecho(
  condicion: CondicionCodigo,
  nutriente: NutrienteLimitado,
  limite: number,
  alimentos: AlimentoDelDia[],
): { violacion?: Violacion; incognita?: Incognita } {
  let conocido = 0;
  const responsables: Violacion['responsables'] = [];
  const sinDato: Incognita['sinDato'] = [];

  for (const alimento of alimentos) {
    const valor = aporte(alimento, nutriente);
    if (valor === null) {
      sinDato.push({ id: alimento.id, nombre: alimento.nombre });
      continue;
    }
    conocido += valor;
    if (valor > 0) {
      responsables.push({ id: alimento.id, nombre: alimento.nombre, aporte: Math.round(valor) });
    }
  }

  const redondeado = Math.round(conocido);

  if (redondeado > limite) {
    return {
      violacion: {
        condicion,
        nutriente,
        limite,
        actual: redondeado,
        excedidoEn: redondeado - limite,
        responsables: responsables.sort((a, b) => b.aporte - a.aporte),
      },
    };
  }

  // Suma conocida dentro del techo, pero hay alimentos sin dato: no se puede
  // afirmar que el día pase. Se informa como incógnita.
  if (sinDato.length > 0) {
    return {
      incognita: {
        condicion,
        nutriente,
        sinDato,
        conocido: redondeado,
        nota: `Suma conocida ${redondeado} de un techo de ${limite}: faltan datos en ${sinDato.length} alimento(s).`,
      },
    };
  }

  return {};
}

/**
 * Evalúa el día completo contra las condiciones verificables del expediente.
 * Nunca lanza: el llamador recibe violaciones e incógnitas por separado.
 */
export function evaluarReglasClinicas(
  perfil: Pick<PerfilClinico, 'condiciones'>,
  alimentos: AlimentoDelDia[],
): ResultadoReglasClinicas {
  const { evaluadas, noVerificadas } = detectarCondiciones(perfil);
  const violaciones: Violacion[] = [];
  const incognitas: Incognita[] = [];

  for (const condicion of evaluadas) {
    for (const [nutriente, limite] of Object.entries(LIMITES_DIARIOS[condicion]) as [
      NutrienteLimitado,
      number,
    ][]) {
      const resultado = evaluarTecho(condicion, nutriente, limite, alimentos);
      if (resultado.violacion) violaciones.push(resultado.violacion);
      if (resultado.incognita) incognitas.push(resultado.incognita);
    }

    if (condicion === 'DIABETES') {
      const conDato = alimentos.filter(
        (a) => a.indiceGlucemico !== null && a.indiceGlucemico !== undefined && Number.isFinite(a.indiceGlucemico),
      );
      const sinDato = alimentos
        .filter((a) => a.indiceGlucemico === null || a.indiceGlucemico === undefined)
        .map((a) => ({ id: a.id, nombre: a.nombre }));

      if (conDato.length > 0) {
        const promedio = Math.round(
          conDato.reduce((suma, a) => suma + (a.indiceGlucemico as number), 0) / conDato.length,
        );
        if (promedio > IG_PROMEDIO_MAXIMO) {
          violaciones.push({
            condicion,
            nutriente: 'indiceGlucemico',
            limite: IG_PROMEDIO_MAXIMO,
            actual: promedio,
            excedidoEn: promedio - IG_PROMEDIO_MAXIMO,
            responsables: conDato
              .filter((a) => (a.indiceGlucemico as number) > IG_PROMEDIO_MAXIMO)
              .map((a) => ({ id: a.id, nombre: a.nombre, aporte: a.indiceGlucemico as number }))
              .sort((a, b) => b.aporte - a.aporte),
          });
        }
      }

      if (sinDato.length > 0) {
        incognitas.push({
          condicion,
          nutriente: 'indiceGlucemico',
          sinDato,
          conocido: conDato.length,
          nota: `Índice glucémico sin dato en ${sinDato.length} alimento(s); el promedio no cubre el día completo.`,
        });
      }
    }
  }

  return {
    evaluadas,
    noVerificadas,
    violaciones,
    incognitas,
    ok: violaciones.length === 0 && incognitas.length === 0,
  };
}
