/**
 * Variedad semanal controlada en código.
 *
 * El prompt pide variedad y los modelos la cumplen a medias: en la medición de
 * L12, Nova Lite repitió el alimento principal en 5 de 7 días consecutivos. Con
 * 35 slots el problema deja de ser cosmético, así que se resuelve acá:
 *
 *  - techo de apariciones por alimento en la semana,
 *  - un plato típico no se repite en días consecutivos,
 *  - mínimo de fuentes proteicas distintas.
 *
 * Es best effort y nunca rompe el plan: si no hay alternativa en el catálogo,
 * el alimento se queda y el límite no alcanzado se informa en `cambios`.
 *
 * Puro: sin Nest, sin Prisma, sin I/O.
 */
import type { AlimentoCatalogo, TiempoPropuesto } from './generador-reglas.js';

export interface OpcionesVariedad {
  /** Apariciones máximas de un mismo alimento en la semana. */
  maxApariciones: number;
  /** Fuentes proteicas distintas mínimas en la semana. */
  minFuentesProteicas: number;
}

export const VARIEDAD_POR_DEFECTO: OpcionesVariedad = {
  /** Cinco comidas al día por siete días: cuatro apariciones ya son 8 % de la semana. */
  maxApariciones: 3,
  minFuentesProteicas: 4,
};

export interface DiaParaVariedad {
  dia: string;
  tiempos: TiempoPropuesto[];
}

export interface ResultadoVariedad<D extends DiaParaVariedad> {
  dias: D[];
  /** Cambios aplicados y límites que no se pudieron alcanzar. */
  cambios: string[];
}

/** Categorías que cuentan como fuente proteica para el mínimo semanal. */
const FUENTES_PROTEICAS = new Set(['PROTEINA', 'LEGUMINOSA']);

interface Slot {
  dia: number;
  tiempo: number;
  item: number;
}

/**
 * Ajusta la semana completa. No muta la entrada: devuelve días nuevos.
 */
