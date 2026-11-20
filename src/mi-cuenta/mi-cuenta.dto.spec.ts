import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ActualizarPerfilDto } from './mi-cuenta.dto.js';

// Las mismas opciones que `configurarApp()`: `forbidNonWhitelisted` es lo que
// rechaza un campo que el DTO no declara (`correo`, `estado`, `firebaseUid`).
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const cuerpo = (valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype: ActualizarPerfilDto });

/** El pipe responde 400 antes de que el handler llegue al servicio: nada se escribe. */
const error = async (valor: unknown) => {
  const rechazo = await cuerpo(valor).catch((e: unknown) => e);
  expect(rechazo).toBeInstanceOf(BadRequestException);
  return rechazo as BadRequestException;
};

describe('PATCH /me/perfil: cuerpo válido', () => {
  it('acepta nombre, teléfono y colegiado juntos', async () => {
    const dto = await cuerpo({
      nombre: 'Lic. Sofía Herrera',
      telefono: '+504 9999-0000',
      colegiado: '1402',
    });
    expect(dto).toBeInstanceOf(ActualizarPerfilDto);
    expect(dto).toMatchObject({
      nombre: 'Lic. Sofía Herrera',
      telefono: '+504 9999-0000',
      colegiado: '1402',
    });
  });

  it('acepta null para limpiar teléfono y colegiado', async () => {
    const dto = await cuerpo({ telefono: null, colegiado: null });
    expect(dto).toMatchObject({ telefono: null, colegiado: null });
  });

  it('omitir conserva: solo se valida lo que viene en el cuerpo', async () => {
    const dto = await cuerpo({ telefono: '+504 9999-0000' });
    expect(dto.telefono).toBe('+504 9999-0000');
    expect(dto.nombre).toBeUndefined();
    expect(dto.colegiado).toBeUndefined();
  });

  it('recorta los espacios sobrantes de teléfono y colegiado', async () => {
    const dto = await cuerpo({
      telefono: '  +504 9999-0000  ',
      colegiado: '  1402  ',
    });
    expect(dto.telefono).toBe('+504 9999-0000');
    expect(dto.colegiado).toBe('1402');
  });

  it('el nombre admite 3 y 120 caracteres', async () => {
    const corto = await cuerpo({ nombre: 'abc' });
    expect(corto.nombre).toBe('abc');
    const largo = await cuerpo({ nombre: 'a'.repeat(120) });
    expect(largo.nombre).toHaveLength(120);
  });
});

describe('PATCH /me/perfil: limpieza de opcionales', () => {
  it('rechaza el texto vacío: para limpiar hay que mandar null', async () => {
    await error({ telefono: '' });
    await error({ colegiado: '' });
    await error({ telefono: '   ' });
  });

  it('el nombre no se puede limpiar con null', async () => {
    const rechazo = await error({ nombre: null });
    expect(JSON.stringify(rechazo.getResponse())).toContain('nombre');
  });

  it('el nombre no se puede limpiar con texto vacío', async () => {
    await error({ nombre: '' });
  });

  it('el nombre respeta los límites del alta', async () => {
    await error({ nombre: 'ab' });
    await error({ nombre: 'a'.repeat(121) });
  });
});

describe('PATCH /me/perfil: campos no editables', () => {
  it('rechaza correo, estado y firebaseUid en lugar de ignorarlos', async () => {
    for (const campo of ['correo', 'estado', 'firebaseUid']) {
      const rechazo = await error({ [campo]: 'x' });
      expect(JSON.stringify(rechazo.getResponse())).toContain(
        `property ${campo} should not exist`,
      );
    }
  });

  it('tampoco acepta un id: el perfil sale del token', async () => {
    await error({ nombre: 'Lic. Sofía Herrera', id: 'n-ajeno' });
  });
});
