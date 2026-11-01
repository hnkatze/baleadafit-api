import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { AuthController } from './auth.controller.js';
import type { UsuarioActual } from './auth.types.js';

const dto = { nombre: 'Lic. Sofía Herrera', colegiado: '1402' };

const cuenta = (extra: Partial<UsuarioActual> = {}): UsuarioActual => ({
  uid: 'uid-1',
  email: 'sofia@correo.hn',
  emailVerificado: true,
  rol: 'sin_perfil',
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

  it('crea el perfil con el uid y el correo del token', async () => {
    const creado = await controller.registrarNutricionista(cuenta(), dto);

    expect(prisma.nutricionista.create).toHaveBeenCalledWith({
      data: { firebaseUid: 'uid-1', correo: 'sofia@correo.hn', ...dto },
    });
    expect(creado).toMatchObject({ correo: 'sofia@correo.hn' });
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
