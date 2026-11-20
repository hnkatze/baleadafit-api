import { aFecha, edadEnAnios, hoyIso, sumarDias } from './fechas.js';

/**
 * Convención del proyecto: las fechas de calendario se guardan como medianoche
 * UTC del día que envía el cliente, sin convertirlas a la zona del servidor.
 */
describe('fechas', () => {
  describe('aFecha', () => {
    it('guarda el día enviado a medianoche UTC', () => {
      expect(aFecha('2026-12-01')).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });

    it('no corre el día cuando el ISO trae una zona horaria negativa', () => {
      // 1 de diciembre, 8 de la noche en Honduras (GMT-6) es 2 de diciembre en
      // UTC, pero la fecha de calendario que eligió la nutricionista es el 1.
      expect(aFecha('2026-12-01T20:00:00-06:00')).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });

    it('tampoco corre el día cerca de la medianoche local', () => {
      expect(aFecha('2026-12-01T23:59:00-06:00')).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });

    it('acepta un ISO completo en UTC', () => {
      expect(aFecha('2026-12-01T00:00:00.000Z')).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });
  });

  describe('hoyIso', () => {
    it('devuelve el día UTC en formato YYYY-MM-DD', () => {
      const hoy = hoyIso();
      expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(hoy).toBe(new Date().toISOString().slice(0, 10));
    });
  });

  describe('edadEnAnios', () => {
    it('cuenta los años cumplidos', () => {
      expect(
        edadEnAnios(
          new Date('1990-03-15T00:00:00.000Z'),
          new Date('2026-03-16T00:00:00.000Z'),
        ),
      ).toBe(36);
    });

    it('no cuenta el año el día antes del cumpleaños', () => {
      expect(
        edadEnAnios(
          new Date('1990-03-15T00:00:00.000Z'),
          new Date('2026-03-14T00:00:00.000Z'),
        ),
      ).toBe(35);
    });

    it('cuenta el año el mismo día del cumpleaños', () => {
      expect(
        edadEnAnios(
          new Date('2008-03-15T00:00:00.000Z'),
          new Date('2026-03-15T00:00:00.000Z'),
        ),
      ).toBe(18);
    });

    it('devuelve negativo para una fecha de nacimiento futura', () => {
      expect(
        edadEnAnios(
          new Date('2030-01-01T00:00:00.000Z'),
          new Date('2026-03-15T00:00:00.000Z'),
        ),
      ).toBeLessThan(0);
    });
  });

  describe('sumarDias', () => {
    it('suma días en UTC, sin perderse por el cambio de horario', () => {
      // Del 7 al 9 de marzo de 2026 hay un cambio de horario en Estados Unidos;
      // con aritmética UTC no se pierde ni se gana una hora.
      expect(sumarDias(new Date('2026-03-07T00:00:00.000Z'), 2)).toEqual(
        new Date('2026-03-09T00:00:00.000Z'),
      );
    });

    it('cruza fin de mes', () => {
      expect(sumarDias(new Date('2026-01-31T00:00:00.000Z'), 1)).toEqual(
        new Date('2026-02-01T00:00:00.000Z'),
      );
    });

    it('acepta días negativos', () => {
      expect(sumarDias(new Date('2026-03-01T00:00:00.000Z'), -1)).toEqual(
        new Date('2026-02-28T00:00:00.000Z'),
      );
    });
  });
});
