import type {
  CategoriaAlimento,
  TipoComida,
} from '../generated/prisma/enums.js';
import { ORDEN_TIEMPOS, type DistribucionTiempos } from './nutricion.util.js';

export interface AlimentoCatalogo {
  id: string;
  nombre: string;
  categoria: CategoriaAlimento;
  porcionDescripcion: string;
  kcal: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
  tiposComida: TipoComida[];
}

export interface ItemPropuesto {
  alimentoId: string;
  porciones: number;
}

export interface TiempoPropuesto {
  tipo: TipoComida;
  pctKcal: number;
  items: ItemPropuesto[];
}

export const PORCION_MIN = 0.5;
export const PORCION_MAX = 3;
/** Ajuste en cuartos de porción (¼ taza, ¼ de unidad…). */
const PASO = 0.25;

const esMerienda = (t: TipoComida) =>
  t === 'MERIENDA_AM' || t === 'MERIENDA_PM';

/** Elige de forma determinista (misma semilla → mismo plan). */
function elegir<T>(lista: T[], semilla: number): T | undefined {
  if (lista.length === 0) return undefined;
  return lista[Math.abs(semilla) % lista.length];
}

const redondearPaso = (v: number) => Math.round(v / PASO) * PASO;
const acotar = (v: number) => Math.min(PORCION_MAX, Math.max(PORCION_MIN, v));

/** Tope de combinaciones del ajuste fino; por encima se deja la escala proporcional. */
const MAX_COMBINACIONES = 200_000;

/** Valores de porción válidos en cuartos, de PORCION_MIN a PORCION_MAX. */
function cuartosPosibles(): number[] {
  const valores: number[] = [];
  const min = Math.ceil(PORCION_MIN / PASO);
  const max = Math.floor(PORCION_MAX / PASO);
  for (let p = min; p <= max; p++) valores.push(p * PASO);
  return valores;
}

/**
 * Escala las porciones para acercar el total de kcal a la meta del tiempo de comida.
 * Las verduras se dejan en su porción (aportan poco y conviene no reducirlas).
 */
export function ajustarPorciones(
  items: ItemPropuesto[],
  catalogo: Map<string, AlimentoCatalogo>,
  kcalMeta: number,
): ItemPropuesto[] {
  const conAlimento = items
    .map((i) => ({ ...i, a: catalogo.get(i.alimentoId) }))
    .filter(
      (i): i is ItemPropuesto & { a: AlimentoCatalogo } => i.a !== undefined,
    );
  if (conAlimento.length === 0) return [];

  const escalable = (i: { a: AlimentoCatalogo }) => i.a.categoria !== 'VERDURA';
  const total = () =>
    conAlimento.reduce((s, i) => s + i.a.kcal * i.porciones, 0);

  const fijo = conAlimento
    .filter((i) => !escalable(i))
    .reduce((s, i) => s + i.a.kcal * i.porciones, 0);
  const variable = conAlimento
    .filter(escalable)
    .reduce((s, i) => s + i.a.kcal * i.porciones, 0);
  if (variable > 0) {
    const factor = (kcalMeta - fijo) / variable;
    for (const i of conAlimento) {
      if (escalable(i))
        i.porciones = acotar(redondearPaso(i.porciones * factor));
    }
  }

  // Ajuste fino: se prueban las combinaciones de cuartos de los alimentos
  // escalables y se devuelve la que deja el tiempo de comida más cerca de la
  // meta (desempate: la más próxima a la escala proporcional). Antes se sumaba
  // o restaba ¼ al alimento más denso, lo que en metas chicas oscilaba entre
  // dos estados y dejaba el tiempo hasta 20 % fuera de la tolerancia.
  const escalables = conAlimento.filter(escalable);
  if (escalables.length > 0) {
    const opciones = cuartosPosibles();
    const combinaciones = opciones.length ** escalables.length;
    if (combinaciones <= MAX_COMBINACIONES) {
      const base = escalables.map((i) => i.porciones);
      const actual = [...base];
      const kcalFija = conAlimento
        .filter((i) => !escalable(i))
        .reduce((s, i) => s + i.a.kcal * i.porciones, 0);
      const distancia = (v: number[]) =>
        v.reduce((s, porcion, k) => s + (porcion - base[k]) ** 2, 0);

      let mejor = base;
      let mejorDiff = Math.abs(total() - kcalMeta);

      const evaluar = () => {
        const kcal =
          kcalFija + escalables.reduce((s, i, k) => s + i.a.kcal * actual[k], 0);
        const diff = Math.abs(kcal - kcalMeta);
        if (
          diff < mejorDiff ||
          (diff === mejorDiff && distancia(actual) < distancia(mejor))
        ) {
          mejorDiff = diff;
          mejor = [...actual];
        }
      };
      const buscar = (idx: number) => {
        if (idx === escalables.length) return evaluar();
        for (const p of opciones) {
          actual[idx] = p;
          buscar(idx + 1);
        }
      };
      buscar(0);
      escalables.forEach((i, k) => {
        i.porciones = mejor[k];
      });
    }
  }

  return conAlimento.map(({ alimentoId, porciones }) => ({
    alimentoId,
    porciones,
  }));
}

