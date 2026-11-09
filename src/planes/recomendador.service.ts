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
import { ajustarDiaClinico } from '../nutricion/ajuste-clinico.js';
import { detectarCondiciones } from '../nutricion/reglas-clinicas.js';
import { ajustarVariedadSemanal } from '../nutricion/variedad-semanal.js';
import { validarPlan } from './validacion-plan.js';

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
  /** `alimento` es el índice del catálogo enviado (`#0`, `#1`, …). */
  items?: { alimento?: number; porciones?: number }[];
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
 * Salida del modelo para una semana entera.
 *
 * 5.000 no alcanzó: con el esquema semanal completo (35 tiempos, cada uno con su
 * justificación, más la del día) Sonnet 4.6 cortó la respuesta por `max_tokens`
 * y el JSON llegó truncado — lo que se veía como "la IA devolvió JSON inválido"
 * y caía a reglas después de 50 segundos. El tope no cuesta por sí mismo: solo se
 * paga lo generado.
 */
const MAX_TOKENS_SEMANA = 16000;

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
        return this.clinica(this.variedad(await this.conIa(e), e), e);
      } catch (err) {
        const motivo =
          err instanceof IaNoDisponibleError ? err.message : 'error inesperado';
        if (!(err instanceof IaNoDisponibleError)) this.logger.error(err);
        return this.clinica(
          this.variedad(
            this.porReglas(
              e,
              `Generado por reglas (IA no disponible: ${motivo}).`,
            ),
            e,
          ),
          e,
        );
      }
    }
    return this.clinica(
      this.variedad(
        this.porReglas(
          e,
          'Generado por reglas a partir del catálogo y las restricciones del paciente.',
        ),
        e,
      ),
      e,
    );
  }

  /**
   * Variedad semanal en código, antes de las reglas clínicas: el último filtro
   * que toca los alimentos es el de los techos clínicos.
   */
  private variedad(
    resultado: ResultadoRecomendador,
    e: EntradaRecomendador,
  ): ResultadoRecomendador {
    const { dias, cambios } = ajustarVariedadSemanal(resultado.dias, e.catalogo);
    if (cambios.length === 0) return resultado;

    // La justificación se persiste y se lee: se muestran unos pocos ajustes y
    // el límite que no se pudo alcanzar, nunca 35 líneas.
    const visibles = cambios.slice(0, 6);
    for (const pendiente of cambios.filter((c) =>
      c.startsWith('No se alcanzó'),
    ))
      if (!visibles.includes(pendiente)) visibles.push(pendiente);
    const resto = cambios.length - visibles.length;

    return {
      ...resultado,
      dias,
      justificacion: [
        resultado.justificacion,
        `Variedad semanal: ${cambios.length} ajuste(s)${resto > 0 ? `, +${resto} más` : ''}. ${visibles.join('; ')}.`,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  /**
   * Aplica las reglas clínicas verificables a la semana ya armada, sea de la IA
   * o de las reglas. Los techos no dependen del criterio del modelo.
   */
  private clinica(
    resultado: ResultadoRecomendador,
    e: EntradaRecomendador,
  ): ResultadoRecomendador {
    if (!e.perfilClinico?.condiciones?.length) return resultado;

    const mapa = new Map(e.catalogo.map((a) => [a.id, a]));
    const perfil = e.perfilClinico;
    const partes: string[] = [];
    let diasAjustados = 0;

    const dias = resultado.dias.map((diaPropuesto) => {
      const ajuste = ajustarDiaClinico(diaPropuesto.tiempos, mapa, perfil);
      const notas = diaPropuesto.justificacion
        ? [diaPropuesto.justificacion]
        : [];
      if (ajuste.cambios.length) {
        diasAjustados++;
        notas.push(`Ajuste clínico: ${ajuste.cambios.join('; ')}.`);
      }
      for (const v of ajuste.violaciones)
        notas.push(
          `No se pudo corregir ${v.nutriente} (${v.actual} sobre ${v.limite}) de ${v.condicion}: revisar clínicamente.`,
        );
      for (const i of ajuste.incognitas)
        notas.push(
          `Sin dato de ${i.nutriente} en ${i.sinDato.length} alimento(s): el techo de ${i.condicion} no se pudo verificar.`,
        );
      return {
        ...diaPropuesto,
        tiempos: ajuste.tiempos,
        justificacion: notas.length ? notas.join('\n') : undefined,
      };
    });

    const detectadas = detectarCondiciones(perfil);
    if (detectadas.evaluadas.length)
      partes.push(
        `Reglas clínicas aplicadas en código: ${detectadas.evaluadas.join(', ')}.`,
      );
    if (diasAjustados)
      partes.push(
        `${diasAjustados} día(s) ajustados para respetar los techos clínicos.`,
      );
    if (detectadas.noVerificadas.length)
      partes.push(
        `Condiciones que el sistema no verifica en código: ${detectadas.noVerificadas.join(', ')}.`,
      );

    return {
      ...resultado,
      dias,
      justificacion: [resultado.justificacion, ...partes]
        .filter(Boolean)
        .join('\n'),
    };
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

    // Una semana son ~63 s de generación: va por stream para que el socket no
    // quede inactivo y para medir el primer token.
    const { catalogo, contexto } = this.promptUsuario(e, tiposActivos);
    const respuesta = await this.bedrock.generarJsonStream<RespuestaIa>(
      this.promptSistema(),
      [{ texto: catalogo, cachear: true }, { texto: contexto }],
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
    const idsValidos = new Set(mapa.keys());
    const notas: string[] = [];
    let diasIlegibles = 0;
    let diasNoDevueltos = 0;
    let tiemposPorReglas = 0;

    const dias: DiaPropuesto[] = respaldo.map(({ dia, tiempos: deReglas }) => {
      const deIa = porDia.get(dia);
      if (!deIa) {
        diasNoDevueltos++;
        return {
          dia,
          tiempos: deReglas,
          justificacion: 'Día completado por reglas: la IA no lo devolvió.',
        };
      }

      // El modelo elige por índice del catálogo: se traduce a id antes de
      // validar, así un índice fuera de rango queda sin id y el validador lo
      // rechaza, sin poder inventar un alimento.
      const tiemposCrudos = Array.isArray(deIa.tiempos)
        ? deIa.tiempos.map((tiempo) => ({
            ...tiempo,
            items: Array.isArray(tiempo?.items)
              ? tiempo.items.map((item) => ({
                  alimentoId:
                    typeof item?.alimento === 'number' &&
                    Number.isInteger(item.alimento)
                      ? e.catalogo[item.alimento]?.id
                      : undefined,
                  porciones: item?.porciones,
                }))
              : tiempo?.items,
          }))
        : deIa.tiempos;

      // Validación estricta contra el catálogo permitido. Un tiempo con algún
      // ítem roto no se persiste a medias: ese tiempo se regenera por reglas.
      const validado = validarPlan(
        { tiempos: tiemposCrudos },
        idsValidos,
        tiposActivos,
      );
      if (validado.tiempos.length === 0) {
        diasIlegibles++;
        return {
          dia,
          tiempos: deReglas,
          justificacion:
            'Día completado por reglas: la IA no devolvió ningún tiempo válido.',
        };
      }

      const limpios = new Map(validado.tiempos.map((t) => [t.tipo, t.items]));
      const rotos = new Set(validado.parciales.map((t) => t.tipo));
      const notasDia: string[] = [];
      const tiempos: TiempoPropuesto[] = tiposActivos.map((tipo) => {
        const pctKcal = e.distribucion[tipo] ?? 0;
        const items = limpios.get(tipo);
        if (!items) {
          tiemposPorReglas++;
          const motivo = rotos.has(tipo)
            ? 'ítems inválidos'
            : validado.faltantes.includes(tipo)
              ? 'no vino en la respuesta'
              : 'sin ítems válidos';
          notasDia.push(
            `${NOMBRE_TIEMPO[tipo]}: completado por reglas (${motivo}).`,
          );
          return (
            deReglas.find((r) => r.tipo === tipo) ?? {
              tipo,
              pctKcal,
              items: [],
            }
          );
        }
        return {
          tipo,
          pctKcal,
          items: ajustarPorciones(items, mapa, e.kcalObjetivo * pctKcal),
        };
      });

      if (deIa.justificacion?.trim())
        notas.push(`${dia}: ${deIa.justificacion.trim()}`);

      if (validado.errores.length) {
        const motivos = [...new Set(validado.errores.map((x) => x.motivo))];
        notasDia.push(
          `Descartados ${validado.errores.length} ítem(s) fuera de contrato (${motivos.join(', ')}).`,
        );
      }
      return {
        dia,
        tiempos,
        justificacion: notasDia.length ? notasDia.join('\n') : undefined,
      };
    });

    const partes = [respuesta.resumen?.trim(), ...notas].filter(Boolean);
    if (diasNoDevueltos)
      partes.push(
        `${diasNoDevueltos} día(s) completados por reglas porque la IA no los devolvió.`,
      );
    if (diasIlegibles)
      partes.push(
        `${diasIlegibles} día(s) completados por reglas porque la respuesta de la IA no fue válida.`,
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
      'No inventes alimentos ni valores nutricionales. Cada alimento del catálogo viene con un índice (#0, #1, …): devuelve ese número en `alimento`, nunca un nombre ni un id.',
      'Responde SOLO con JSON válido, sin texto adicional, con esta forma:',
      '{"resumen": string, "dias": [{"dia": "LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO", "tiempos": [{"tipo": "DESAYUNO|MERIENDA_AM|ALMUERZO|MERIENDA_PM|CENA", "items": [{"alimento": number, "porciones": number}]}], "justificacion": string}]}',
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

  /**
   * Dos bloques: primero el catálogo —que es lo caro y lo que se repite entre
   * planes, así que se cachea— y después todo lo que cambia por paciente. El
   * orden importa: la caché de prefijo solo sirve si lo invariante va delante.
   */
  private promptUsuario(
    e: EntradaRecomendador,
    tipos: TipoComida[],
  ): { catalogo: string; contexto: string } {
    const metas = tipos
      .map(
        (t) =>
          `- ${t}: ${Math.round(e.kcalObjetivo * (e.distribucion[t] ?? 0))} kcal`,
      )
      .join('\n');
    const catalogo = e.catalogo
      .map((a, indice) => {
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
          `#${indice}`,
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
    const contexto = [
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
      'Entre 2 y 4 alimentos por tiempo principal y 1 o 2 por merienda. Usa cada alimento en el tiempo de comida que indica su columna final del catálogo.',
      'Devuelve el índice del catálogo (#N) en el campo `alimento`.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const cabecera =
      'Catálogo (índice | nombre | porción | kcal | proteína g | carbohidrato g | grasa g | tiempos | nutrientes clínicos por porción):';

    return { catalogo: `${cabecera}\n${catalogo}`, contexto };
  }
}
