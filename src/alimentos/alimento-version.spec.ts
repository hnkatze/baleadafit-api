import { afterEach, describe, expect, it, vi } from 'vitest';
import { cambianValores, datosVersion } from './alimento-version.js';

const FUENTE = 'Tabla de Composición de Alimentos INCAP';

const ALIMENTO = {
  porcionDescripcion: '1 unidad',
  porcionGramos: 120,
  kcal: 330,
  proteinaG: 11,
  carbohidratoG: 42,
  grasaG: 13,
  fibraG: 2.5,
  sodioMg: 420,
  potasioMg: 610,
  fosforoMg: 180,
  azucaresG: 6,
  grasasSatG: 3.5,
  indiceGlucemico: 55,
  fuente: FUENTE,
};

const VIGENTE = new Date('2026-10-29T00:00:00.000Z');

describe('datosVersion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('copia los valores de porción y nutricionales del alimento', () => {
    vi.stubEnv('TABLA_NUTRICIONAL', undefined);
    expect(datosVersion(ALIMENTO, 1, VIGENTE)).toEqual({
      version: 1,
      vigenteDesde: VIGENTE,
      tabla: 'Inicial',
      fuente: FUENTE,
      porcionDescripcion: '1 unidad',
      porcionGramos: 120,
      kcal: 330,
      proteinaG: 11,
      carbohidratoG: 42,
      grasaG: 13,
      fibraG: 2.5,
      sodioMg: 420,
      potasioMg: 610,
      fosforoMg: 180,
      azucaresG: 6,
      grasasSatG: 3.5,
      indiceGlucemico: 55,
    });
  });

  it('usa la revisión de la tabla indicada en TABLA_NUTRICIONAL', () => {
    vi.stubEnv('TABLA_NUTRICIONAL', 'INCAP 2026');
    expect(datosVersion(ALIMENTO, 2, VIGENTE).tabla).toBe('INCAP 2026');
  });

  it('deja la fuente nula cuando el alimento no la trae', () => {
    expect(datosVersion({ ...ALIMENTO, fuente: null }, 1, VIGENTE).fuente).toBe(
      null,
    );
  });
});

describe('cambianValores', () => {
  it('detecta un cambio de porción, de nutriente o de fuente', () => {
    expect(cambianValores(ALIMENTO, { kcal: 340 })).toBe(true);
    expect(cambianValores(ALIMENTO, { porcionGramos: 150 })).toBe(true);
    expect(cambianValores(ALIMENTO, { sodioMg: 500 })).toBe(true);
    expect(cambianValores(ALIMENTO, { fuente: 'INCAP 2026' })).toBe(true);
  });

  it('no considera cambio editar solo la identidad del alimento', () => {
    expect(
      cambianValores(ALIMENTO, {
        nombre: 'Baleada con aguacate',
        activo: false,
        tiposComida: ['CENA'],
        contiene: ['gluten'],
        esTipicoHn: false,
        categoria: 'CEREAL_TUBERCULO',
      }),
    ).toBe(false);
  });

  it('no considera cambio repetir el mismo valor, incluidos los nulos', () => {
    expect(cambianValores(ALIMENTO, { kcal: 330, fuente: FUENTE })).toBe(false);
    const sinIndice = { ...ALIMENTO, indiceGlucemico: null };
    expect(cambianValores(sinIndice, { indiceGlucemico: null })).toBe(false);
    expect(cambianValores(ALIMENTO, { indiceGlucemico: null })).toBe(true);
  });
});