function proponerTiempo(
  tipo: TipoComida,
  catalogo: AlimentoCatalogo[],
  semilla: number,
): ItemPropuesto[] {
  const aptos = catalogo.filter((a) => a.tiposComida.includes(tipo));
  const de = (...cats: CategoriaAlimento[]) =>
    aptos.filter((a) => cats.includes(a.categoria));
  const elegidos: (AlimentoCatalogo | undefined)[] = [];

  if (esMerienda(tipo)) {
    elegidos.push(elegir(de('FRUTA'), semilla));
    elegidos.push(elegir(de('LACTEO', 'GRASA', 'PROTEINA'), semilla + 1));
  } else {
    const platos = de('PLATO_TIPICO');
    // En días alternos se usa un plato típico completo; si no, proteína + acompañante.
    const usarPlato = platos.length > 0 && semilla % 2 === 0;
    if (usarPlato) {
      elegidos.push(elegir(platos, semilla));
    } else {
      elegidos.push(elegir(de('PROTEINA'), semilla));
      elegidos.push(elegir(de('LEGUMINOSA', 'CEREAL_TUBERCULO'), semilla + 1));
    }
    elegidos.push(
      tipo === 'DESAYUNO'
        ? elegir(de('FRUTA', 'VERDURA'), semilla + 2)
        : elegir(de('VERDURA'), semilla + 2),
    );
  }

  const unicos = new Map<string, ItemPropuesto>();
  for (const a of elegidos) {
    if (a) unicos.set(a.id, { alimentoId: a.id, porciones: 1 });
  }
  return [...unicos.values()];
}

/**
 * Recomendador por reglas: arma un plan con alimentos del catálogo ya filtrado por
 * las restricciones del paciente y ajusta porciones a la meta de cada tiempo de comida.
 * Se usa solo o como respaldo cuando la IA no está disponible.
 */
export function generarPlanPorReglas(
  catalogo: AlimentoCatalogo[],
  kcalObjetivo: number,
  distribucion: DistribucionTiempos,
  semilla = 0,
): TiempoPropuesto[] {
  const mapa = new Map(catalogo.map((a) => [a.id, a]));
  return ORDEN_TIEMPOS.filter((t) => (distribucion[t] ?? 0) > 0).map(
    (tipo, idx) => {
      const pctKcal = distribucion[tipo] ?? 0;
      const base = proponerTiempo(tipo, catalogo, semilla + idx * 3);
      return {
        tipo,
        pctKcal,
        items: ajustarPorciones(base, mapa, kcalObjetivo * pctKcal),
      };
    },
  );
}
