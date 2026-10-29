import type {
  CategoriaAlimento,
  TipoComida,
} from '../generated/prisma/enums.js';
import {
  ajustarPorciones,
  generarPlanPorReglas,
  type AlimentoCatalogo,
} from './generador-reglas.js';
import {
  DISTRIBUCION_TIEMPOS_DEFAULT,
  TOLERANCIA_KCAL,
} from './nutricion.util.js';

const TODOS: TipoComida[] = [
  'DESAYUNO',
  'MERIENDA_AM',
  'ALMUERZO',
  'MERIENDA_PM',
  'CENA',
];

let n = 0;
const a = (
  nombre: string,
  categoria: CategoriaAlimento,
  kcal: number,
  tiposComida: TipoComida[] = TODOS,
): AlimentoCatalogo => ({
  id: `id-${++n}`,
  nombre,
  categoria,
  porcionDescripcion: '1 porción',
  kcal,
  proteinaG: 5,
  carbohidratoG: 10,
  grasaG: 3,
  tiposComida,
});

const catalogo: AlimentoCatalogo[] = [
  a('Baleada', 'PLATO_TIPICO', 330, ['DESAYUNO', 'CENA']),
  a('Casamiento', 'PLATO_TIPICO', 300, ['DESAYUNO', 'ALMUERZO', 'CENA']),
  a('Pollo', 'PROTEINA', 150, ['ALMUERZO', 'CENA']),
  a('Huevo', 'PROTEINA', 100, ['DESAYUNO', 'CENA']),
  a('Frijoles', 'LEGUMINOSA', 115, ['DESAYUNO', 'ALMUERZO', 'CENA']),
  a('Arroz', 'CEREAL_TUBERCULO', 105, ['ALMUERZO', 'CENA']),
  a('Chismol', 'VERDURA', 20, ['DESAYUNO', 'ALMUERZO', 'CENA']),
  a('Banano', 'FRUTA', 105, ['DESAYUNO', 'MERIENDA_AM', 'MERIENDA_PM']),
  a('Yogur', 'LACTEO', 150, ['DESAYUNO', 'MERIENDA_AM', 'MERIENDA_PM']),
];
const mapa = new Map(catalogo.map((x) => [x.id, x]));
const kcalDe = (items: { alimentoId: string; porciones: number }[]) =>
  items.reduce((s, i) => s + mapa.get(i.alimentoId)!.kcal * i.porciones, 0);

describe('generador por reglas', () => {
  it('genera los 5 tiempos con alimentos aptos para cada uno', () => {
    for (const semilla of [0, 1, 2, 7]) {
      const plan = generarPlanPorReglas(
        catalogo,
        2000,
        DISTRIBUCION_TIEMPOS_DEFAULT,
        semilla,
      );
      expect(plan.map((t) => t.tipo)).toEqual(TODOS);
      for (const t of plan) {
        expect(t.items.length).toBeGreaterThan(0);
        for (const i of t.items)
          expect(mapa.get(i.alimentoId)!.tiposComida).toContain(t.tipo);
      }
    }
  });

  it('queda dentro de ±10 % de la meta por tiempo cuando es alcanzable', () => {
    const plan = generarPlanPorReglas(
      catalogo,
      2000,
      DISTRIBUCION_TIEMPOS_DEFAULT,
      1,
    );
    for (const t of plan) {
      const meta = 2000 * t.pctKcal;
      expect(Math.abs(kcalDe(t.items) - meta)).toBeLessThanOrEqual(
        meta * TOLERANCIA_KCAL,
      );
    }
  });

  it('omite tiempos con 0 % en la distribución', () => {
    const plan = generarPlanPorReglas(catalogo, 1800, {
      DESAYUNO: 0.3,
      ALMUERZO: 0.4,
      CENA: 0.3,
    });
    expect(plan.map((t) => t.tipo)).toEqual(['DESAYUNO', 'ALMUERZO', 'CENA']);
  });

  it('ajusta porciones en pasos de 0.25 dentro de los límites y descarta ids desconocidos', () => {
    const items = ajustarPorciones(
      [
        { alimentoId: catalogo[2].id, porciones: 1 },
        { alimentoId: catalogo[5].id, porciones: 1 },
        { alimentoId: 'no-existe', porciones: 1 },
      ],
      mapa,
      700,
    );
    expect(items).toHaveLength(2);
    for (const i of items) {
      expect(i.porciones % 0.25).toBe(0);
      expect(i.porciones).toBeGreaterThanOrEqual(0.5);
      expect(i.porciones).toBeLessThanOrEqual(3);
    }
    expect(Math.abs(kcalDe(items) - 700)).toBeLessThanOrEqual(70);
  });
});
