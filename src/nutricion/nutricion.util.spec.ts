import {
  calcularEdad,
  calcularRequerimiento,
  imc,
  macrosDesdeKcal,
  sumarNutrientes,
  tmbMifflinStJeor,
} from './nutricion.util.js';

describe('nutricion.util', () => {
  it('calcula la edad considerando si ya cumplió años', () => {
    const nac = new Date('2000-11-15T00:00:00Z');
    expect(calcularEdad(nac, new Date('2026-11-14T00:00:00Z'))).toBe(25);
    expect(calcularEdad(nac, new Date('2026-11-15T00:00:00Z'))).toBe(26);
  });

  it('aplica Mifflin-St Jeor para hombre y mujer', () => {
    // 10·70 + 6.25·175 − 5·30 = 1643.75 → +5 (M) / −161 (F)
    expect(
      tmbMifflinStJeor({ pesoKg: 70, tallaCm: 175, edad: 30, sexo: 'M' }),
    ).toBeCloseTo(1648.75);
    expect(
      tmbMifflinStJeor({ pesoKg: 70, tallaCm: 175, edad: 30, sexo: 'F' }),
    ).toBeCloseTo(1482.75);
  });

  it('calcula el requerimiento con actividad y meta', () => {
    const r = calcularRequerimiento(
      {
        pesoKg: 70,
        tallaCm: 175,
        fechaNacimiento: new Date('1996-01-01T00:00:00Z'),
        sexo: 'M',
        nivelActividad: 'MODERADO',
        meta: 'BAJAR',
      },
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(r.edad).toBe(30);
    expect(r.gastoTotal).toBe(Math.round(1648.75 * 1.55));
    // 2555.56 − 500 = 2055.56 → redondeo a decenas
    expect(r.kcalObjetivo).toBe(2060);
    expect(r.proteinaG).toBe(128.8); // 2060 · 25 % / 4 kcal/g
  });

  it('no baja del piso calórico', () => {
    const r = calcularRequerimiento({
      pesoKg: 45,
      tallaCm: 150,
      fechaNacimiento: new Date('1950-01-01T00:00:00Z'),
      sexo: 'F',
      nivelActividad: 'SEDENTARIO',
      meta: 'BAJAR',
    });
    expect(r.kcalObjetivo).toBe(1200);
  });

  it('rechaza distribuciones de macros que no suman 100 %', () => {
    expect(() =>
      macrosDesdeKcal(2000, { proteina: 0.3, carbohidrato: 0.3, grasa: 0.3 }),
    ).not.toThrow();
    expect(() =>
      calcularRequerimiento({
        pesoKg: 70,
        tallaCm: 170,
        fechaNacimiento: new Date('1990-01-01'),
        sexo: 'M',
        nivelActividad: 'LIGERO',
        meta: 'MANTENER',
        distribucionMacros: { proteina: 0.3, carbohidrato: 0.3, grasa: 0.3 },
      }),
    ).toThrow(/100 %/);
  });

  it('suma nutrientes por porciones', () => {
    const t = sumarNutrientes([
      {
        porciones: 2,
        alimento: {
          kcal: 65,
          proteinaG: 1.7,
          carbohidratoG: 13.5,
          grasaG: 0.8,
        },
      },
      {
        porciones: 0.5,
        alimento: { kcal: 200, proteinaG: 10, carbohidratoG: 20, grasaG: 8 },
      },
    ]);
    expect(t).toEqual({
      kcal: 230,
      proteinaG: 8.4,
      carbohidratoG: 37,
      grasaG: 5.6,
    });
  });

  it('calcula IMC', () => {
    expect(imc(70, 175)).toBe(22.9);
  });
});
