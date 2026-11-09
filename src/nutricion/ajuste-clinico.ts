/**
 * Corrección en código de un día contra las condiciones verificables.
 *
 * `evaluarReglasClinicas` dice qué se excede y quién lo excede; esto intenta
 * arreglarlo bajando porciones del responsable y, si ya está en la porción
 * mínima, retirándolo. Lo que no se pueda verificar (alimento sin dato) se
 * informa como incógnita: acá nada se da por bueno en silencio.
 *
 * Puro: sin Nest, sin Prisma, sin I/O.
 */
import type { PerfilClinico } from '../pacientes/perfil-clinico.js';
import type { AlimentoCatalogo, TiempoPropuesto } from './generador-reglas.js';
import {
  evaluarReglasClinicas,
  type AlimentoDelDia,
  type Incognita,
  type Violacion,
} from './reglas-clinicas.js';

/** Ajuste en cuartos de porción, igual que el generador por reglas. */
const PASO_PORCION = 0.25;

export const PORCION_MINIMA_AJUSTE = 0.5;

/**
 * Tope de vueltas del corrector. Cada vuelta baja ¼ una porción o retira un
 * alimento, así que el ciclo termina solo; el tope existe para que un dato raro
 * no cuelgue la generación.
 */
const MAX_AJUSTES = 200;

export interface ResultadoAjusteClinico {
  tiempos: TiempoPropuesto[];
  /** Lo que quedó por encima del techo: no se pudo corregir y hay que revisarlo. */
  violaciones: Violacion[];
  /** Techos que no se pudieron verificar por falta de dato. */
  incognitas: Incognita[];
  /** Cambios aplicados, legibles para la justificación del plan. */
  cambios: string[];
}

interface Entrada {
  tiempo: number;
  /** Porción con la que entró el alimento, para reportar el cambio completo. */
  inicial: number;
  alimento: AlimentoDelDia;
  motivos: Set<string>;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

function comoAlimento(
  item: { alimentoId: string; porciones: number },
  catalogo: Map<string, AlimentoCatalogo>,
): AlimentoDelDia | undefined {
  const a = catalogo.get(item.alimentoId);
  if (!a) return undefined;
  return {
    id: a.id,
    nombre: a.nombre,
    porciones: item.porciones,
    sodioMg: a.sodioMg,
    potasioMg: a.potasioMg,
    fosforoMg: a.fosforoMg,
    indiceGlucemico: a.indiceGlucemico,
  };
}

/**
 * Ajusta un día completo. Nunca lanza: devuelve los tiempos corregidos, lo que
 * no se pudo corregir y lo que no se pudo verificar.
 */
export function ajustarDiaClinico(
  tiempos: TiempoPropuesto[],
  catalogo: Map<string, AlimentoCatalogo>,
  perfil: Pick<PerfilClinico, 'condiciones'>,
): ResultadoAjusteClinico {
  const lista: Entrada[] = [];
  tiempos.forEach((tiempo, indice) => {
    for (const item of tiempo.items) {
      const alimento = comoAlimento(item, catalogo);
      if (!alimento) continue;
      lista.push({
        tiempo: indice,
        inicial: alimento.porciones,
        alimento,
        motivos: new Set(),
      });
    }
  });

  const retirados: { nombre: string; motivo: string }[] = [];
  const evaluar = () =>
    evaluarReglasClinicas(
      perfil,
      lista.map((e) => e.alimento),
    );

  let resultado = evaluar();
  for (
    let vuelta = 0;
    vuelta < MAX_AJUSTES && resultado.violaciones.length > 0;
    vuelta++
  ) {
    const violacion = resultado.violaciones[0];
    const responsable = violacion.responsables[0];
    if (!responsable) break;
    const indice = lista.findIndex((e) => e.alimento.id === responsable.id);
    if (indice === -1) break;

    const entrada = lista[indice];
    // El índice glucémico es por alimento y no se escala por porciones, así que
    // bajar la porción no mueve el promedio: se retira directamente.
    const puedeBajar =
      violacion.nutriente !== 'indiceGlucemico' &&
      entrada.alimento.porciones - PASO_PORCION >= PORCION_MINIMA_AJUSTE;

    if (puedeBajar) {
      entrada.alimento.porciones = redondear(
        entrada.alimento.porciones - PASO_PORCION,
      );
      entrada.motivos.add(violacion.nutriente);
    } else {
      lista.splice(indice, 1);
      retirados.push({
        nombre: entrada.alimento.nombre,
        motivo: violacion.nutriente,
      });
    }
    resultado = evaluar();
  }

  const corregidos: TiempoPropuesto[] = tiempos.map((tiempo) => ({
    ...tiempo,
    items: [],
  }));
  for (const entrada of lista) {
    corregidos[entrada.tiempo].items.push({
      alimentoId: entrada.alimento.id,
      porciones: entrada.alimento.porciones,
    });
  }

  const cambios = [
    ...retirados.map((r) => `${r.nombre}: retirado por ${r.motivo}`),
    ...lista
      .filter((e) => e.alimento.porciones !== e.inicial)
      .map(
        (e) =>
          `${e.alimento.nombre}: ${e.inicial} → ${e.alimento.porciones} porciones por ${[...e.motivos].join(', ')}`,
      ),
  ];

  return {
    tiempos: corregidos,
    violaciones: resultado.violaciones,
    incognitas: resultado.incognitas,
    cambios,
  };
}
