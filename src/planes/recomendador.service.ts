import { Injectable, Logger } from '@nestjs/common';
import type { TipoComida } from '../generated/prisma/enums.js';
import { BedrockService, IaNoDisponibleError } from '../ia/bedrock.service.js';
import {
  ajustarPorciones,
  generarPlanPorReglas,
  type AlimentoCatalogo,
  type TiempoPropuesto,
} from '../nutricion/generador-reglas.js';
import {
  ORDEN_TIEMPOS,
  type DistribucionTiempos,
} from '../nutricion/nutricion.util.js';

export interface EntradaRecomendador {
  catalogo: AlimentoCatalogo[];
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

export interface ResultadoRecomendador {
  origen: 'IA' | 'REGLAS';
  tiempos: TiempoPropuesto[];
  justificacion: string;
}

interface RespuestaIa {
  resumen?: string;
  tiempos?: {
    tipo?: string;
    items?: { alimentoId?: string; porciones?: number }[];
    justificacion?: string;
  }[];
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
      tiempos: generarPlanPorReglas(
        e.catalogo,
        e.kcalObjetivo,
        e.distribucion,
        e.semilla,
      ),
      justificacion,
    };
  }

  private async conIa(e: EntradaRecomendador): Promise<ResultadoRecomendador> {
    const mapa = new Map(e.catalogo.map((a) => [a.id, a]));
    const tiposActivos = ORDEN_TIEMPOS.filter(
      (t) => (e.distribucion[t] ?? 0) > 0,
    );

    const respuesta = await this.bedrock.generarJson<RespuestaIa>(
      this.promptSistema(),
      this.promptUsuario(e, tiposActivos),
    );

    const respaldo = generarPlanPorReglas(
      e.catalogo,
      e.kcalObjetivo,
      e.distribucion,
      e.semilla,
    );
    const notas: string[] = [];
    let tiemposCorregidos = 0;

    const tiempos: TiempoPropuesto[] = tiposActivos.map((tipo) => {
      const pctKcal = e.distribucion[tipo] ?? 0;
      const deIa = respuesta.tiempos?.find((t) => t.tipo === tipo);
      // Validación: solo IDs que existan en el catálogo permitido, sin duplicados.
      const vistos = new Set<string>();
      const items = (deIa?.items ?? [])
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
        tiemposCorregidos++;
        return (
          respaldo.find((r) => r.tipo === tipo) ?? { tipo, pctKcal, items: [] }
        );
      }
      if (deIa?.justificacion)
        notas.push(`${NOMBRE_TIEMPO[tipo]}: ${deIa.justificacion}`);
      return {
        tipo,
        pctKcal,
        items: ajustarPorciones(items, mapa, e.kcalObjetivo * pctKcal),
      };
    });

    const partes = [respuesta.resumen?.trim(), ...notas].filter(Boolean);
    if (tiemposCorregidos)
      partes.push(
        `${tiemposCorregidos} tiempo(s) completados por reglas porque la IA no devolvió alimentos válidos.`,
      );
    partes.push(
      'Porciones verificadas por el sistema (±10 % de la meta). Revisar antes de aprobar.',
    );

    return { origen: 'IA', tiempos, justificacion: partes.join('\n') };
  }

  private promptSistema(): string {
    return [
      'Eres un asistente de nutricionistas clínicos en Honduras.',
      'Armas planes alimenticios de un día usando EXCLUSIVAMENTE alimentos del catálogo que recibes (por su id).',
      'Prioriza comida hondureña, variedad, saciedad y combinaciones culturalmente normales.',
      'No inventes alimentos, ids ni valores nutricionales. Las porciones son múltiplos de 0.25 de la porción indicada.',
      'Responde SOLO con JSON válido, sin texto adicional, con esta forma:',
      '{"resumen": string, "tiempos": [{"tipo": "DESAYUNO|MERIENDA_AM|ALMUERZO|MERIENDA_PM|CENA", "items": [{"alimentoId": string, "porciones": number}], "justificacion": string}]}',
    ].join('\n');
  }

  private promptUsuario(e: EntradaRecomendador, tipos: TipoComida[]): string {
    const metas = tipos
      .map(
        (t) =>
          `- ${t}: ${Math.round(e.kcalObjetivo * (e.distribucion[t] ?? 0))} kcal`,
      )
      .join('\n');
    const catalogo = e.catalogo
      .map((a) =>
        [
          a.id,
          a.nombre,
          a.porcionDescripcion,
          `${a.kcal}kcal`,
          `P${a.proteinaG}`,
          `C${a.carbohidratoG}`,
          `G${a.grasaG}`,
          a.tiposComida.join('/'),
        ].join(' | '),
      )
      .join('\n');
    return [
      `Meta del paciente: ${e.meta}.`,
      `Objetivo diario: ${e.kcalObjetivo} kcal · proteína ${e.proteinaG} g · carbohidratos ${e.carbohidratoG} g · grasa ${e.grasaG} g.`,
      e.restricciones.length
        ? `Restricciones (ya excluidas del catálogo): ${e.restricciones.join(', ')}.`
        : 'Sin restricciones.',
      e.indicaciones
        ? `Indicaciones de la nutricionista: ${e.indicaciones}`
        : '',
      `Kcal por tiempo de comida:\n${metas}`,
      'Entre 2 y 4 alimentos por tiempo principal y 1 o 2 por merienda. Usa cada alimento en los tiempos que indica su columna final.',
      `Catálogo (id | nombre | porción | kcal | proteína g | carbohidrato g | grasa g | tiempos):\n${catalogo}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
