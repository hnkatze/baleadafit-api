import { describe, expect, it } from 'vitest';
import { ORDEN_TIEMPOS } from '../nutricion/nutricion.util.js';
import { PORCION_MAXIMA, PORCION_MINIMA, validarPlan } from './validacion-plan.js';

const IDS = new Set(['a1', 'a2', 'a3', 'a4', 'a5']);

function planValido() {
  return {
    resumen: 'plan de prueba',
    tiempos: ORDEN_TIEMPOS.map((tipo) => ({ tipo, items: [{ alimentoId: 'a1', porciones: 1 }] })),
  };
}

describe('validarPlan — camino feliz', () => {
  it('acepta un plan completo con los cinco tiempos', () => {
    const r = validarPlan(planValido(), IDS);
    expect(r.ok).toBe(true);
    expect(r.tiempos).toHaveLength(ORDEN_TIEMPOS.length);
    expect(r.errores).toEqual([]);
    expect(r.faltantes).toEqual([]);
    expect(r.resumen).toBe('plan de prueba');
  });

  it('normaliza el tipo a mayúsculas', () => {
    const r = validarPlan(
      { tiempos: [{ tipo: 'desayuno', items: [{ alimentoId: 'a1', porciones: 2.255 }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.tiempos[0].tipo).toBe('DESAYUNO');
    expect(r.tiempos[0].items[0].porciones).toBe(2.26);
  });
});

describe('validarPlan — rechazos de forma', () => {
  it('rechaza una entrada sin arreglo tiempos', () => {
    const r = validarPlan({ resumen: 'x' }, IDS);
    expect(r.ok).toBe(false);
    expect(r.errores[0].motivo).toBe('forma-invalida');
  });

  it('rechaza una entrada que no es objeto', () => {
    expect(validarPlan(null, IDS).errores[0].motivo).toBe('forma-invalida');
    expect(validarPlan('[]', IDS).errores[0].motivo).toBe('forma-invalida');
  });

  it('deja el resumen vacío si no vino', () => {
    const r = validarPlan({ tiempos: planValido().tiempos }, IDS);
    expect(r.resumen).toBe('');
  });
});

describe('validarPlan — rechazos por slot', () => {
  it('rechaza un tipo de comida desconocido', () => {
    const r = validarPlan(
      { tiempos: [{ tipo: 'BRUNCH', items: [{ alimentoId: 'a1', porciones: 1 }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores[0].motivo).toBe('tipo-desconocido');
  });

  it('rechaza un tipo repetido', () => {
    const r = validarPlan(
      {
        tiempos: [
          { tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: 1 }] },
          { tipo: 'DESAYUNO', items: [{ alimentoId: 'a2', porciones: 1 }] },
        ],
      },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores.some((e) => e.motivo === 'tipo-duplicado')).toBe(true);
  });

  it('rechaza un tiempo sin items', () => {
    const r = validarPlan({ tiempos: [{ tipo: 'DESAYUNO', items: [] }] }, IDS, ['DESAYUNO']);
    expect(r.errores[0].motivo).toBe('items-vacios');
  });

  it('rechaza un alimento que no está en el catálogo permitido', () => {
    const r = validarPlan(
      { tiempos: [{ tipo: 'DESAYUNO', items: [{ alimentoId: 'inventado', porciones: 1 }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores[0].motivo).toBe('alimento-desconocido');
  });

  it('rechaza porciones no numéricas', () => {
    const r = validarPlan(
      { tiempos: [{ tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: 'dos' }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores[0].motivo).toBe('porciones-invalidas');
  });

  it('rechaza porciones por debajo del mínimo y por encima del máximo', () => {
    const bajo = validarPlan(
      { tiempos: [{ tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: PORCION_MINIMA - 0.1 }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(bajo.errores[0].motivo).toBe('porciones-fuera-de-rango');

    const alto = validarPlan(
      { tiempos: [{ tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: PORCION_MAXIMA + 0.5 }] }] },
      IDS,
      ['DESAYUNO'],
    );
    expect(alto.errores[0].motivo).toBe('porciones-fuera-de-rango');
  });

  it('acepta exactamente el mínimo y el máximo', () => {
    const r = validarPlan(
      {
        tiempos: [
          {
            tipo: 'DESAYUNO',
            items: [
              { alimentoId: 'a1', porciones: PORCION_MINIMA },
              { alimentoId: 'a2', porciones: PORCION_MAXIMA },
            ],
          },
        ],
      },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.ok).toBe(true);
  });

  it('rechaza el mismo alimento dos veces en el mismo tiempo', () => {
    const r = validarPlan(
      {
        tiempos: [
          {
            tipo: 'DESAYUNO',
            items: [
              { alimentoId: 'a1', porciones: 1 },
              { alimentoId: 'a1', porciones: 2 },
            ],
          },
        ],
      },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores[0].motivo).toBe('alimento-duplicado');
  });
});

describe('validarPlan — pensado para reparar, no para descartar', () => {
  it('conserva los slots sanos cuando otro falla', () => {
    const r = validarPlan(
      {
        tiempos: [
          { tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: 1 }] },
          { tipo: 'ALMUERZO', items: [{ alimentoId: 'fantasma', porciones: 1 }] },
        ],
      },
      IDS,
      ['DESAYUNO', 'ALMUERZO'],
    );
    expect(r.ok).toBe(false);
    expect(r.tiempos.map((t) => t.tipo)).toEqual(['DESAYUNO']);
    expect(r.errores).toHaveLength(1);
  });

  it('no pierde los items sanos de un slot roto: los deja en parciales', () => {
    const r = validarPlan(
      {
        tiempos: [
          {
            tipo: 'DESAYUNO',
            items: [
              { alimentoId: 'a1', porciones: 1 },
              { alimentoId: 'fantasma', porciones: 1 },
            ],
          },
        ],
      },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.errores[0].motivo).toBe('alimento-desconocido');
    expect(r.parciales).toEqual([{ tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: 1 }] }]);
  });

  it('un slot a medio armar nunca entra en la ruta que se persiste', () => {
    const r = validarPlan(
      {
        tiempos: [
          {
            tipo: 'DESAYUNO',
            items: [
              { alimentoId: 'a1', porciones: 1 },
              { alimentoId: 'fantasma', porciones: 1 },
            ],
          },
        ],
      },
      IDS,
      ['DESAYUNO'],
    );
    expect(r.tiempos).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it('reporta los tiempos que faltaron', () => {
    const r = validarPlan(
      { tiempos: [{ tipo: 'DESAYUNO', items: [{ alimentoId: 'a1', porciones: 1 }] }] },
      IDS,
      ORDEN_TIEMPOS,
    );
    expect(r.ok).toBe(false);
    expect(r.faltantes).toEqual(ORDEN_TIEMPOS.slice(1));
  });
});
