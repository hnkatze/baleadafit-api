import type { PerfilClinico } from '../pacientes/perfil-clinico.js';
import type { AlimentoCatalogo, TiempoPropuesto } from './generador-reglas.js';
import { ajustarDiaClinico } from './ajuste-clinico.js';

const alimento = (
  id: string,
  extra: Partial<AlimentoCatalogo> = {},
): AlimentoCatalogo => ({
  id,
  nombre: id,
  categoria: 'PROTEINA',
  porcionDescripcion: '1 porción',
  kcal: 100,
  proteinaG: 10,
  carbohidratoG: 10,
  grasaG: 2,
  tiposComida: ['ALMUERZO'],
  ...extra,
});

const mapa = (alimentos: AlimentoCatalogo[]) =>
  new Map(alimentos.map((a) => [a.id, a]));

const dia = (items: { alimentoId: string; porciones: number }[]): TiempoPropuesto[] => [
  { tipo: 'ALMUERZO', pctKcal: 1, items },
];

const hta = (nombre = 'Hipertensión arterial'): PerfilClinico => ({
  condiciones: [{ nombre }],
});

describe('ajustarDiaClinico', () => {
  it('baja la porción del responsable hasta entrar en el techo de sodio', () => {
    const salado = alimento('salado', { sodioMg: 1200 });
    const neutro = alimento('neutro', { sodioMg: 100 });
    const r = ajustarDiaClinico(
      dia([
        { alimentoId: 'salado', porciones: 2 },
        { alimentoId: 'neutro', porciones: 1 },
      ]),
      mapa([salado, neutro]),
      hta(),
    );

    const porciones = r.tiempos[0].items.find(
      (i) => i.alimentoId === 'salado',
    )!.porciones;
    // 2000 mg de techo: 1.5 porciones × 1200 + 100 = 1900, dentro.
    expect(porciones).toBe(1.5);
    expect(r.violaciones).toEqual([]);
    expect(r.cambios.join('\n')).toMatch(/salado: 2 → 1\.5 porciones por sodioMg/);
  });

  it('retira el alimento cuando ya está en la porción mínima y sigue excedido', () => {
    // En la porción mínima todavía aporta 2500 mg, por encima del techo de 2000.
    const salado = alimento('salado', { sodioMg: 5000 });
    const r = ajustarDiaClinico(
      dia([{ alimentoId: 'salado', porciones: 0.5 }]),
      mapa([salado]),
      hta(),
    );

    expect(r.tiempos[0].items).toEqual([]);
    expect(r.cambios.join('\n')).toMatch(/salado: retirado por sodioMg/);
    expect(r.violaciones).toEqual([]);
  });

  it('no toca el día sin condiciones que esta capa verifique', () => {
    const salado = alimento('salado', { sodioMg: 5000 });
    const items = [{ alimentoId: 'salado', porciones: 2 }];
    const r = ajustarDiaClinico(
      dia([...items]),
      mapa([salado]),
      { condiciones: [{ nombre: 'Ovario poliquístico' }] },
    );

    expect(r.tiempos[0].items).toEqual(items);
    expect(r.cambios).toEqual([]);
    expect(r.violaciones).toEqual([]);
  });

  it('informa como incógnita lo que no tiene dato en vez de darlo por bueno', () => {
    const sinDato = alimento('sin-dato');
    const r = ajustarDiaClinico(
      dia([{ alimentoId: 'sin-dato', porciones: 1 }]),
      mapa([sinDato]),
      hta(),
    );

    expect(r.incognitas).toHaveLength(1);
    expect(r.incognitas[0]).toMatchObject({
      condicion: 'HTA',
      nutriente: 'sodioMg',
      conocido: 0,
    });
    expect(r.cambios).toEqual([]);
  });

  it('con diabetes retira el alimento de índice glucémico alto sin gastar porciones', () => {
    const alto = alimento('dulce', { indiceGlucemico: 85 });
    const bajo = alimento('integral', { indiceGlucemico: 30 });
    const r = ajustarDiaClinico(
      dia([
        { alimentoId: 'dulce', porciones: 3 },
        { alimentoId: 'integral', porciones: 1 },
      ]),
      mapa([alto, bajo]),
      { condiciones: [{ nombre: 'Diabetes tipo 2' }] },
    );

    expect(r.tiempos[0].items).toEqual([{ alimentoId: 'integral', porciones: 1 }]);
    expect(r.cambios.join('\n')).toMatch(/dulce: retirado por indiceGlucemico/);
  });

  it('deja el día dentro del techo cuando el dato alcanza y reporta lo que no cubre', () => {
    const salado = alimento('salado', { sodioMg: 1200 });
    const otro = alimento('otro', { sodioMg: 400 });
    const sinDato = alimento('sin-dato');
    const r = ajustarDiaClinico(
      dia([
        { alimentoId: 'salado', porciones: 2 },
        { alimentoId: 'otro', porciones: 1 },
        { alimentoId: 'sin-dato', porciones: 1 },
      ]),
      mapa([salado, otro, sinDato]),
      { condiciones: [{ nombre: 'HTA' }] },
    );

    const sodio = r.tiempos[0].items.reduce((suma, i) => {
      const a = [salado, otro, sinDato].find((x) => x.id === i.alimentoId)!;
      return suma + (a.sodioMg ?? 0) * i.porciones;
    }, 0);
    expect(sodio).toBeLessThanOrEqual(2000);
    expect(r.violaciones).toEqual([]);
    // El alimento sin dato no desaparece: se informa que el techo no se cubre.
    expect(r.incognitas[0].sinDato.map((a) => a.id)).toEqual(['sin-dato']);
    expect(r.tiempos[0].items).toContainEqual({
      alimentoId: 'sin-dato',
      porciones: 1,
    });
  });

  it('conserva los tiempos que no tenían nada que corregir', () => {
    const salado = alimento('salado', { sodioMg: 200 });
    const r = ajustarDiaClinico(
      [
        { tipo: 'DESAYUNO', pctKcal: 0.5, items: [] },
        {
          tipo: 'ALMUERZO',
          pctKcal: 0.5,
          items: [{ alimentoId: 'salado', porciones: 1 }],
        },
      ],
      mapa([salado]),
      hta(),
    );

    expect(r.tiempos.map((t) => t.tipo)).toEqual(['DESAYUNO', 'ALMUERZO']);
    expect(r.tiempos[0].items).toEqual([]);
    expect(r.tiempos[1].items).toEqual([
      { alimentoId: 'salado', porciones: 1 },
    ]);
  });
});
