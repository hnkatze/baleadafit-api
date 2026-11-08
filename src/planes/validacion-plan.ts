/**
 * Validación estricta de la salida del modelo.
 *
 * Reemplaza el cast `as T` de `ia/bedrock.service.ts`: hoy un JSON del modelo
 * llega a la base sin verificar. Con 5 slots era tolerable; con una semana son
 * 35 slots, y un id inventado o una porción absurda se persisten igual.
 *
 * No rechaza el día entero: devuelve los slots que pasaron y los que fallaron,
 * para que la capa de reparación arregle solo lo roto.
 */
import { ORDEN_TIEMPOS } from '../nutricion/nutricion.util.js';

export const PORCION_MINIMA = 0.5;
export const PORCION_MAXIMA = 4;

export type MotivoError =
  | 'forma-invalida'
  | 'tipo-desconocido'
  | 'tipo-duplicado'
  | 'items-vacios'
  | 'alimento-desconocido'
  | 'alimento-duplicado'
  | 'porciones-invalidas'
  | 'porciones-fuera-de-rango';

export interface ItemValidado {
  alimentoId: string;
  porciones: number;
}

export interface TiempoValidado {
  tipo: string;
  items: ItemValidado[];
}

export interface ErrorSlot {
  tipo: string;
  motivo: MotivoError;
  detalle?: string;
}

export interface ResultadoValidacion {
  ok: boolean;
  resumen: string;
  /** Slots completos y válidos: lo único seguro de persistir tal cual. */
  tiempos: TiempoValidado[];
  /**
   * Slots con algún item roto pero con items sobrevivientes. NO se persisten:
   * son insumo de la capa de reparación, que decide si rellena o regenera.
   */
  parciales: TiempoValidado[];
  errores: ErrorSlot[];
  /** Tipos esperados que no vinieron en la respuesta. */
  faltantes: string[];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function validarItem(
  crudo: unknown,
  idsValidos: ReadonlySet<string>,
  vistos: Set<string>,
): { item?: ItemValidado; error?: ErrorSlot } {
  if (!esObjeto(crudo)) {
    return { error: { tipo: '*', motivo: 'forma-invalida', detalle: 'el item no es un objeto' } };
  }

  const alimentoId = crudo.alimentoId;
  if (typeof alimentoId !== 'string' || alimentoId.trim() === '') {
    return { error: { tipo: '*', motivo: 'forma-invalida', detalle: 'alimentoId ausente o no textual' } };
  }
  if (!idsValidos.has(alimentoId)) {
    return { error: { tipo: '*', motivo: 'alimento-desconocido', detalle: alimentoId } };
  }
  if (vistos.has(alimentoId)) {
    return { error: { tipo: '*', motivo: 'alimento-duplicado', detalle: alimentoId } };
  }

  const porciones = crudo.porciones;
  if (typeof porciones !== 'number' || !Number.isFinite(porciones)) {
    return { error: { tipo: '*', motivo: 'porciones-invalidas', detalle: String(porciones) } };
  }
  if (porciones < PORCION_MINIMA || porciones > PORCION_MAXIMA) {
    return {
      error: {
        tipo: '*',
        motivo: 'porciones-fuera-de-rango',
        detalle: `${porciones} fuera de [${PORCION_MINIMA}, ${PORCION_MAXIMA}]`,
      },
    };
  }

  return { item: { alimentoId, porciones: Math.round(porciones * 100) / 100 } };
}

/**
 * Valida la respuesta cruda del modelo contra el catálogo vigente.
 *
 * @param entrada JSON parseado del modelo (sin confiar en su forma).
 * @param idsValidos ids del catálogo que el modelo tenía permitido elegir.
 * @param esperados tipos de comida que el plan debe cubrir.
 */
export function validarPlan(
  entrada: unknown,
  idsValidos: ReadonlySet<string>,
  esperados: readonly string[] = ORDEN_TIEMPOS,
): ResultadoValidacion {
  if (!esObjeto(entrada) || !Array.isArray(entrada.tiempos)) {
    return {
      ok: false,
      resumen: '',
      tiempos: [],
      parciales: [],
      errores: [{ tipo: '*', motivo: 'forma-invalida', detalle: 'falta el arreglo tiempos' }],
      faltantes: [...esperados],
    };
  }

  const resumen = typeof entrada.resumen === 'string' ? entrada.resumen.trim() : '';
  const permitidos = new Set(esperados);
  const tiposVistos = new Set<string>();
  const tiempos: TiempoValidado[] = [];
  const parciales: TiempoValidado[] = [];
  const errores: ErrorSlot[] = [];

  for (const crudo of entrada.tiempos) {
    if (!esObjeto(crudo)) {
      errores.push({ tipo: '*', motivo: 'forma-invalida', detalle: 'el tiempo no es un objeto' });
      continue;
    }

    const tipo = typeof crudo.tipo === 'string' ? crudo.tipo.trim().toUpperCase() : '';
    if (!permitidos.has(tipo)) {
      errores.push({ tipo: tipo || '*', motivo: 'tipo-desconocido', detalle: String(crudo.tipo) });
      continue;
    }
    if (tiposVistos.has(tipo)) {
      errores.push({ tipo, motivo: 'tipo-duplicado' });
      continue;
    }
    tiposVistos.add(tipo);

    if (!Array.isArray(crudo.items) || crudo.items.length === 0) {
      errores.push({ tipo, motivo: 'items-vacios' });
      continue;
    }

    const vistos = new Set<string>();
    const items: ItemValidado[] = [];
    let slotRoto = false;

    for (const itemCrudo of crudo.items) {
      const { item, error } = validarItem(itemCrudo, idsValidos, vistos);
      if (error) {
        errores.push({ ...error, tipo });
        slotRoto = true;
        continue;
      }
      if (item) {
        vistos.add(item.alimentoId);
        items.push(item);
      }
    }

    if (!slotRoto) {
      tiempos.push({ tipo, items });
    } else if (items.length > 0) {
      parciales.push({ tipo, items });
    }
  }

  const faltantes = esperados.filter((tipo) => !tiposVistos.has(tipo));

  return {
    ok: errores.length === 0 && faltantes.length === 0,
    resumen,
    tiempos,
    parciales,
    errores,
    faltantes,
  };
}
