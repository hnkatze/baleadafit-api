import { Injectable, Logger } from '@nestjs/common';
import type { DiaSemana, TipoComida } from '../generated/prisma/enums.js';
import { BedrockService, IaNoDisponibleError } from '../ia/bedrock.service.js';
import {
  ajustarPorciones,
  generarPlanPorReglas,
  type AlimentoCatalogo,
  type TiempoPropuesto,
} from '../nutricion/generador-reglas.js';
import {
  DIAS_SEMANA,
  ORDEN_TIEMPOS,
  type DistribucionTiempos,
} from '../nutricion/nutricion.util.js';
import type { PerfilClinico } from '../pacientes/perfil-clinico.js';

export type { PerfilClinico };

export interface EntradaRecomendador {
  catalogo: AlimentoCatalogo[];
  /** Contexto del expediente: condiciones, hábitos, composición y objetivo. */
  perfilClinico?: PerfilClinico;
  kcalObjetivo: number;
  proteinaG: number;
  carbohidratoG: number;
  grasaG: number;
  distribucion: DistribucionTiempos;
  restricciones: string[];
  meta: string;
  usarIa: boolean;
  indicaciones?: string;
  semilla: number;
}

export interface DiaPropuesto {
  dia: DiaSemana;
  tiempos: TiempoPropuesto[];
  /** Nota del día: la del modelo o el motivo por el que lo armaron las reglas. */
  justificacion?: string;
}

export interface ResultadoRecomendador {
  origen: 'IA' | 'REGLAS';
  /** Siempre los siete días, en el orden de `DIAS_SEMANA`. */
  dias: DiaPropuesto[];
  justificacion: string;
}

interface RespuestaIaTiempo {
  tipo?: string;
  items?: { alimentoId?: string; porciones?: number }[];
  justificacion?: string;
}

interface RespuestaIaDia {
  dia?: string;
  tiempos?: RespuestaIaTiempo[];
  justificacion?: string;
}

interface RespuestaIa {
  resumen?: string;
  dias?: RespuestaIaDia[];
}

/**
 * Salida del modelo para una semana entera. Medido contra los tres modelos: la
 * semana completa ronda los 1.800 tokens de salida, así que 5.000 deja aire para
 * un plan con textos largos sin acercarse al límite de los modelos chicos.
 */
const MAX_TOKENS_SEMANA = 5000;

/**
 * Desplazamiento de la semilla por día: con paso impar, el generador por reglas
 * alterna plato típico y plato combinado en días consecutivos.
 */
const SEMILLA_POR_DIA = 7;

/** Día del modelo tolerando minúsculas y espacios; `undefined` si no es un día. */
function normalizarDia(valor: unknown): DiaSemana | undefined {
  if (typeof valor !== 'string') return undefined;
  const nombre = valor.trim().toUpperCase();
  return DIAS_SEMANA.find((d) => d === nombre);
}

/** Tipo de comida del modelo tolerando minúsculas y espacios. */
function normalizarTipo(valor: unknown): TipoComida | undefined {
  if (typeof valor !== 'string') return undefined;
  const nombre = valor.trim().toUpperCase();
  return ORDEN_TIEMPOS.find((t) => t === nombre);
}

const NOMBRE_TIEMPO: Record<TipoComida, string> = {
  DESAYUNO: 'Desayuno',
  MERIENDA_AM: 'Merienda AM',
  ALMUERZO: 'Almuerzo',
  MERIENDA_PM: 'Merienda PM',
  CENA: 'Cena',
};

/**
 * Recomendador híbrido:
 *  1. El backend ya calculó kcal y macros (Mifflin-St Jeor).
 *  2. Bedrock elige combinaciones SOLO de alimentos del catálogo filtrado.
 *  3. El backend valida IDs, recalcula y ajusta porciones a ±10 % de la meta.
 *  4. Si la IA falla, se usa el generador por reglas.
 */
@Injectable()
export class RecomendadorService {
  private readonly logger = new Logger(RecomendadorService.name);

  constructor(private readonly bedrock: BedrockService) {}

