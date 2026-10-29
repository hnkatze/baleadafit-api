import type { BedrockService } from '../ia/bedrock.service.js';
import { IaNoDisponibleError } from '../ia/bedrock.service.js';
import type { AlimentoCatalogo } from '../nutricion/generador-reglas.js';
import {
  RecomendadorService,
  type EntradaRecomendador,
} from './recomendador.service.js';

const catalogo: AlimentoCatalogo[] = [
  {
    id: 'baleada',
    nombre: 'Baleada',
    categoria: 'PLATO_TIPICO',
    porcionDescripcion: '1 u',
    kcal: 330,
    proteinaG: 11,
    carbohidratoG: 42,
    grasaG: 13,
    tiposComida: ['DESAYUNO', 'CENA'],
  },
  {
    id: 'pollo',
    nombre: 'Pollo',
    categoria: 'PROTEINA',
    porcionDescripcion: '90 g',
    kcal: 150,
    proteinaG: 28,
    carbohidratoG: 0,
    grasaG: 3.5,
    tiposComida: ['ALMUERZO', 'CENA'],
  },
  {
    id: 'arroz',
    nombre: 'Arroz',
    categoria: 'CEREAL_TUBERCULO',
    porcionDescripcion: '1/2 taza',
    kcal: 105,
    proteinaG: 2,
    carbohidratoG: 23,
    grasaG: 0.2,
    tiposComida: ['ALMUERZO', 'CENA'],
  },
  {
    id: 'chismol',
    nombre: 'Chismol',
    categoria: 'VERDURA',
    porcionDescripcion: '1/2 taza',
    kcal: 20,
    proteinaG: 0.8,
    carbohidratoG: 4.5,
    grasaG: 0.2,
    tiposComida: ['DESAYUNO', 'ALMUERZO', 'CENA'],
  },
];

const entrada = (usarIa = true): EntradaRecomendador => ({
  catalogo,
  kcalObjetivo: 1800,
  proteinaG: 112,
  carbohidratoG: 225,
  grasaG: 50,
  distribucion: { DESAYUNO: 0.3, ALMUERZO: 0.4, CENA: 0.3 },
  restricciones: [],
  meta: 'MANTENER',
  usarIa,
  semilla: 0,
});

const bedrockFalso = (impl: () => Promise<unknown>) =>
  ({ generarJson: vi.fn(impl) }) as unknown as BedrockService;

describe('RecomendadorService', () => {
  it('usa la propuesta de la IA, descarta ids inventados y completa tiempos vacíos', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        resumen: 'Plan con comida típica.',
        tiempos: [
          {
            tipo: 'DESAYUNO',
            items: [
              { alimentoId: 'baleada', porciones: 1 },
              { alimentoId: 'inventado', porciones: 2 },
            ],
            justificacion: 'Desayuno típico.',
          },
          {
            tipo: 'ALMUERZO',
            items: [
              { alimentoId: 'pollo', porciones: 2 },
              { alimentoId: 'arroz', porciones: 2 },
              { alimentoId: 'chismol', porciones: 1 },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    expect(r.origen).toBe('IA');
    const ids = r.tiempos.flatMap((t) => t.items.map((i) => i.alimentoId));
    expect(ids).not.toContain('inventado');
    expect(
      r.tiempos.find((t) => t.tipo === 'CENA')!.items.length,
    ).toBeGreaterThan(0);
    expect(r.justificacion).toMatch(/completados por reglas/);
  });

  it('cae a reglas si Bedrock no está disponible', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => {
        throw new IaNoDisponibleError('sin credenciales');
      }),
    );
    const r = await svc.generar(entrada());
    expect(r.origen).toBe('REGLAS');
    expect(r.justificacion).toMatch(/sin credenciales/);
    expect(r.tiempos).toHaveLength(3);
  });

  it('no llama a la IA cuando usarIa = false', async () => {
    const bedrock = bedrockFalso(async () => ({}));
    const r = await new RecomendadorService(bedrock).generar(entrada(false));
    expect(r.origen).toBe('REGLAS');
    expect(bedrock.generarJson).not.toHaveBeenCalled();
  });
});
