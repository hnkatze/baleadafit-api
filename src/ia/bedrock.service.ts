import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';

export class IaNoDisponibleError extends Error {}

/** Token para inyectar otro cliente Bedrock (pruebas o un endpoint equivalente). */
export const CLIENTE_BEDROCK = 'CLIENTE_BEDROCK';

/** Cliente mínimo que usa el servicio: basta `send` de la Converse API. */
export interface ClienteBedrock {
  send(comando: ConverseCommand): Promise<ConverseCommandOutput>;
}

/** Resultado de la última llamada real a Bedrock. */
export interface LlamadaIa {
  ok: boolean;
  error?: string;
  /** Momento de la llamada en ISO 8601. */
  en: string;
}

/** Lo que el portal muestra para saber si la IA está conectada. */
export interface EstadoIa {
  habilitado: boolean;
  modelo?: string;
  region: string;
  ultimaLlamada: LlamadaIa | null;
}

const REGION_POR_DEFECTO = 'us-east-1';
const SIN_CONFIGURAR = 'IA deshabilitada o BEDROCK_MODEL_ID sin configurar.';
/** Prompt mínimo para verificar la conexión desde el portal. */
const PROMPT_PRUEBA = 'Responde OK';

/** Cliente mínimo de AWS Bedrock (Converse API) que devuelve JSON. */
@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private cliente?: ClienteBedrock;
  private ultima?: LlamadaIa;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(CLIENTE_BEDROCK)
    cliente?: ClienteBedrock,
  ) {
    this.cliente = cliente;
  }

  get modelo(): string | undefined {
    return this.config.get<string>('BEDROCK_MODEL_ID');
  }

  get region(): string {
    return this.config.get<string>('AWS_REGION') ?? REGION_POR_DEFECTO;
  }

  get habilitado(): boolean {
    return this.config.get('IA_HABILITADA') !== 'false' && !!this.modelo;
  }

  /** Estado de la IA para el portal: si está conectada, con qué modelo y última llamada. */
  estado(): EstadoIa {
    return {
      habilitado: this.habilitado,
      modelo: this.modelo || undefined,
      region: this.region,
      ultimaLlamada: this.ultima ?? null,
    };
  }

  /**
   * Verifica la conexión con una llamada mínima ("Responde OK", 16 tokens).
   * Nunca lanza: devuelve el error para mostrarlo en el portal.
   */
  async probar(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.conversar(
        'Eres un verificador de conexión. Responde con una palabra.',
        PROMPT_PRUEBA,
        16,
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  private obtenerCliente(): ClienteBedrock {
    // Credenciales: cadena estándar de AWS (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, perfil o rol).
    // Los timeouts evitan que una llamada lenta cuelgue el request HTTP.
    this.cliente ??= new BedrockRuntimeClient({
      region: this.region,
      requestHandler: { connectionTimeout: 2000, requestTimeout: 20000 },
    });
    return this.cliente;
  }

  /** Envía un mensaje al modelo y registra el resultado en `ultimaLlamada`. */
  private async conversar(
    sistema: string,
    mensaje: string,
    maxTokens: number,
  ): Promise<string> {
    if (!this.habilitado) {
      this.registrar({ ok: false, error: SIN_CONFIGURAR });
      throw new IaNoDisponibleError(SIN_CONFIGURAR);
    }
    try {
      const res = await this.obtenerCliente().send(
        new ConverseCommand({
          modelId: this.modelo,
          system: [{ text: sistema }],
          messages: [{ role: 'user', content: [{ text: mensaje }] }],
          inferenceConfig: { maxTokens, temperature: 0.3 },
        }),
      );
      this.registrar({ ok: true });
      return (res.output?.message?.content ?? [])
        .map((c) => c.text ?? '')
        .join('');
    } catch (e) {
      const error = (e as Error).message;
      this.logger.warn(`Bedrock falló: ${error}`);
      this.registrar({ ok: false, error });
      throw new IaNoDisponibleError(error);
    }
  }

  private registrar(resultado: Omit<LlamadaIa, 'en'>): void {
    this.ultima = { ...resultado, en: new Date().toISOString() };
  }

  async generarJson<T>(
    sistema: string,
    mensaje: string,
    maxTokens = 3000,
  ): Promise<T> {
    const texto = await this.conversar(sistema, mensaje, maxTokens);
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
