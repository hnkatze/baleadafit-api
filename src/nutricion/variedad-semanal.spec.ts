import type { CategoriaAlimento } from '../generated/prisma/enums.js';
import type { AlimentoCatalogo, TiempoPropuesto } from './generador-reglas.js';
import type { DiaSemana } from '../generated/prisma/enums.js';
import { ajustarVariedadSemanal } from './variedad-semanal.js';

const alimento = (
  id: string,
  categoria: CategoriaAlimento,
  extra: Partial<AlimentoCatalogo> = {},
): AlimentoCatalogo => ({
  id,
  nombre: id,
  categoria,
  porcionDescripcion: '1 porción',
  kcal: 100,
  proteinaG: 10,
  carbohidratoG: 10,
  grasaG: 2,
  tiposComida: ['ALMUERZO', 'CENA', 'DESAYUNO'],
  ...extra,
});

interface Dia {
  dia: DiaSemana;
  tiempos: TiempoPropuesto[];
}

const diaCon = (dia: DiaSemana, ids: string[]): Dia => ({
  dia,
  tiempos: [
    {
      tipo: 'ALMUERZO',
      pctKcal: 1,
      items: ids.map((alimentoId) => ({ alimentoId, porciones: 1 })),
    },
  ],
});

const ids = (dias: Dia[]) =>
  dias.flatMap((d) => d.tiempos.flatMap((t) => t.items.map((i) => i.alimentoId)));

const apariciones = (dias: Dia[], id: string) =>
  ids(dias).filter((x) => x === id).length;

describe('ajustarVariedadSemanal', () => {
  it('no repite el mismo plato típico en días consecutivos', () => {
    const catalogo = [
      alimento('baleada', 'PLATO_TIPICO'),
      alimento('tajadas', 'PLATO_TIPICO'),
      alimento('arroz', 'CEREAL_TUBERCULO'),
    ];
    const dias: Dia[] = [
      diaCon('LUNES', ['baleada', 'arroz']),
      diaCon('MARTES', ['baleada', 'arroz']),
    ];

    const r = ajustarVariedadSemanal(dias, catalogo);

    expect(r.dias[0].tiempos[0].items[0].alimentoId).toBe('baleada');
    expect(r.dias[1].tiempos[0].items[0].alimentoId).toBe('tajadas');
    expect(r.cambios.join('\n')).toMatch(/MARTES: baleada → tajadas/);
  });

  it('respeta el techo de apariciones y conserva las primeras', () => {
    const catalogo = [
      alimento('pollo', 'PROTEINA'),
      alimento('pescado', 'PROTEINA'),
      alimento('arroz', 'CEREAL_TUBERCULO'),
    ];
    const dias: Dia[] = [
      diaCon('LUNES', ['pollo', 'arroz']),
      diaCon('MARTES', ['pollo', 'arroz']),
      diaCon('MIERCOLES', ['pollo', 'arroz']),
      diaCon('JUEVES', ['pollo', 'arroz']),
      diaCon('VIERNES', ['pollo', 'arroz']),
    ];

    const r = ajustarVariedadSemanal(dias, catalogo, {
      maxApariciones: 3,
      minFuentesProteicas: 1,
    });

    expect(apariciones(r.dias, 'pollo')).toBe(3);
    expect(apariciones(r.dias, 'pescado')).toBe(2);
    // La primera aparición nunca se toca: la variedad se resuelve hacia adelante.
    expect(r.dias[0].tiempos[0].items[0].alimentoId).toBe('pollo');
  });

  it('no rompe el plan cuando el catálogo no tiene alternativa', () => {
    const catalogo = [alimento('pollo', 'PROTEINA')];
    const dias: Dia[] = [
      diaCon('LUNES', ['pollo']),
      diaCon('MARTES', ['pollo']),
      diaCon('MIERCOLES', ['pollo']),
      diaCon('JUEVES', ['pollo']),
    ];

    const r = ajustarVariedadSemanal(dias, catalogo, {
      maxApariciones: 2,
      minFuentesProteicas: 4,
    });

    // Nada se vacía ni se inventa: se queda el alimento y se informa el límite.
    expect(ids(r.dias)).toEqual(['pollo', 'pollo', 'pollo', 'pollo']);
    expect(r.cambios.join('\n')).toMatch(/fuentes proteicas/);
  });

  it('busca el mínimo de fuentes proteicas distintas en la semana', () => {
    const catalogo = [
      alimento('pollo', 'PROTEINA'),
      alimento('pescado', 'PROTEINA'),
      alimento('frijol', 'LEGUMINOSA'),
      alimento('huevo', 'PROTEINA'),
      alimento('arroz', 'CEREAL_TUBERCULO'),
    ];
    const dias: Dia[] = [
      diaCon('LUNES', ['pollo', 'arroz']),
      diaCon('MARTES', ['pollo', 'arroz']),
      diaCon('MIERCOLES', ['pollo', 'arroz']),
      diaCon('JUEVES', ['pollo', 'arroz']),
    ];

    const r = ajustarVariedadSemanal(dias, catalogo, {
      maxApariciones: 5,
      minFuentesProteicas: 3,
    });

    const proteicas = new Set(
      ids(r.dias).filter((id) => ['pollo', 'pescado', 'frijol', 'huevo'].includes(id)),
    );
    expect(proteicas.size).toBeGreaterThanOrEqual(3);
    expect(r.dias).toHaveLength(4);
  });

  it('conserva los días y sus tiempos aunque cambie alimentos', () => {
    const catalogo = [
      alimento('baleada', 'PLATO_TIPICO'),
      alimento('tajadas', 'PLATO_TIPICO'),
    ];
    const dias: Dia[] = [
      diaCon('LUNES', ['baleada']),
      {
        dia: 'MARTES',
        tiempos: [
          { tipo: 'DESAYUNO', pctKcal: 0.5, items: [{ alimentoId: 'baleada', porciones: 1 }] },
          { tipo: 'CENA', pctKcal: 0.5, items: [{ alimentoId: 'baleada', porciones: 2 }] },
        ],
      },
    ];

    const r = ajustarVariedadSemanal(dias, catalogo);
    expect(r.dias.map((d) => d.dia)).toEqual(['LUNES', 'MARTES']);
    expect(r.dias[1].tiempos.map((t) => t.tipo)).toEqual(['DESAYUNO', 'CENA']);
    expect(r.dias[1].tiempos[1].items[0].porciones).toBe(2);
  });
});
