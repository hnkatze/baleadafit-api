/**
 * Cálculos de la ficha del paciente. Todo acá es puro: no toca la base ni Nest,
 * así se puede probar y reusar (lo usa el expediente del BO y podría usarlo la
 * app del paciente).
 */

export type ClasificacionImc =
  | 'BAJO_PESO'
  | 'NORMAL'
  | 'SOBREPESO'
  | 'OBESIDAD_I'
  | 'OBESIDAD_II'
  | 'OBESIDAD_III';

/** Clasificación de la OMS por rangos de IMC. */
export function clasificarImc(imc: number): ClasificacionImc {
  if (imc < 18.5) return 'BAJO_PESO';
  if (imc < 25) return 'NORMAL';
  if (imc < 30) return 'SOBREPESO';
  if (imc < 35) return 'OBESIDAD_I';
  if (imc < 40) return 'OBESIDAD_II';
  return 'OBESIDAD_III';
}

export interface MedicionPeso {
  fecha: Date;
  pesoKg: number;
}

export interface ObjetivoPeso {
  pesoKg: number | null;
  fecha: Date | null;
}

export interface Progreso {
  pesoInicial: number | null;
  pesoActual: number | null;
  deltaKg: number | null;
  /** Puede ser negativo (bajando) o positivo (subiendo). */
  ritmoKgSemana: number | null;
  /** Extrapolación lineal al objetivo: es una proyección, no una promesa. */
  proyeccionKg: number | null;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const redondear1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Progreso del peso entre la primera y la última medición, con el ritmo semanal
 * y la proyección a la fecha objetivo. Sin dos mediciones no hay ritmo.
 */
export function progresoDePeso(
  mediciones: MedicionPeso[],
  objetivo: ObjetivoPeso,
  hoy = new Date(),
): Progreso {
  const ordenadas = [...mediciones].sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime(),
  );
  const primera = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  if (!primera || !ultima)
    return {
      pesoInicial: null,
      pesoActual: null,
      deltaKg: null,
      ritmoKgSemana: null,
      proyeccionKg: null,
    };

  const deltaKg = redondear1(ultima.pesoKg - primera.pesoKg);
  const dias = (ultima.fecha.getTime() - primera.fecha.getTime()) / MS_DIA;
  const ritmoKgSemana = dias >= 7 ? redondear1(deltaKg / (dias / 7)) : null;

  let proyeccionKg: number | null = null;
  if (
    ritmoKgSemana !== null &&
    objetivo.fecha &&
    objetivo.pesoKg !== null &&
    objetivo.fecha.getTime() > Math.max(ultima.fecha.getTime(), hoy.getTime())
  ) {
    const diasRestantes =
      (objetivo.fecha.getTime() - ultima.fecha.getTime()) / MS_DIA;
    proyeccionKg = redondear1(
      ultima.pesoKg + ritmoKgSemana * (diasRestantes / 7),
    );
  }

  return {
    pesoInicial: primera.pesoKg,
    pesoActual: ultima.pesoKg,
    deltaKg,
    ritmoKgSemana,
    proyeccionKg,
  };
}

export type TipoAlerta =
  | 'SIN_MEDICION'
  | 'PESO_ESTANCADO'
  | 'SIN_PLAN_ACTIVO'
  | 'PLAN_VIEJO'
  | 'ADHERENCIA_BAJA';

export interface Alerta {
  tipo: TipoAlerta;
  severidad: 'alta' | 'media';
  detalle: string;
}

export interface EntradaAlertas {
  hoy: Date;
  meta: 'BAJAR' | 'MANTENER' | 'SUBIR';
  mediciones: MedicionPeso[];
  planActivo: { creadoEn: Date } | null;
  adherencia: { porcentaje: number | null; total: number };
}

/** Días sin medición a partir de los cuales conviene recordarlo. */
export const DIAS_SIN_MEDICION = 30;
/** Días sin medición que ya son un problema de seguimiento. */
export const DIAS_SIN_MEDICION_GRAVE = 60;
/** Antigüedad del plan activo a partir de la cual revisarlo. */
export const DIAS_PLAN_VIEJO = 90;
/** Cambio de peso por debajo del cual el seguimiento se considera estancado. */
export const KG_ESTANCAMIENTO = 0.5;
/** Registros mínimos para juzgar la adherencia. */
export const REGISTROS_MINIMOS_ADHERENCIA = 10;

