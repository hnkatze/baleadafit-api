import type { ConfigService } from '@nestjs/config';
import type { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockService,
  extraerJson,
  IaNoDisponibleError,
  type ClienteBedrock,
} from './bedrock.service.js';

const config = (valores: Record<string, string>) =>
  ({ get: (k: string) => valores[k] }) as unknown as ConfigService;

/** Cliente falso: evita tocar AWS en las pruebas. */
const clienteFalso = (send: (...args: unknown[]) => Promise<unknown>) =>
  ({ send }) as unknown as ClienteBedrock;

const respuestaOk = {
  output: { message: { content: [{ text: 'OK' }] } },
};

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

  it('estado() refleja modelo, región y que aún no hay llamadas', () => {
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo', AWS_REGION: 'us-west-2' }),
    );
    expect(svc.estado()).toEqual({
      habilitado: true,
      modelo: 'modelo',
      region: 'us-west-2',
      ultimaLlamada: null,
    });
  });

  it('estado() usa us-east-1 y sin modelo cuando no hay configuración', () => {
    const svc = new BedrockService(config({}));
    expect(svc.estado()).toEqual({
      habilitado: false,
      modelo: undefined,
      region: 'us-east-1',
      ultimaLlamada: null,
    });
  });

  it('probar() hace una llamada mínima y responde ok', async () => {
    const send = vi.fn(async () => respuestaOk);
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo' }),
      clienteFalso(send),
    );

    await expect(svc.probar()).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);

    const comando = send.mock.calls[0][0] as ConverseCommand;
    expect(comando.input.modelId).toBe('modelo');
    expect(comando.input.inferenceConfig?.maxTokens).toBe(16);
    expect(comando.input.messages).toEqual([
      { role: 'user', content: [{ text: 'Responde OK' }] },
    ]);
    expect(svc.estado().ultimaLlamada).toMatchObject({ ok: true });
  });

  it('probar() no lanza cuando Bedrock falla y lo registra', async () => {
    const send = vi.fn(async () => {
      throw new Error('credenciales inválidas');
    });
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo' }),
      clienteFalso(send),
    );

    await expect(svc.probar()).resolves.toEqual({
      ok: false,
      error: 'credenciales inválidas',
    });
    const ultima = svc.estado().ultimaLlamada;
    expect(ultima).toMatchObject({
      ok: false,
      error: 'credenciales inválidas',
    });
    expect(typeof ultima?.en).toBe('string');
  });

  it('probar() no lanza cuando la IA está deshabilitada', async () => {
    const svc = new BedrockService(config({}));
    await expect(svc.probar()).resolves.toEqual({
      ok: false,
      error: 'IA deshabilitada o BEDROCK_MODEL_ID sin configurar.',
    });
  });

  it('generarJson sigue extrayendo el JSON de la respuesta', async () => {
    const send = vi.fn(async () => ({
      output: { message: { content: [{ text: '{"resumen":"ok"}' }] } },
    }));
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo' }),
      clienteFalso(send),
    );

    await expect(svc.generarJson('s', 'm')).resolves.toEqual({
      resumen: 'ok',
    });
    expect(svc.estado().ultimaLlamada).toMatchObject({ ok: true });
  });

  it('generarJson sigue lanzando IaNoDisponibleError si la llamada falla', async () => {
    const send = vi.fn(async () => {
      throw new Error('sin red');
    });
    const svc = new BedrockService(
      config({ BEDROCK_MODEL_ID: 'modelo' }),
      clienteFalso(send),
    );

    await expect(svc.generarJson('s', 'm')).rejects.toBeInstanceOf(
      IaNoDisponibleError,
    );
    expect(svc.estado().ultimaLlamada).toMatchObject({
      ok: false,
      error: 'sin red',
    });
  });
});