export function ajustarVariedadSemanal<D extends DiaParaVariedad>(
  dias: D[],
  catalogo: AlimentoCatalogo[],
  opciones: OpcionesVariedad = VARIEDAD_POR_DEFECTO,
): ResultadoVariedad<D> {
  const mapa = new Map(catalogo.map((a) => [a.id, a]));
  const cambios: string[] = [];
  const salida: D[] = dias.map((d) => ({
    ...d,
    tiempos: d.tiempos.map((t) => ({
      ...t,
      items: t.items.map((i) => ({ ...i })),
    })),
  }));

  const conteo = new Map<string, number>();
  const sumar = (id: string, delta: number) =>
    conteo.set(id, (conteo.get(id) ?? 0) + delta);
  for (const dia of salida)
    for (const tiempo of dia.tiempos)
      for (const item of tiempo.items) sumar(item.alimentoId, 1);

  const enSlot = (s: Slot) =>
    salida[s.dia].tiempos[s.tiempo].items[s.item]?.alimentoId;
  const nombre = (id: string) => mapa.get(id)?.nombre ?? id;

  /** Candidato de reemplazo: misma categoría, sirve en ese tiempo y está poco usado. */
  const candidatos = (
    actual: string,
    tipo: string,
    excluir: ReadonlySet<string>,
  ): AlimentoCatalogo[] => {
    const categoria = mapa.get(actual)?.categoria;
    return catalogo
      .filter(
        (a) =>
          a.id !== actual &&
          a.categoria === categoria &&
          a.tiposComida.some((t) => t === tipo) &&
          !excluir.has(a.id),
      )
      .sort(
        (a, b) =>
          (conteo.get(a.id) ?? 0) - (conteo.get(b.id) ?? 0) ||
          a.nombre.localeCompare(b.nombre),
      );
  };

  const reemplazar = (s: Slot, nuevo: AlimentoCatalogo, motivo: string) => {
    const anterior = enSlot(s);
    if (!anterior) return false;
    salida[s.dia].tiempos[s.tiempo].items[s.item] = {
      ...salida[s.dia].tiempos[s.tiempo].items[s.item],
      alimentoId: nuevo.id,
    };
    sumar(anterior, -1);
    sumar(nuevo.id, 1);
    cambios.push(
      `${salida[s.dia].dia}: ${nombre(anterior)} → ${nuevo.nombre} (${motivo})`,
    );
    return true;
  };

  // 1. Un plato típico no se repite en días consecutivos.
  for (let dia = 1; dia < salida.length; dia++) {
    for (let tiempo = 0; tiempo < salida[dia].tiempos.length; tiempo++) {
      const delDia = salida[dia].tiempos[tiempo];
      const previo = salida[dia - 1]?.tiempos[tiempo];
      if (!previo) continue;
      for (let item = 0; item < delDia.items.length; item++) {
        const actual = delDia.items[item].alimentoId;
        if (mapa.get(actual)?.categoria !== 'PLATO_TIPICO') continue;
        const repetido = previo.items.some((i) => i.alimentoId === actual);
        if (!repetido) continue;
        const enEsteSlot = new Set(delDia.items.map((i) => i.alimentoId));
        const nuevo = candidatos(actual, delDia.tipo, enEsteSlot)[0];
        if (nuevo)
          reemplazar({ dia, tiempo, item }, nuevo, 'no se repite en días seguidos');
      }
    }
  }

  // 2. Techo de apariciones por alimento. Se acepta en orden: las primeras
  // apariciones se quedan y el recorte empieza cuando ya se llegó al techo.
  const aceptadas = new Map<string, number>();
  for (let dia = 0; dia < salida.length; dia++) {
    for (let tiempo = 0; tiempo < salida[dia].tiempos.length; tiempo++) {
      const delDia = salida[dia].tiempos[tiempo];
      for (let item = 0; item < salida[dia].tiempos[tiempo].items.length; item++) {
        const actual = enSlot({ dia, tiempo, item })!;
        const usadas = aceptadas.get(actual) ?? 0;
        if (usadas < opciones.maxApariciones) {
          aceptadas.set(actual, usadas + 1);
          continue;
        }
        const enEsteSlot = new Set(delDia.items.map((i) => i.alimentoId));
        const nuevo = candidatos(actual, delDia.tipo, enEsteSlot).find(
          (a) => (aceptadas.get(a.id) ?? 0) < opciones.maxApariciones,
        );
        if (nuevo) {
          reemplazar(
            { dia, tiempo, item },
            nuevo,
            `tope de ${opciones.maxApariciones} apariciones`,
          );
          aceptadas.set(nuevo.id, (aceptadas.get(nuevo.id) ?? 0) + 1);
        }
      }
    }
  }

  // 3. Mínimo de fuentes proteicas distintas.
  const proteicasUsadas = () =>
    new Set([...conteo.keys()].filter((id) => conteo.get(id)! > 0 && FUENTES_PROTEICAS.has(mapa.get(id)?.categoria ?? '')));
  if (proteicasUsadas().size < opciones.minFuentesProteicas) {
    for (let dia = 0; dia < salida.length; dia++) {
      if (proteicasUsadas().size >= opciones.minFuentesProteicas) break;
      for (let tiempo = 0; tiempo < salida[dia].tiempos.length; tiempo++) {
        if (proteicasUsadas().size >= opciones.minFuentesProteicas) break;
        const delDia = salida[dia].tiempos[tiempo];
        for (let item = 0; item < delDia.items.length; item++) {
          if (proteicasUsadas().size >= opciones.minFuentesProteicas) break;
          const actual = enSlot({ dia, tiempo, item })!;
          // Solo se sustituye una fuente proteica repetida: no se tocan vegetales ni cereales.
          if (!FUENTES_PROTEICAS.has(mapa.get(actual)?.categoria ?? '')) continue;
          if ((conteo.get(actual) ?? 0) < 2) continue;
          const enEsteSlot = new Set(delDia.items.map((i) => i.alimentoId));
          const nuevo = candidatos(actual, delDia.tipo, enEsteSlot).find(
            (a) => (conteo.get(a.id) ?? 0) === 0,
          );
          if (nuevo)
            reemplazar(
              { dia, tiempo, item },
              nuevo,
              'fuentes proteicas distintas en la semana',
            );
        }
      }
    }
  }

  const minimoAlcanzado = proteicasUsadas().size;
  if (minimoAlcanzado < opciones.minFuentesProteicas)
    cambios.push(
      `No se alcanzó el mínimo de fuentes proteicas: hay ${minimoAlcanzado} distinta(s) en el catálogo apto (pedido: ${opciones.minFuentesProteicas}).`,
    );

  return { dias: salida, cambios };
}
