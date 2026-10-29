import type {
  Meta,
  NivelActividad,
  Sexo,
  TipoComida,
} from '../generated/prisma/enums.js';

/** Factor de actividad física (gasto energético total = TMB × factor). */
export const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  SEDENTARIO: 1.2,
  LIGERO: 1.375,
  MODERADO: 1.55,
  INTENSO: 1.725,
  MUY_INTENSO: 1.9,
};

/** Ajuste calórico diario según la meta del paciente. */
export const AJUSTE_META: Record<Meta, number> = {
  BAJAR: -500,
  MANTENER: 0,
  SUBIR: 300,
};

/** Piso calórico para no proponer dietas demasiado restrictivas. */
export const KCAL_MINIMAS: Record<Sexo, number> = { F: 1200, M: 1500 };

export const KCAL_POR_GRAMO = { proteina: 4, carbohidrato: 4, grasa: 9 };

export interface DistribucionMacros {
  proteina: number;
  carbohidrato: number;
  grasa: number;
}

export const DISTRIBUCION_MACROS_DEFAULT: DistribucionMacros = {
  proteina: 0.25,
  carbohidrato: 0.5,
  grasa: 0.25,
};

export const ORDEN_TIEMPOS: TipoComida[] = [
  'DESAYUNO',
  'MERIENDA_AM',
  'ALMUERZO',
  'MERIENDA_PM',
  'CENA',
];

export type DistribucionTiempos = Partial<Record<TipoComida, number>>;

export const DISTRIBUCION_TIEMPOS_DEFAULT: DistribucionTiempos = {
  DESAYUNO: 0.25,
  MERIENDA_AM: 0.1,
  ALMUERZO: 0.35,
  MERIENDA_PM: 0.1,
  CENA: 0.2,
};

/** Tolerancia aceptada entre el plan y la meta calórica (±10 %). */
export const TOLERANCIA_KCAL = 0.1;

export function redondear(valor: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

export function calcularEdad(fechaNacimiento: Date, hoy = new Date()): number {
  let edad = hoy.getUTCFullYear() - fechaNacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - fechaNacimiento.getUTCMonth();
  if (
    mes < 0 ||
    (mes === 0 && hoy.getUTCDate() < fechaNacimiento.getUTCDate())
  ) {
    edad--;
  }
  return edad;
}

/**
 * Tasa metabólica basal — ecuación de Mifflin-St Jeor.
 * TMB = 10·peso(kg) + 6.25·talla(cm) − 5·edad(años) + 5 (hombres) / − 161 (mujeres)
 */
export function tmbMifflinStJeor(p: {
  pesoKg: number;
  tallaCm: number;
  edad: number;
  sexo: Sexo;
}): number {
  const base = 10 * p.pesoKg + 6.25 * p.tallaCm - 5 * p.edad;
  return base + (p.sexo === 'M' ? 5 : -161);
}

export function validarDistribucion(
  valores: Record<string, number | undefined>,
  nombre: string,
): void {
  const suma = Object.values(valores).reduce<number>((a, v) => a + (v ?? 0), 0);
  if (Math.abs(suma - 1) > 0.01) {
    throw new Error(
      `La distribución de ${nombre} debe sumar 100 % (suma ${redondear(suma * 100)} %).`,
    );
  }
}

export function macrosDesdeKcal(kcal: number, dist: DistribucionMacros) {
  return {
    proteinaG: redondear((kcal * dist.proteina) / KCAL_POR_GRAMO.proteina),
    carbohidratoG: redondear(
      (kcal * dist.carbohidrato) / KCAL_POR_GRAMO.carbohidrato,
    ),
    grasaG: redondear((kcal * dist.grasa) / KCAL_POR_GRAMO.grasa),
  };
}

export interface DatosRequerimiento {
  pesoKg: number;
  tallaCm: number;
  fechaNacimiento: Date;
  sexo: Sexo;
  nivelActividad: NivelActividad;
  meta: Meta;
  distribucionMacros?: DistribucionMacros;
}

export interface Requerimiento {
  edad: number;
  tmb: number;
  factorActividad: number;
  gastoTotal: number;
  ajusteMeta: number;
  kcalObjetivo: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
  distribucionMacros: DistribucionMacros;
}

export function calcularRequerimiento(
  d: DatosRequerimiento,
  hoy = new Date(),
): Requerimiento {
  const distribucionMacros =
    d.distribucionMacros ?? DISTRIBUCION_MACROS_DEFAULT;
  validarDistribucion({ ...distribucionMacros }, 'macronutrientes');

  const edad = calcularEdad(d.fechaNacimiento, hoy);
  const tmb = tmbMifflinStJeor({
    pesoKg: d.pesoKg,
    tallaCm: d.tallaCm,
    edad,
    sexo: d.sexo,
  });
  const factorActividad = FACTOR_ACTIVIDAD[d.nivelActividad];
  const gastoTotal = tmb * factorActividad;
  const ajusteMeta = AJUSTE_META[d.meta];
  const kcalObjetivo =
    Math.round(Math.max(gastoTotal + ajusteMeta, KCAL_MINIMAS[d.sexo]) / 10) *
    10;

  return {
    edad,
    tmb: Math.round(tmb),
    factorActividad,
    gastoTotal: Math.round(gastoTotal),
    ajusteMeta,
    kcalObjetivo,
    ...macrosDesdeKcal(kcalObjetivo, distribucionMacros),
    distribucionMacros,
  };
}

export interface NutrientesPorPorcion {
  kcal: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
}

export interface Totales {
  kcal: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
}

export function sumarNutrientes(
  items: { porciones: number; alimento: NutrientesPorPorcion }[],
): Totales {
  const t = items.reduce(
    (acc, { porciones, alimento: a }) => ({
      kcal: acc.kcal + a.kcal * porciones,
      proteinaG: acc.proteinaG + a.proteinaG * porciones,
      carbohidratoG: acc.carbohidratoG + a.carbohidratoG * porciones,
      grasaG: acc.grasaG + a.grasaG * porciones,
    }),
    { kcal: 0, proteinaG: 0, carbohidratoG: 0, grasaG: 0 },
  );
  return {
    kcal: Math.round(t.kcal),
    proteinaG: redondear(t.proteinaG),
    carbohidratoG: redondear(t.carbohidratoG),
    grasaG: redondear(t.grasaG),
  };
}

/** Índice de masa corporal = peso(kg) / talla(m)². */
export function imc(pesoKg: number, tallaCm: number): number {
  const m = tallaCm / 100;
  return redondear(pesoKg / (m * m));
}

/** Desviación relativa respecto a la meta (0.05 = 5 % por encima). */
export function desviacion(real: number, objetivo: number): number {
  return objetivo === 0 ? 0 : redondear((real - objetivo) / objetivo, 3);
}
