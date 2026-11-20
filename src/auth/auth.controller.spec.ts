import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { EstadoNutricionista } from '../generated/prisma/enums.js';
import { AuthController } from './auth.controller.js';
import type { UsuarioActual } from './auth.types.js';

const dto = {
  nombre: 'Lic. Sofía Herrera',
  colegiado: '1402',
  fechaNacimiento: '1990-03-15',
};

const cuenta = (extra: Partial<UsuarioActual> = {}): UsuarioActual => ({
  uid: 'uid-1',
  email: 'sofia@correo.hn',
  emailVerificado: true,
  rol: 'sin_perfil',
  esAdmin: false,
  ...extra,
});

describe('AuthController.registrarNutricionista', () => {
  let prisma: PrismaMock;
  let controller: AuthController;

  beforeEach(() => {
    prisma = crearPrismaMock();
    controller = new AuthController(prisma);
    prisma.nutricionista.findUnique.mockResolvedValue(null);
    prisma.nutricionista.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'nutri-1',
        ...data,
      }),
    );
  });

  it('exige el correo verificado antes de crear el perfil', async () => {
    const u = cuenta({ emailVerificado: false });

    await expect(controller.registrarNutricionista(u, dto)).rejects.toThrow(
      new ForbiddenException('Verifica tu correo antes de registrar el perfil.'),
    );
    // Un rechazo no debe dejar rastro en la base.
    expect(prisma.nutricionista.create).not.toHaveBeenCalled();
  });

  it('crea el perfil con el uid y el correo del token, en estado PENDIENTE', async () => {
    const creado = await controller.registrarNutricionista(cuenta(), dto);

    expect(prisma.nutricionista.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'uid-1',
        correo: 'sofia@correo.hn',
        nombre: 'Lic. Sofía Herrera',
        colegiado: '1402',
        // La fecha del body se convierte a medianoche UTC para la columna DATE.
        fechaNacimiento: new Date('1990-03-15T00:00:00.000Z'),
        estado: EstadoNutricionista.PENDIENTE,
      },
    });
    expect(creado).toMatchObject({ correo: 'sofia@correo.hn' });
  });

  it('rechaza a quien no tiene 18 años cumplidos', async () => {
    const hace17 = new Date();
    hace17.setUTCFullYear(hace17.getUTCFullYear() - 17);

    await expect(
      controller.registrarNutricionista(cuenta(), {
        ...dto,
        fechaNacimiento: hace17.toISOString().slice(0, 10),
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Debes ser mayor de edad para registrar el perfil.',
      ),
    );
    expect(prisma.nutricionista.create).not.toHaveBeenCalled();
  });

  it('acepta a quien cumple 18 hoy', async () => {
    const hoy = new Date();
    const cumple18 = new Date(hoy);
    cumple18.setUTCFullYear(hoy.getUTCFullYear() - 18);

    await controller.registrarNutricionista(cuenta(), {
      ...dto,
      fechaNacimiento: cumple18.toISOString().slice(0, 10),
    });

    expect(prisma.nutricionista.create).toHaveBeenCalled();
  });

  it('rechaza una cuenta que ya tiene perfil', async () => {
    await expect(
      controller.registrarNutricionista(
        cuenta({ rol: 'nutricionista', nutricionistaId: 'nutri-1' }),
        dto,
      ),
    ).rejects.toThrow(
      new ConflictException('Esta cuenta ya tiene un perfil.'),
    );
    expect(prisma.nutricionista.create).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta de Firebase sin correo', async () => {
    await expect(
      controller.registrarNutricionista(cuenta({ email: undefined }), dto),
    ).rejects.toThrow(
      new BadRequestException('La cuenta de Firebase no tiene correo.'),
    );
    expect(prisma.nutricionista.create).not.toHaveBeenCalled();
  });

  it('rechaza un correo que ya pertenece a otra nutricionista', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({ id: 'otra' });

    await expect(
      controller.registrarNutricionista(cuenta(), dto),
    ).rejects.toThrow(
      new ConflictException('Ya existe una nutricionista con ese correo.'),
    );
    expect(prisma.nutricionista.create).not.toHaveBeenCalled();
  });
});

describe('AuthController.me', () => {
  let prisma: PrismaMock;
  let controller: AuthController;

  beforeEach(() => {
    prisma = crearPrismaMock();
    controller = new AuthController(prisma);
  });

  it('devuelve el perfil de una nutricionista pendiente en vez de null', async () => {
    const perfil = { id: 'nutri-1', estado: EstadoNutricionista.PENDIENTE };
    prisma.nutricionista.findUnique.mockResolvedValue(perfil);

    const respuesta = await controller.me(
      cuenta({
        rol: 'nutricionista_pendiente',
        nutricionistaId: 'nutri-1',
        estado: EstadoNutricionista.PENDIENTE,
      }),
    );

    expect(prisma.nutricionista.findUnique).toHaveBeenCalledWith({
      where: { id: 'nutri-1' },
    });
    expect(respuesta).toEqual({ rol: 'nutricionista_pendiente', perfil });
  });

  it('devuelve rol sin_perfil con perfil null y no consulta la base', async () => {
    const respuesta = await controller.me(cuenta());

    expect(respuesta).toEqual({ rol: 'sin_perfil', perfil: null });
    expect(prisma.nutricionista.findUnique).not.toHaveBeenCalled();
  });
});
