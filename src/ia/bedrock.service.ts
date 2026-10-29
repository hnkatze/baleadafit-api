import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

export class IaNoDisponibleError extends Error {}

/** Cliente mínimo de AWS Bedrock (Converse API) que devuelve JSON. */
@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private cliente?: BedrockRuntimeClient;

  constructor(private readonly config: ConfigService) {}

  get modelo(): string | undefined {
    return this.config.get<string>('BEDROCK_MODEL_ID');
  }

  get habilitado(): boolean {
    return this.config.get('IA_HABILITADA') !== 'false' && !!this.modelo;
  }

  private obtenerCliente(): BedrockRuntimeClient {
    // Credenciales: cadena estándar de AWS (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, perfil o rol).
    this.cliente ??= new BedrockRuntimeClient({
      region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
    });
    return this.cliente;
  }

  async generarJson<T>(
    sistema: string,
    mensaje: string,
    maxTokens = 3000,
  ): Promise<T> {
    if (!this.habilitado)
      throw new IaNoDisponibleError(
        'IA deshabilitada o BEDROCK_MODEL_ID sin configurar.',
      );
    let texto: string;
    try {
      const res = await this.obtenerCliente().send(
        new ConverseCommand({
          modelId: this.modelo,
          system: [{ text: sistema }],
          messages: [{ role: 'user', content: [{ text: mensaje }] }],
          inferenceConfig: { maxTokens, temperature: 0.3 },
        }),
      );
      texto = (res.output?.message?.content ?? [])
        .map((c) => c.text ?? '')
        .join('');
    } catch (e) {
      this.logger.warn(`Bedrock falló: ${(e as Error).message}`);
      throw new IaNoDisponibleError((e as Error).message);
    }
    return extraerJson<T>(texto);
  }
}

/** Toma el primer objeto JSON del texto (tolera ```json … ``` alrededor). */
export function extraerJson<T>(texto: string): T {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio)
    throw new IaNoDisponibleError('La IA no devolvió JSON.');
  try {
    return JSON.parse(texto.slice(inicio, fin + 1)) as T;
  } catch {
    throw new IaNoDisponibleError('La IA devolvió JSON inválido.');
  }
}