  async generar(e: EntradaRecomendador): Promise<ResultadoRecomendador> {
    if (e.usarIa) {
      try {
        return await this.conIa(e);
      } catch (err) {
        const motivo =
          err instanceof IaNoDisponibleError ? err.message : 'error inesperado';
        if (!(err instanceof IaNoDisponibleError)) this.logger.error(err);
        return this.porReglas(
          e,
          `Generado por reglas (IA no disponible: ${motivo}).`,
        );
      }
    }
    return this.porReglas(
      e,
      'Generado por reglas a partir del catálogo y las restricciones del paciente.',
    );
  }

  private porReglas(
    e: EntradaRecomendador,
    justificacion: string,
  ): ResultadoRecomendador {
    return {
      origen: 'REGLAS',
      dias: this.semanaPorReglas(e),
      justificacion,
    };
  }

  /**
   * Los siete días armados por reglas. Cada día usa su propio desplazamiento de
   * semilla, así que la semana no repite el mismo plan siete veces y sigue siendo
   * determinista para la misma `semilla`.
   */
  private semanaPorReglas(e: EntradaRecomendador): DiaPropuesto[] {
    return DIAS_SEMANA.map((dia, indice) => ({
      dia,
      tiempos: generarPlanPorReglas(
        e.catalogo,
        e.kcalObjetivo,
        e.distribucion,
        e.semilla + indice * SEMILLA_POR_DIA,
      ),
    }));
  }

  private async conIa(e: EntradaRecomendador): Promise<ResultadoRecomendador> {
    const mapa = new Map(e.catalogo.map((a) => [a.id, a]));
    const tiposActivos = ORDEN_TIEMPOS.filter(
      (t) => (e.distribucion[t] ?? 0) > 0,
    );

    const respuesta = await this.bedrock.generarJson<RespuestaIa>(
      this.promptSistema(),
      this.promptUsuario(e, tiposActivos),
      MAX_TOKENS_SEMANA,
    );

    // Un día repetido o desconocido se descarta: manda la primera aparición
    // válida, y el día que falte lo completa el generador por reglas.
    const porDia = new Map<DiaSemana, RespuestaIaDia>();
    for (const crudo of respuesta.dias ?? []) {
      const dia = normalizarDia(crudo?.dia);
      if (dia && !porDia.has(dia)) porDia.set(dia, crudo);
    }
    if (porDia.size === 0)
      throw new IaNoDisponibleError('La IA no devolvió ningún día válido.');

    const respaldo = this.semanaPorReglas(e);
    const notas: string[] = [];
    let diasPorReglas = 0;
    let tiemposPorReglas = 0;

    const dias: DiaPropuesto[] = respaldo.map(({ dia, tiempos: deReglas }) => {
      const deIa = porDia.get(dia);
      if (!deIa) {
        diasPorReglas++;
        return {
          dia,
          tiempos: deReglas,
          justificacion:
            'Día completado por reglas: la IA no lo devolvió.',
        };
      }

      const notasDia: string[] = [];
      const tiempos: TiempoPropuesto[] = tiposActivos.map((tipo) => {
        const pctKcal = e.distribucion[tipo] ?? 0;
        const deSlot = deIa.tiempos?.find(
          (t) => normalizarTipo(t?.tipo) === tipo,
        );
        // Validación: solo IDs que existan en el catálogo permitido, sin duplicados.
        const vistos = new Set<string>();
        const items = (deSlot?.items ?? [])
          .filter(
            (i) =>
              typeof i.alimentoId === 'string' &&
              mapa.has(i.alimentoId) &&
              !vistos.has(i.alimentoId) &&
              vistos.add(i.alimentoId),
          )
          .map((i) => ({
            alimentoId: i.alimentoId!,
            porciones: Math.min(
              4,
              Math.max(0.5, Math.round((Number(i.porciones) || 1) * 4) / 4),
            ),
          }));

        if (items.length === 0) {
          tiemposPorReglas++;
          return (
            deReglas.find((r) => r.tipo === tipo) ?? {
              tipo,
              pctKcal,
              items: [],
            }
          );
        }
        if (deSlot?.justificacion)
          notasDia.push(`${NOMBRE_TIEMPO[tipo]}: ${deSlot.justificacion}`);
        return {
          tipo,
          pctKcal,
          items: ajustarPorciones(items, mapa, e.kcalObjetivo * pctKcal),
        };
      });

      if (deIa.justificacion) notas.push(`${dia}: ${deIa.justificacion}`);
      notas.push(...notasDia);
      return {
        dia,
        tiempos,
        justificacion: notasDia.length
          ? notasDia.join('\n')
          : undefined,
      };
    });

    const partes = [respuesta.resumen?.trim(), ...notas].filter(Boolean);
    if (diasPorReglas)
      partes.push(
        `${diasPorReglas} día(s) completados por reglas porque la IA no los devolvió.`,
      );
    if (tiemposPorReglas)
      partes.push(
        `${tiemposPorReglas} tiempo(s) completados por reglas porque la IA no devolvió alimentos válidos.`,
      );
    partes.push(
      'Porciones verificadas por el sistema (±10 % de la meta del tiempo de comida). Revisar antes de aprobar.',
    );

    return { origen: 'IA', dias, justificacion: partes.join('\n') };
  }

