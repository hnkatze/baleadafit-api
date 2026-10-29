import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { TokenVerificado } from './auth.types.js';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;

  constructor(private readonly config: ConfigService) {}

  private obtenerApp(): App {
    if (this.app) return this.app;
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new UnauthorizedException(
        'Firebase no está configurado en el servidor.',
      );
    }
    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    return this.app;
  }

  /**
   * Verifica un ID token de Firebase.
   * En desarrollo, con AUTH_DEV_BYPASS=true, acepta tokens "dev:<uid>:<correo>" para probar sin Firebase.
   */
  async verificarToken(token: string): Promise<TokenVerificado> {
    if (this.bypassActivo() && token.startsWith('dev:')) {
      const [, uid, email] = token.split(':');
      if (!uid)
        throw new UnauthorizedException('Token de desarrollo inválido.');
      return { uid, email: email || undefined, emailVerificado: true };
    }
    try {
      const decoded = await getAuth(this.obtenerApp()).verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase(),
        emailVerificado: decoded.email_verified === true,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.debug(`Token rechazado: ${(err as Error).message}`);
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private bypassActivo(): boolean {
    return (
      this.config.get('AUTH_DEV_BYPASS') === 'true' &&
      this.config.get('NODE_ENV') !== 'production'
    );
  }
}
