import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service.js';

const config = (valores: Record<string, string>) =>
  ({ get: (k: string) => valores[k] }) as unknown as ConfigService;

describe('FirebaseService', () => {
  it('acepta tokens de desarrollo con AUTH_DEV_BYPASS fuera de producción', async () => {
    const svc = new FirebaseService(
      config({ AUTH_DEV_BYPASS: 'true', NODE_ENV: 'development' }),
    );
    await expect(
      svc.verificarToken('dev:uid-9:ana@correo.hn'),
    ).resolves.toEqual({
      uid: 'uid-9',
      email: 'ana@correo.hn',
      emailVerificado: true,
    });
  });

  it('rechaza un token de desarrollo sin uid', async () => {
    const svc = new FirebaseService(config({ AUTH_DEV_BYPASS: 'true' }));
    await expect(svc.verificarToken('dev:')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ignora el bypass en producción', async () => {
    const svc = new FirebaseService(
      config({ AUTH_DEV_BYPASS: 'true', NODE_ENV: 'production' }),
    );
    await expect(svc.verificarToken('dev:uid:correo')).rejects.toThrow(
      /Firebase no está configurado/,
    );
  });

  it('responde 401 si Firebase no está configurado', async () => {
    const svc = new FirebaseService(config({}));
    await expect(svc.verificarToken('token-real')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