/**
 * Alertas de seguimiento calculadas con los datos que el sistema ya tiene.
 * No diagnostican ni aplican umbrales clínicos: eso depende de que el dueño
 * defina los topes por condición.
 */
export function alertasDeFicha(e: EntradaAlertas): Alerta[] {
  const alertas: Alerta[] = [];
  const ordenadas = [...e.mediciones].sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime(),
  );
  const ultima = ordenadas[ordenadas.length - 1];

  if (!ultima) {
    alertas.push({
      tipo: 'SIN_MEDICION',
      severidad: 'alta',
      detalle: 'El paciente no tiene ninguna medición registrada.',
    });
  } else {
    const dias = Math.floor((e.hoy.getTime() - ultima.fecha.getTime()) / MS_DIA);
    if (dias > DIAS_SIN_MEDICION_GRAVE)
      alertas.push({
        tipo: 'SIN_MEDICION',
        severidad: 'alta',
        detalle: `Última medición hace ${dias} días.`,
      });
    else if (dias > DIAS_SIN_MEDICION)
      alertas.push({
        tipo: 'SIN_MEDICION',
        severidad: 'media',
        detalle: `Última medición hace ${dias} días.`,
      });
  }

  // Estancarse es un problema cuando se busca cambiar el peso, no cuando la meta
  // es mantener.
  const ultimasTres = ordenadas.slice(-3);
  if (e.meta !== 'MANTENER' && ultimasTres.length === 3) {
    const cambio = Math.abs(
      ultimasTres[2].pesoKg - ultimasTres[0].pesoKg,
    );
    if (cambio < KG_ESTANCAMIENTO)
      alertas.push({
        tipo: 'PESO_ESTANCADO',
        severidad: 'media',
        detalle: `Las últimas tres mediciones varían menos de ${KG_ESTANCAMIENTO} kg.`,
      });
  }

  if (!e.planActivo) {
    alertas.push({
      tipo: 'SIN_PLAN_ACTIVO',
      severidad: 'alta',
      detalle: 'El paciente no tiene un plan activo.',
    });
  } else {
    const dias = Math.floor(
      (e.hoy.getTime() - e.planActivo.creadoEn.getTime()) / MS_DIA,
    );
    if (dias > DIAS_PLAN_VIEJO)
      alertas.push({
        tipo: 'PLAN_VIEJO',
        severidad: 'media',
        detalle: `El plan activo tiene ${dias} días sin revisarse.`,
      });
  }

  if (
    e.adherencia.total >= REGISTROS_MINIMOS_ADHERENCIA &&
    e.adherencia.porcentaje !== null &&
    e.adherencia.porcentaje < 0.5
  )
    alertas.push({
      tipo: 'ADHERENCIA_BAJA',
      severidad: 'media',
      detalle: `Cumplió el ${Math.round(e.adherencia.porcentaje * 100)} % de las comidas registradas.`,
    });

  return alertas;
}

export interface MedicionComposicion {
  fecha: Date;
  pctGrasa: number | null;
  masaGrasaKg: number | null;
  masaMuscularKg: number | null;
  grasaVisceral: number | null;
}

export interface Composicion {
  pctGrasa: number | null;
  masaGrasaKg: number | null;
  masaMuscularKg: number | null;
  grasaVisceral: number | null;
  /** Fecha de la medición de la que salieron los valores. */
  fecha: Date | null;
}

/**
 * Última medición que trae datos de composición. La última medición puede ser un
 * control de peso sin bioimpedancia, y ahí mostrar "sin datos" borraría el último
 * % de grasa conocido.
 */
export function ultimaComposicion(
  mediciones: MedicionComposicion[],
): Composicion {
  const ordenadas = [...mediciones].sort(
    (a, b) => b.fecha.getTime() - a.fecha.getTime(),
  );
  const conDatos = ordenadas.find(
    (m) =>
      m.pctGrasa !== null ||
      m.masaGrasaKg !== null ||
      m.masaMuscularKg !== null ||
      m.grasaVisceral !== null,
  );
  if (!conDatos)
    return {
      pctGrasa: null,
      masaGrasaKg: null,
      masaMuscularKg: null,
      grasaVisceral: null,
      fecha: null,
    };
  return {
    pctGrasa: conDatos.pctGrasa,
    masaGrasaKg: conDatos.masaGrasaKg,
    masaMuscularKg: conDatos.masaMuscularKg,
    grasaVisceral: conDatos.grasaVisceral,
    fecha: conDatos.fecha,
  };
}
