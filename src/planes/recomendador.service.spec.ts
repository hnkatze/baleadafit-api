import type { BedrockService } from '../ia/bedrock.service.js';
import { IaNoDisponibleError } from '../ia/bedrock.service.js';
import { DIAS_SEMANA } from '../nutricion/nutricion.util.js';
import type { AlimentoCatalogo } from '../nutricion/generador-reglas.js';
import {
  RecomendadorService,
  type EntradaRecomendador,
  type ResultadoRecomendador,
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
  ({
    generarJson: vi.fn(impl),
    generarJsonStream: vi.fn(impl),
  }) as unknown as BedrockService;

const dia = (r: ResultadoRecomendador, nombre: (typeof DIAS_SEMANA)[number]) =>
  r.dias.find((d) => d.dia === nombre)!;

const idsDe = (r: ResultadoRecomendador) =>
  r.dias.flatMap((d) => d.tiempos.flatMap((t) => t.items.map((i) => i.alimentoId)));

describe('RecomendadorService', () => {
  it('usa la propuesta de la IA, descarta ids inventados y completa tiempos vacíos', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        resumen: 'Plan con comida típica.',
        dias: [
          {
            dia: 'LUNES',
            tiempos: [
              {
                tipo: 'DESAYUNO',
                items: [
                  { alimento: 0, porciones: 1 },
                  { alimento: 999, porciones: 2 },
                ],
                justificacion: 'Desayuno típico.',
              },
              {
                tipo: 'ALMUERZO',
                items: [
                  { alimento: 1, porciones: 2 },
                  { alimento: 2, porciones: 2 },
                  { alimento: 3, porciones: 1 },
                ],
              },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    expect(r.origen).toBe('IA');
    expect(idsDe(r)).not.toContain('inventado');
    expect(
      dia(r, 'LUNES').tiempos.find((t) => t.tipo === 'CENA')!.items.length,
    ).toBeGreaterThan(0);
    expect(r.justificacion).toMatch(/completados por reglas/);
  });

  it('no persiste porciones fuera de rango: ese tiempo lo completa por reglas', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        dias: [
          {
            dia: 'LUNES',
            tiempos: [
              {
                tipo: 'ALMUERZO',
                items: [
                  { alimento: 1, porciones: 9 },
                  { alimento: 2, porciones: 2 },
                ],
                justificacion: 'Almuerzo del modelo.',
              },
              {
                tipo: 'DESAYUNO',
                items: [{ alimento: 0, porciones: 1 }],
              },
              {
                tipo: 'CENA',
                items: [{ alimento: 1, porciones: 2 }],
              },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    const lunes = dia(r, 'LUNES');
    const almuerzo = lunes.tiempos.find((t) => t.tipo === 'ALMUERZO')!;
    // El tiempo roto no se persiste a medias: se regenera completo.
    expect(almuerzo.items.every((i) => i.porciones <= 4)).toBe(true);
    expect(
      almuerzo.items.some((i) => i.alimentoId === 'pollo' && i.porciones === 9),
    ).toBe(false);
    expect(lunes.justificacion).toMatch(/Almuerzo: completado por reglas/);
    expect(lunes.justificacion).toMatch(/fuera de contrato/);
    // Los tiempos que sí vinieron bien se usan tal cual.
    expect(
      lunes.tiempos.find((t) => t.tipo === 'CENA')!.items.map((i) => i.alimentoId),
    ).toEqual(['pollo']);
  });

  it('un día con forma rota queda por reglas y la semana sigue completa', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        dias: [
          { dia: 'LUNES', tiempos: 'no-es-un-arreglo' },
          {
            dia: 'MARTES',
            tiempos: [
              {
                tipo: 'ALMUERZO',
                items: [{ alimento: 2, porciones: 2 }],
              },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    expect(r.dias.map((d) => d.dia)).toEqual(DIAS_SEMANA);
    const lunes = dia(r, 'LUNES');
    expect(lunes.tiempos).toHaveLength(3);
    expect(lunes.justificacion).toMatch(/no devolvió ningún tiempo válido/);
    expect(lunes.tiempos.every((t) => t.items.length > 0)).toBe(true);
    // La semana no se rompe: se distingue el día ilegible de los que no vinieron.
    expect(r.justificacion).toMatch(
      /1 día\(s\) completados por reglas porque la respuesta de la IA no fue válida/,
    );
    expect(r.justificacion).toMatch(
      /5 día\(s\) completados por reglas porque la IA no los devolvió/,
    );
  });

  it('devuelve los siete días, en orden y sin repetir, aunque la IA devuelva uno solo', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        dias: [
          {
            dia: 'LUNES',
            tiempos: [
              {
                tipo: 'ALMUERZO',
                items: [{ alimento: 1, porciones: 2 }],
              },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    expect(r.dias.map((d) => d.dia)).toEqual(DIAS_SEMANA);
    for (const d of r.dias) {
      expect(d.tiempos.map((t) => t.tipo)).toEqual([
        'DESAYUNO',
        'ALMUERZO',
        'CENA',
      ]);
      expect(d.tiempos.every((t) => t.items.length > 0)).toBe(true);
    }
    expect(r.justificacion).toMatch(/6 día\(s\) completados por reglas/);
  });

  it('ignora días desconocidos y repeticiones de día', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        dias: [
          {
            dia: 'lunes',
            tiempos: [
              {
                tipo: 'almuerzo',
                items: [{ alimento: 1, porciones: 2 }],
              },
            ],
          },
          {
            dia: 'LUNES',
            tiempos: [
              {
                tipo: 'ALMUERZO',
                items: [{ alimento: 2, porciones: 2 }],
              },
            ],
          },
          {
            dia: 'FUNDAY',
            tiempos: [
              {
                tipo: 'ALMUERZO',
                items: [{ alimento: 0, porciones: 1 }],
              },
            ],
          },
        ],
      })),
    );
    const r = await svc.generar(entrada());
    expect(r.dias.map((d) => d.dia)).toEqual(DIAS_SEMANA);
    const almuerzo = dia(r, 'LUNES').tiempos.find((t) => t.tipo === 'ALMUERZO')!;
    expect(almuerzo.items.map((i) => i.alimentoId)).toEqual(['pollo']);
  });

  it('cae a la semana por reglas si la IA no devuelve ningún día utilizable', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({ resumen: 'sin días', dias: [] })),
    );
    const r = await svc.generar(entrada());
    expect(r.origen).toBe('REGLAS');
    expect(r.dias.map((d) => d.dia)).toEqual(DIAS_SEMANA);
    expect(r.justificacion).toMatch(/IA no disponible/);
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
    expect(r.dias).toHaveLength(7);
    expect(dia(r, 'DOMINGO').tiempos).toHaveLength(3);
  });

  it('no llama a la IA cuando usarIa = false', async () => {
    const bedrock = bedrockFalso(async () => ({}));
    const r = await new RecomendadorService(bedrock).generar(entrada(false));
    expect(r.origen).toBe('REGLAS');
    expect(bedrock.generarJsonStream).not.toHaveBeenCalled();
    expect(r.dias).toHaveLength(7);
  });

  it('aplica variedad semanal en código y nunca deja el plan incompleto', async () => {
    const r = await new RecomendadorService(
      bedrockFalso(async () => ({})),
    ).generar(entrada(false));

    // Con cuatro alimentos no hay alternativa para todo, y así debe ser: el
    // plan sigue completo y la justificación dice qué se ajustó y qué no.
    expect(r.dias).toHaveLength(7);
    for (const d of r.dias) {
      expect(d.tiempos).toHaveLength(3);
      expect(d.tiempos.every((t) => t.items.length > 0)).toBe(true);
    }
    expect(r.justificacion).toMatch(/Variedad semanal: \d+ ajuste\(s\)/);
    expect(r.justificacion).toMatch(/No se alcanzó el mínimo de fuentes proteicas/);
  });

  it('corrige en código el techo de sodio del expediente, sin depender del modelo', async () => {
    // El desayuno y el almuerzo de reglas superan los 2000 mg de sodio.
    const salado = [
      { ...catalogo[0], sodioMg: 2000 },
      { ...catalogo[1], sodioMg: 1800 },
      { ...catalogo[2], sodioMg: 5 },
      { ...catalogo[3], sodioMg: 10 },
    ];
    const r = await new RecomendadorService(
      bedrockFalso(async () => ({})),
    ).generar({
      ...entrada(false),
      catalogo: salado,
      perfilClinico: { condiciones: [{ nombre: 'Hipertensión arterial' }] },
    });

    const sodioPorDia = r.dias.map((d) =>
      d.tiempos
        .flatMap((t) => t.items)
        .reduce((suma, i) => {
          const a = salado.find((x) => x.id === i.alimentoId)!;
          return suma + (a.sodioMg ?? 0) * i.porciones;
        }, 0),
    );
    expect(Math.max(...sodioPorDia)).toBeLessThanOrEqual(2000);
    expect(r.justificacion).toMatch(/Reglas clínicas aplicadas en código: HTA/);
    expect(
      r.dias.some((d) => /Ajuste clínico:/.test(d.justificacion ?? '')),
    ).toBe(true);
  });

  it('no da por bueno un techo clínico que no puede verificar', async () => {
    const r = await new RecomendadorService(
      bedrockFalso(async () => ({})),
    ).generar({
      ...entrada(false),
      perfilClinico: { condiciones: [{ nombre: 'HTA' }] },
    });

    // El catálogo de prueba no trae sodio: se informa, no se asume cumplido.
    expect(r.justificacion).toMatch(/Reglas clínicas aplicadas en código: HTA/);
    expect(
      r.dias.every((d) =>
        /Sin dato de sodioMg/.test(d.justificacion ?? ''),
      ),
    ).toBe(true);
  });

  it('elige alimentos por índice del catálogo y descarta índices fuera de rango', async () => {
    const svc = new RecomendadorService(
      bedrockFalso(async () => ({
        dias: [
          {
            dia: 'LUNES',
            tiempos: [
              { tipo: 'DESAYUNO', items: [{ alimento: 0, porciones: 1 }] },
              {
                tipo: 'ALMUERZO',
                items: [
                  { alimento: 1, porciones: 2 },
                  { alimento: 99, porciones: 1 },
                  { alimento: -3, porciones: 1 },
                ],
              },
              { tipo: 'CENA', items: [{ alimento: 1, porciones: 1 }] },
            ],
          },
        ],
      })),
    );

    const r = await svc.generar(entrada());

    // índice 0 = primer alimento del catálogo, índice 1 = segundo.
    const lunes = dia(r, 'LUNES');
    expect(
      lunes.tiempos.find((t) => t.tipo === 'DESAYUNO')!.items[0].alimentoId,
    ).toBe(catalogo[0].id);
    const almuerzo = lunes.tiempos.find((t) => t.tipo === 'ALMUERZO')!;
    expect(almuerzo.items.map((i) => i.alimentoId)).not.toContain(undefined);
    expect(almuerzo.items.every((i) => catalogo.some((a) => a.id === i.alimentoId))).toBe(
      true,
    );
    expect(lunes.justificacion).toMatch(/fuera de contrato/);
  });

  it('manda el catálogo numerado y antes del contexto del paciente', async () => {
    const generar = vi.fn(async () => ({ dias: [] }));
    const svc = new RecomendadorService({
      generarJsonStream: generar,
    } as unknown as BedrockService);

    await svc.generar(entrada());

    const bloques = generar.mock.calls[0][1] as { texto: string; cachear?: boolean }[];
    expect(bloques[0].cachear).toBe(true);
    expect(bloques[0].texto).toMatch(/#0 \|/);
    expect(bloques[0].texto).toContain(catalogo[0].nombre);
    // Lo que cambia por paciente va después, para que el prefijo cacheado sirva.
    expect(bloques.slice(1).map((b) => b.texto).join(' ')).toMatch(
      /Meta del paciente/,
    );
  });

  it('el esquema que se pide al modelo usa índices, igual que el parser', async () => {
    const generar = vi.fn(async () => ({ dias: [] }));
    const svc = new RecomendadorService({
      generarJsonStream: generar,
    } as unknown as BedrockService);

    await svc.generar(entrada());

    const sistema = generar.mock.calls[0][0] as string;
    // Si el esquema vuelve a pedir `alimentoId`, el parser descarta todo y la
    // semana entera se cae a reglas sin que ningún test lo note.
    expect(sistema).toMatch(/"alimento": number/);
    expect(sistema).not.toMatch(/alimentoId/);
  });

  it('pide a la IA la semana completa con el esquema de días', async () => {
    const generar = vi.fn(async () => ({ dias: [] }));
    const svc = new RecomendadorService({
      generarJsonStream: generar,
    } as unknown as BedrockService);

    await svc.generar(entrada());

    const sistema = generar.mock.calls[0][0] as string;
    // El prompt del usuario viaja en bloques: el catálogo (cacheable) y el contexto.
    const mensaje = (generar.mock.calls[0][1] as { texto: string }[])
      .map((bloque) => bloque.texto)
      .join(' ');
    expect(sistema).toMatch(/siete días/i);
    expect(sistema).toMatch(/"dias"/);
    expect(sistema).toMatch(/DOMINGO/);
    expect(mensaje).toMatch(/Plan semanal/);
    for (const nombre of DIAS_SEMANA) expect(mensaje).toMatch(nombre);
  });

  it('manda los nutrientes clínicos de cada alimento en el catálogo', async () => {
    const generar = vi.fn(async () => ({ dias: [] }));
    const svc = new RecomendadorService({
      generarJsonStream: generar,
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

    // El prompt del usuario viaja en bloques: el catálogo (cacheable) y el contexto.
    const mensaje = (generar.mock.calls[0][1] as { texto: string }[])
      .map((bloque) => bloque.texto)
      .join(' ');
    expect(mensaje).toMatch(/Na 420mg/);
    expect(mensaje).toMatch(/K 610mg/);
    expect(mensaje).toMatch(/IG 30/);
  });

  it('manda el perfil clínico del paciente a la IA', async () => {
    const generar = vi.fn(async () => ({ dias: [] }));
    const svc = new RecomendadorService({
      generarJsonStream: generar,
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

    // El prompt del usuario viaja en bloques: el catálogo (cacheable) y el contexto.
    const mensaje = (generar.mock.calls[0][1] as { texto: string }[])
      .map((bloque) => bloque.texto)
      .join(' ');
    expect(mensaje).toMatch(/Hipertensión arterial/);
    expect(mensaje).toMatch(/Menos sodio/);
    expect(mensaje).toMatch(/lactancia/i);
    expect(mensaje).toMatch(/Penicilina/);
    expect(mensaje).toMatch(/Metformina/);
    expect(mensaje).toMatch(/Presupuesto: Medio/);
    expect(mensaje).toMatch(/6\.5 h/);
  });
});
