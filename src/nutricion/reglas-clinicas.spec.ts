import { describe, expect, it } from 'vitest';
import {
  IG_PROMEDIO_MAXIMO,
  LIMITES_DIARIOS,
  detectarCondiciones,
  evaluarReglasClinicas,
  type AlimentoDelDia,
} from './reglas-clinicas.js';

const HTA = { condiciones: [{ nombre: 'HTA', descripcion: 'Hipertensión arterial' }] };
const ERC = { condiciones: [{ nombre: 'ERC', descripcion: 'Enfermedad renal crónica' }] };
const DIABETES = { condiciones: [{ nombre: 'Diabetes tipo 2', descripcion: null }] };

function alimento(parcial: Partial<AlimentoDelDia> & { id: string }): AlimentoDelDia {
  return { nombre: `alimento ${parcial.id}`, porciones: 1, ...parcial };
}

describe('detectarCondiciones', () => {
  it('reconoce HTA, ERC y diabetes sin importar acentos ni mayúsculas', () => {
    const r = detectarCondiciones({
      condiciones: [
        { nombre: 'HTA' },
        { nombre: 'enfermedad renal crónica' },
        { nombre: 'DIABÉTICO' },
      ],
    });
    expect(r.evaluadas.sort()).toEqual(['DIABETES', 'ERC', 'HTA']);
  });

  it('informa las condiciones que no sabe verificar en vez de descartarlas', () => {
    const r = detectarCondiciones({ condiciones: [{ nombre: 'Lactancia' }] });
    expect(r.evaluadas).toEqual([]);
    expect(r.noVerificadas).toEqual(['Lactancia']);
  });

  it('sin condiciones no evalúa nada', () => {
    expect(detectarCondiciones({}).evaluadas).toEqual([]);
  });
});

describe('evaluarReglasClinicas — HTA (sodio)', () => {
  it('marca violación cuando la suma conocida supera el techo', () => {
    const r = evaluarReglasClinicas(HTA, [
      alimento({ id: 'a', sodioMg: 800, porciones: 2 }),
      alimento({ id: 'b', sodioMg: 500, porciones: 1 }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.violaciones).toHaveLength(1);
    const v = r.violaciones[0];
    expect(v.condicion).toBe('HTA');
    expect(v.nutriente).toBe('sodioMg');
    expect(v.limite).toBe(LIMITES_DIARIOS.HTA.sodioMg);
    expect(v.actual).toBe(2100);
    expect(v.excedidoEn).toBe(100);
    expect(v.responsables[0].id).toBe('a');
  });

  it('multiplica el nutriente por las porciones', () => {
    const r = evaluarReglasClinicas(HTA, [alimento({ id: 'a', sodioMg: 700, porciones: 3 })]);
    expect(r.violaciones[0].actual).toBe(2100);
  });

  it('en el límite exacto no hay violación', () => {
    const r = evaluarReglasClinicas(HTA, [alimento({ id: 'a', sodioMg: 2000 })]);
    expect(r.violaciones).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('un alimento con sodio nulo no cuenta como 0: queda como incógnita', () => {
    const r = evaluarReglasClinicas(HTA, [
      alimento({ id: 'a', sodioMg: 100 }),
      alimento({ id: 'b', sodioMg: null }),
    ]);
    expect(r.violaciones).toEqual([]);
    expect(r.incognitas).toHaveLength(1);
    expect(r.incognitas[0].sinDato).toEqual([{ id: 'b', nombre: 'alimento b' }]);
    expect(r.incognitas[0].conocido).toBe(100);
    expect(r.ok).toBe(false);
  });

  it('con datos completos y bajo el techo el día pasa', () => {
    const r = evaluarReglasClinicas(HTA, [
      alimento({ id: 'a', sodioMg: 400 }),
      alimento({ id: 'b', sodioMg: 300 }),
    ]);
    expect(r.ok).toBe(true);
    expect(r.incognitas).toEqual([]);
  });
});

describe('evaluarReglasClinicas — ERC (potasio y fósforo)', () => {
  it('evalúa los dos nutrientes del mismo día', () => {
    const r = evaluarReglasClinicas(ERC, [
      alimento({ id: 'a', potasioMg: 2000, fosforoMg: 600 }),
      alimento({ id: 'b', potasioMg: 1500, fosforoMg: 700 }),
    ]);
    expect(r.violaciones.map((v) => v.nutriente).sort()).toEqual(['fosforoMg', 'potasioMg']);
  });

  it('sin exceso en ninguno de los dos no hay violación', () => {
    const r = evaluarReglasClinicas(ERC, [alimento({ id: 'a', potasioMg: 1000, fosforoMg: 400 })]);
    expect(r.ok).toBe(true);
  });
});

describe('evaluarReglasClinicas — diabetes (índice glucémico)', () => {
  it('marca violación cuando el promedio supera el techo', () => {
    const r = evaluarReglasClinicas(DIABETES, [
      alimento({ id: 'a', indiceGlucemico: 80 }),
      alimento({ id: 'b', indiceGlucemico: 70 }),
    ]);
    expect(r.violaciones[0].nutriente).toBe('indiceGlucemico');
    expect(r.violaciones[0].actual).toBe(75);
    expect(r.violaciones[0].limite).toBe(IG_PROMEDIO_MAXIMO);
  });

  it('promedio en el techo exacto no viola', () => {
    const r = evaluarReglasClinicas(DIABETES, [
      alimento({ id: 'a', indiceGlucemico: IG_PROMEDIO_MAXIMO }),
      alimento({ id: 'b', indiceGlucemico: IG_PROMEDIO_MAXIMO }),
    ]);
    expect(r.violaciones).toEqual([]);
  });

  it('un índice glucémico nulo deja el promedio incompleto', () => {
    const r = evaluarReglasClinicas(DIABETES, [
      alimento({ id: 'a', indiceGlucemico: 40 }),
      alimento({ id: 'b', indiceGlucemico: null }),
    ]);
    expect(r.violaciones).toEqual([]);
    expect(r.incognitas[0].nutriente).toBe('indiceGlucemico');
    expect(r.ok).toBe(false);
  });
});

describe('evaluarReglasClinicas — alcance', () => {
  it('sin condiciones evaluadas no inventa violaciones', () => {
    const r = evaluarReglasClinicas({}, [alimento({ id: 'a', sodioMg: 9000 })]);
    expect(r).toMatchObject({ evaluadas: [], violaciones: [], incognitas: [], ok: true });
  });
});
