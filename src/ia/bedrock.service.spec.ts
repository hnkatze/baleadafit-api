import type { ConfigService } from '@nestjs/config';
import {
  BedrockService,
  extraerJson,
  IaNoDisponibleError,
} from './bedrock.service.js';

const config = (valores: Record<string, string>) =>
  ({ get: (k: string) => valores[k] }) as unknown as ConfigService;

describe('extraerJson', () => {
  it('lee JSON envuelto en bloque de código', () => {
    const texto = 'Aquí está:\n```json\n{"resumen":"ok","tiempos":[]}\n```';
    expect(extraerJson(texto)).toEqual({ resumen: 'ok', tiempos: [] });
  });

  it('falla de forma controlada si no hay JSON', () => {
    expect(() => extraerJson('sin datos')).toThrow(IaNoDisponibleError);
  });

  it('falla de forma controlada con JSON inválido', () => {
    expect(() => extraerJson('{"a": }')).toThrow(IaNoDisponibleError);
  });
});

describe('BedrockService', () => {
  it('está deshabilitado sin BEDROCK_MODEL_ID', async () => {
    const svc = new BedrockService(config({}));
    expect(svc.habilitado).toBe(false);
    await expect(svc.generarJson('s', 'm')).rejects.toBeInstanceOf(
      IaNoDisponibleError,
    );
  });

  it('se puede apagar con IA_HABILITADA=false', () => {
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo', IA_HABILITADA: 'false' }),
    );
    expect(svc.habilitado).toBe(false);
  });

  it('está habilitado con un modelo configurado', () => {
    const svc = new BedrockService(config({ BEDROCK_MODEL_ID: 'modelo' }));
    expect(svc.habilitado).toBe(true);
    expect(svc.modelo).toBe('modelo');
  });
});
