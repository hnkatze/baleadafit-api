import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegistroNutricionistaDto } from './auth.dto.js';

/**
 * El pipe global valida contra el DTO. Lo que se prueba acá es el contrato de la
 * fecha: la columna es DATE y la regla de edad compara años, así que un formato
 * ISO que `aFecha` no puede interpretar tiene que rechazarse en el borde y no
 * llegar al controller con `NaN` en la edad.
 */
const errores = async (fechaNacimiento: unknown) =>
  validate(
    plainToInstance(RegistroNutricionistaDto, {
      nombre: 'Lic. Sofía Herrera',
      fechaNacimiento,
    }),
    { whitelist: true, forbidNonWhitelisted: true },
  );

describe('RegistroNutricionistaDto', () => {
  it('acepta una fecha YYYY-MM-DD', async () => {
    expect(await errores('1990-03-15')).toHaveLength(0);
  });

  it.each(['20150601', '2015-W10', '2015-123', '15/03/1990', '1990-3-15'])(
    'rechaza el formato %s',
    async (fecha) => {
      expect((await errores(fecha)).length).toBeGreaterThan(0);
    },
  );

  it('exige fechaNacimiento', async () => {
    expect((await errores(undefined)).length).toBeGreaterThan(0);
  });
});