  private promptSistema(): string {
    return [
      'Eres un asistente de nutricionistas clínicos en Honduras.',
      'Armas planes alimenticios semanales de siete días (lunes a domingo) usando EXCLUSIVAMENTE alimentos del catálogo que recibes (por su id).',
      'Prioriza comida hondureña, variedad, saciedad y combinaciones culturalmente normales.',
      'La semana completa debe variar: no repitas el mismo plato principal en días consecutivos y no uses un alimento más de tres veces en la semana.',
      'Si recibes el perfil clínico, respétalo: las condiciones, el estado fisiológico, las alergias y los hábitos mandan sobre la preferencia cultural.',
      'No inventes alimentos, ids ni valores nutricionales. Las porciones son múltiplos de 0.25 de la porción indicada.',
      'Responde SOLO con JSON válido, sin texto adicional, con esta forma:',
      '{"resumen": string, "dias": [{"dia": "LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO", "tiempos": [{"tipo": "DESAYUNO|MERIENDA_AM|ALMUERZO|MERIENDA_PM|CENA", "items": [{"alimentoId": string, "porciones": number}], "justificacion": string}], "justificacion": string}]}',
      'Devuelve los siete días, en orden y cada uno una sola vez.',
    ].join('\n');
  }

  /**
   * Bloque legible con el expediente del paciente. Solo incluye lo que existe:
   * la IA no debe inventar datos que no recibió.
   */
  private bloquePerfil(p: PerfilClinico): string {
    const lineas: string[] = [];
    const antropometria = [
      p.edad !== undefined ? `${p.edad} años` : '',
      p.sexo === 'F' ? 'mujer' : p.sexo === 'M' ? 'hombre' : '',
      p.pesoKg !== undefined ? `${p.pesoKg} kg` : '',
      p.tallaCm !== undefined ? `${p.tallaCm} cm` : '',
      p.imc !== undefined ? `IMC ${p.imc}` : '',
      p.pctGrasa != null ? `${p.pctGrasa} % de grasa` : '',
      p.masaMuscularKg != null ? `${p.masaMuscularKg} kg de masa muscular` : '',
      p.grasaVisceral != null ? `grasa visceral ${p.grasaVisceral}` : '',
    ].filter(Boolean);
    if (antropometria.length)
      lineas.push(`- Antropometría: ${antropometria.join(', ')}.`);

    if (p.estadoFisiologico && p.estadoFisiologico !== 'NINGUNO') {
      const etapa =
        p.estadoFisiologico === 'EMBARAZO' ? 'embarazo' : 'lactancia';
      lineas.push(
        `- Estado fisiológico: ${etapa}. No plantees déficit agresivo y cuida hierro, folato y calcio.`,
      );
    }

    if (p.condiciones?.length) {
      lineas.push('- Condiciones clínicas y qué implican en el plan:');
      for (const c of p.condiciones)
        lineas.push(
          `  · ${c.nombre}${c.descripcion ? `: ${c.descripcion}` : ''}`,
        );
      lineas.push(
        '- Si un alimento choca con una condición, elige otro del catálogo en lugar de recortar el tiempo de comida.',
      );
    }

    if (p.alergias) lineas.push(`- Alergias declaradas: ${p.alergias}.`);
    if (p.medicamentos?.length)
      lineas.push(`- Medicación vigente: ${p.medicamentos.join('; ')}.`);

    const h = p.habitos;
    if (h) {
      const habitos = [
        h.comidasAlDia != null ? `${h.comidasAlDia} comidas al día` : '',
        h.aguaLitros != null ? `${h.aguaLitros} L de agua` : '',
        h.horasSueno != null ? `${h.horasSueno} h de sueño` : '',
        h.alcohol ? `alcohol: ${h.alcohol}` : '',
        h.tabaco ? `tabaco: ${h.tabaco}` : '',
        h.quienCocina ? `cocina: ${h.quienCocina}` : '',
        h.presupuesto ? `Presupuesto: ${h.presupuesto}` : '',
      ].filter(Boolean);
      if (habitos.length)
        lineas.push(`- Hábitos y contexto: ${habitos.join(', ')}.`);
    }

    if (p.objetivo && (p.objetivo.pesoKg != null || p.objetivo.fecha)) {
      const objetivo = [
        p.objetivo.pesoKg != null ? `peso objetivo ${p.objetivo.pesoKg} kg` : '',
        p.objetivo.fecha ? `para el ${p.objetivo.fecha}` : '',
      ].filter(Boolean);
      lineas.push(`- Objetivo pactado: ${objetivo.join(' ')}.`);
    }

    return lineas.length
      ? ['Perfil clínico del paciente:', ...lineas].join('\n')
      : '';
  }

