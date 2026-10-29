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

  it('manda los nutrientes clínicos de cada alimento en el catálogo', async () => {
    const generar = vi.fn(async () => ({ tiempos: [] }));
    const svc = new RecomendadorService({
      generarJson: generar,
    } as unknown as BedrockService);

    await svc.generar({
      ...entrada(),
      catalogo: [
        {
          id: 'frijol',
          nombre: 'Frijoles parados',
          categoria: 'LEGUMINOSA',
          porcionDescripcion: '1 taza',
          kcal: 180,
          proteinaG: 11,
          carbohidratoG: 30,
          grasaG: 1,
          tiposComida: ['ALMUERZO'],
          fibraG: 8,
          sodioMg: 420,
          potasioMg: 610,
          fosforoMg: 180,
          azucaresG: 2,
          grasasSatG: 0.3,
          indiceGlucemico: 30,
        },
      ],
    });

    const mensaje = generar.mock.calls[0][1] as string;
    expect(mensaje).toMatch(/Na 420mg/);
    expect(mensaje).toMatch(/K 610mg/);
    expect(mensaje).toMatch(/IG 30/);
  });

  it('manda el perfil clínico del paciente a la IA', async () => {
    const generar = vi.fn(async () => ({ tiempos: [] }));
    const svc = new RecomendadorService({
      generarJson: generar,
    } as unknown as BedrockService);

    await svc.generar({
      ...entrada(),
      perfilClinico: {
        edad: 31,
        sexo: 'F',
        pesoKg: 73.4,
        tallaCm: 160,
        imc: 28.7,
        pctGrasa: 33.5,
        masaMuscularKg: 24.8,
        grasaVisceral: 8,
        estadoFisiologico: 'LACTANCIA',
        condiciones: [
          {
            nombre: 'Hipertensión arterial',
            descripcion:
              'Menos sodio: limitar embutidos, quesos salados y caldos concentrados.',
          },
        ],
        alergias: 'Penicilina',
        medicamentos: ['Metformina 850 mg cada 12 horas'],
        habitos: {
          comidasAlDia: 4,
          aguaLitros: 1.8,
          horasSueno: 6.5,
          alcohol: 'Social',
          tabaco: 'No',
          quienCocina: 'Ella misma',
          presupuesto: 'Medio',
        },
        objetivo: { pesoKg: 65, fecha: '2027-03-01', meta: 'BAJAR' },
      },
    });

    const mensaje = generar.mock.calls[0][1] as string;
    expect(mensaje).toMatch(/Hipertensión arterial/);
    expect(mensaje).toMatch(/Menos sodio/);
    expect(mensaje).toMatch(/lactancia/i);
    expect(mensaje).toMatch(/Penicilina/);
    expect(mensaje).toMatch(/Metformina/);
    expect(mensaje).toMatch(/Presupuesto: Medio/);
    expect(mensaje).toMatch(/6\.5 h/);
  });
});
