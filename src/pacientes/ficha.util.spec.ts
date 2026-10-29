import {
  alertasDeFicha,
  clasificarImc,
  progresoDePeso,
  ultimaComposicion,
} from './ficha.util.js';

describe('clasificarImc', () => {
  it('clasifica con los rangos de la OMS', () => {
    expect(clasificarImc(17.5)).toBe('BAJO_PESO');
    expect(clasificarImc(18.5)).toBe('NORMAL');
    expect(clasificarImc(24.9)).toBe('NORMAL');
    expect(clasificarImc(25)).toBe('SOBREPESO');
    expect(clasificarImc(29.9)).toBe('SOBREPESO');
    expect(clasificarImc(30)).toBe('OBESIDAD_I');
    expect(clasificarImc(34.9)).toBe('OBESIDAD_I');
    expect(clasificarImc(35)).toBe('OBESIDAD_II');
    expect(clasificarImc(40)).toBe('OBESIDAD_III');
  });
});

describe('progresoDePeso', () => {
  const dia = (fecha: string, pesoKg: number) => ({
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    pesoKg,
  });

  it('calcula diferencia, ritmo y proyección contra el objetivo', () => {
    const r = progresoDePeso(
      [dia('2026-09-03', 76), dia('2026-10-01', 72)],
      { pesoKg: 65, fecha: new Date('2027-03-01T00:00:00.000Z') },
    );

    expect(r).toMatchObject({
      pesoInicial: 76,
      pesoActual: 72,
      deltaKg: -4,
      // 4 semanas → 1 kg por semana
      ritmoKgSemana: -1,
    });
    // Del 1 de octubre al 1 de marzo hay 21.6 semanas → 72 − 21.6 ≈ 50.4 kg.
    expect(r.proyeccionKg).toBeCloseTo(50.4, 0);
  });

  it('no proyecta sin objetivo de fecha ni con una sola medición', () => {
    expect(
      progresoDePeso([dia('2026-09-03', 76)], { pesoKg: 65, fecha: null }),
    ).toMatchObject({
      pesoInicial: 76,
      pesoActual: 76,
      deltaKg: 0,
      ritmoKgSemana: null,
      proyeccionKg: null,
    });
  });

  it('no proyecta si el objetivo ya venció', () => {
    const r = progresoDePeso(
      [dia('2026-09-03', 76), dia('2026-10-01', 72)],
      { pesoKg: 65, fecha: new Date('2026-09-15T00:00:00.000Z') },
    );
    expect(r.proyeccionKg).toBeNull();
  });

  it('devuelve todo nulo sin mediciones', () => {
    expect(progresoDePeso([], { pesoKg: 65, fecha: null })).toMatchObject({
      pesoInicial: null,
      pesoActual: null,
      deltaKg: null,
      ritmoKgSemana: null,
      proyeccionKg: null,
    });
  });
});

describe('alertasDeFicha', () => {
  const hoy = new Date('2026-10-29T00:00:00.000Z');
  const base = {
    hoy,
    meta: 'BAJAR' as const,
    // Con progreso real: si el peso no se mueve, la alerta de estancamiento
    // corresponde (ver el test de abajo).
    mediciones: [
      { fecha: new Date('2026-10-20T00:00:00.000Z'), pesoKg: 73 },
      { fecha: new Date('2026-10-10T00:00:00.000Z'), pesoKg: 74.2 },
      { fecha: new Date('2026-10-01T00:00:00.000Z'), pesoKg: 75.4 },
    ],
    planActivo: { creadoEn: new Date('2026-10-25T00:00:00.000Z') },
    adherencia: { porcentaje: 0.8, total: 20 },
  };

  it('no alerta cuando todo está al día', () => {
    expect(alertasDeFicha(base)).toEqual([]);
  });

  it('alerta por falta de medición reciente', () => {
    const r = alertasDeFicha({
      ...base,
      mediciones: [{ fecha: new Date('2026-08-01T00:00:00.000Z'), pesoKg: 75 }],
    });
    expect(r.map((a) => a.tipo)).toContain('SIN_MEDICION');
  });

  it('alerta por peso estancado solo si la meta no es mantener', () => {
    const estancado = {
      ...base,
      mediciones: [
        { fecha: new Date('2026-10-20T00:00:00.000Z'), pesoKg: 73 },
        { fecha: new Date('2026-10-10T00:00:00.000Z'), pesoKg: 73.1 },
        { fecha: new Date('2026-10-01T00:00:00.000Z'), pesoKg: 73.2 },
      ],
    };
    expect(alertasDeFicha(estancado).map((a) => a.tipo)).toContain(
      'PESO_ESTANCADO',
    );
    expect(
      alertasDeFicha({ ...estancado, meta: 'MANTENER' }).map((a) => a.tipo),
    ).not.toContain('PESO_ESTANCADO');
  });

  it('alerta cuando no hay plan activo o está viejo', () => {
    expect(
      alertasDeFicha({ ...base, planActivo: null }).map((a) => a.tipo),
    ).toContain('SIN_PLAN_ACTIVO');

    expect(
      alertasDeFicha({
        ...base,
        planActivo: { creadoEn: new Date('2026-05-01T00:00:00.000Z') },
      }).map((a) => a.tipo),
    ).toContain('PLAN_VIEJO');
  });

  it('alerta por adherencia baja solo con datos suficientes', () => {
    expect(
      alertasDeFicha({
        ...base,
        adherencia: { porcentaje: 0.3, total: 20 },
      }).map((a) => a.tipo),
    ).toContain('ADHERENCIA_BAJA');

    // Con pocos registros no se juzga.
    expect(
      alertasDeFicha({
        ...base,
        adherencia: { porcentaje: 0, total: 2 },
      }).map((a) => a.tipo),
    ).not.toContain('ADHERENCIA_BAJA');
  });
});

describe('ultimaComposicion', () => {
  const m = (fecha: string, extra = {}) => ({
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    pesoKg: 73,
    tallaCm: 160,
    pctGrasa: null as number | null,
    masaGrasaKg: null as number | null,
    masaMuscularKg: null as number | null,
    grasaVisceral: null as number | null,
    ...extra,
  });

  it('toma la última medición que trae composición, no la última a secas', () => {
    const r = ultimaComposicion([
      m('2026-10-01', { pctGrasa: 34, masaMuscularKg: 24.2 }),
      m('2026-10-15', { pctGrasa: 33.5, masaGrasaKg: 24.5 }),
      m('2026-10-29'),
    ]);
    expect(r).toMatchObject({
      pctGrasa: 33.5,
      masaGrasaKg: 24.5,
      fecha: new Date('2026-10-15T00:00:00.000Z'),
    });
  });

  it('devuelve nulo si ninguna medición trae composición', () => {
    expect(ultimaComposicion([m('2026-10-29')])).toMatchObject({
      pctGrasa: null,
      masaGrasaKg: null,
      masaMuscularKg: null,
      fecha: null,
    });
  });
});