  private promptUsuario(e: EntradaRecomendador, tipos: TipoComida[]): string {
    const metas = tipos
      .map(
        (t) =>
          `- ${t}: ${Math.round(e.kcalObjetivo * (e.distribucion[t] ?? 0))} kcal`,
      )
      .join('\n');
    const catalogo = e.catalogo
      .map((a) => {
        const clinicos = [
          a.sodioMg != null ? `Na ${a.sodioMg}mg` : '',
          a.potasioMg != null ? `K ${a.potasioMg}mg` : '',
          a.fosforoMg != null ? `P ${a.fosforoMg}mg` : '',
          a.fibraG != null ? `fibra ${a.fibraG}g` : '',
          a.azucaresG != null ? `azúcares ${a.azucaresG}g` : '',
          a.grasasSatG != null ? `sat ${a.grasasSatG}g` : '',
          a.indiceGlucemico != null ? `IG ${a.indiceGlucemico}` : '',
        ].filter(Boolean);
        return [
          a.id,
          a.nombre,
          a.porcionDescripcion,
          `${a.kcal}kcal`,
          `P${a.proteinaG}`,
          `C${a.carbohidratoG}`,
          `G${a.grasaG}`,
          a.tiposComida.join('/'),
          ...(clinicos.length ? [clinicos.join(', ')] : []),
        ].join(' | ');
      })
      .join('\n');
    return [
      `Meta del paciente: ${e.meta}.`,
      `Plan semanal: los siete días (${DIAS_SEMANA.join(', ')}), cada uno con los mismos tiempos y las mismas metas por tiempo.`,
      `Objetivo diario: ${e.kcalObjetivo} kcal · proteína ${e.proteinaG} g · carbohidratos ${e.carbohidratoG} g · grasa ${e.grasaG} g.`,
      e.restricciones.length
        ? `Restricciones (ya excluidas del catálogo): ${e.restricciones.join(', ')}.`
        : 'Sin restricciones.',
      e.perfilClinico ? this.bloquePerfil(e.perfilClinico) : '',
      e.indicaciones
        ? `Indicaciones de la nutricionista: ${e.indicaciones}`
        : '',
      `Kcal por tiempo de comida:\n${metas}`,
      'Entre 2 y 4 alimentos por tiempo principal y 1 o 2 por merienda. Usa cada alimento en los tiempos que indica su columna final.',
      `Catálogo (id | nombre | porción | kcal | proteína g | carbohidrato g | grasa g | tiempos | nutrientes clínicos por porción):\n${catalogo}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
