import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PaginacionDto } from '../common/paginacion.js';
import {
  ActualizarPacienteDto,
  CrearPacienteDto,
  RegistrosDiarioQueryDto,
} from './pacientes.dto.js';

// Las mismas opciones que `configurarApp()`: `forbidNonWhitelisted` es lo que
// rechaza un query param que el DTO no declara.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('query del diario de comidas', () => {
  it('acepta desde y hasta junto con la paginación', async () => {
    const q = await pipe.transform(
      { desde: '2026-10-20', hasta: '2026-10-27', limit: '5' },
      { type: 'query', metatype: RegistrosDiarioQueryDto },
    );
    expect(q).toBeInstanceOf(RegistrosDiarioQueryDto);
    expect(q).toMatchObject({ desde: '2026-10-20', hasta: '2026-10-27' });
    expect(q.limit).toBe(5);
  });

  it('PaginacionDto sola los rechaza, y esa es la razón del DTO propio', async () => {
    const error = await pipe
      .transform(
        { desde: '2026-10-20' },
        { type: 'query', metatype: PaginacionDto },
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).toContain(
      'property desde should not exist',
    );
  });
});

describe('alta y baja lógica del paciente', () => {
  const cuerpo = (valor: unknown) =>
    pipe.transform(valor, { type: 'body', metatype: ActualizarPacienteDto });

  it('reactivar por PATCH: `activo: true` es un cambio válido', async () => {
    const dto = await cuerpo({ activo: true });
    expect(dto).toBeInstanceOf(ActualizarPacienteDto);
    expect(dto.activo).toBe(true);
  });

  it('`activo` sigue siendo opcional: el PATCH de siempre no lo necesita', async () => {
    const dto = await cuerpo({ nombre: 'Ana' });
    expect(dto.activo).toBeUndefined();
    expect(dto.nombre).toBe('Ana');
  });

  it('el alta no cambia: POST rechaza `activo`', async () => {
    const error = await pipe
      .transform(
        {
          nombre: 'Ana',
          apellido: 'López',
          sexo: 'F',
          fechaNacimiento: '1995-04-10',
          activo: true,
        },
        { type: 'body', metatype: CrearPacienteDto },
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(
      JSON.stringify((error as BadRequestException).getResponse()),
    ).toContain('property activo should not exist');
  });
});
