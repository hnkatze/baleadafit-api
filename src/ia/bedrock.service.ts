import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ConverseCommandOutput,
  type ConverseStreamCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';

export class IaNoDisponibleError extends Error {}

/**
 * Un bloque del mensaje del usuario. `cachear` inserta un punto de caché después
 * del bloque, así Bedrock guarda ese prefijo (el catálogo) y las llamadas
 * siguientes lo leen a una décima parte del precio.
 */
export interface BloquePrompt {
  texto: string;
  cachear?: boolean;
}

function contenidoDe(bloques: BloquePrompt[]) {
  const contenido: ({ text: string } | { cachePoint: { type: 'default' } })[] =
    [];
  for (const bloque of bloques) {
    contenido.push({ text: bloque.texto });
    if (bloque.cachear) contenido.push({ cachePoint: { type: 'default' } });
  }
  return contenido;
}

/** Token para inyectar otro cliente Bedrock (pruebas o un endpoint equivalente). */
export const CLIENTE_BEDROCK = 'CLIENTE_BEDROCK';

/** Cliente mínimo que usa el servicio: basta `send` de la Converse API. */
/**
 * Cliente mínimo que usamos de Bedrock. Acepta los dos comandos y devuelve una
 * unión: el SDK genérico ya pierde el tipo del comando en `send`, así que cada
 * llamador castea al resultado que pidió.
 */
export interface ClienteBedrock {
  send(
    comando: ConverseCommand | ConverseStreamCommand,
  ): Promise<ConverseCommandOutput | ConverseStreamCommandOutput>;
}

/** Resultado de la última llamada real a Bedrock. */
export interface LlamadaIa {
  ok: boolean;
  error?: string;
  /** Momento de la llamada en ISO 8601. */
  en: string;
  /**
   * Tokens que consumió la llamada. Sin esto no se puede decidir nada sobre
   * latencia o costo: la salida es lo que domina el tiempo, y con dos números
   * alcanza para saber si conviene partir la generación en varias llamadas.
   */
  entradaTokens?: number;
  salidaTokens?: number;
  /** Duración total de la llamada en milisegundos. */
  ms?: number;
  /** Milisegundos hasta el primer token: lo que percibe quien espera. */
  ttftMs?: number;
  /**
   * Tokens leídos de la caché de prompt y tokens escritos en ella. Si la lectura
   * es alta, el bloque cacheable (el catálogo) se está reusando y esa entrada
   * cuesta una décima parte.
   */
  cacheLecturaTokens?: number;
  cacheEscrituraTokens?: number;
  /**
   * `stream` cuando la respuesta se leyó por `ConverseStream` (sin riesgo de
   * timeout por socket inactivo) y `json` cuando se esperó la respuesta entera.
   */
  transporte?: 'stream' | 'json';
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
/**
 * El modelo cortó la respuesta por el tope de tokens. Se distingue del JSON
 * inválido a propósito: con una semana de 35 slots, "no devolvió JSON" es la
 * consecuencia y no la causa, y confundirlas manda a buscar el problema en el
 * prompt cuando el problema es el presupuesto de salida.
 */
const SIN_TOKENS =
  'La IA se quedó sin tokens antes de terminar la respuesta.';
/**
 * Mensaje apto para el portal. El detalle de AWS puede traer el ARN, el número
 * de cuenta y el usuario IAM, así que solo va al log del servidor.
 */
const ERROR_CONEXION =
  'No se pudo conectar con Bedrock. Revisa las credenciales, la región y el acceso al modelo en la consola de AWS.';
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
      // Sin reintentos: cada intento puede tardar el requestTimeout completo y el
      // portal necesita un límite predecible. El requestTimeout mide el socket
      // inactivo, así que gobierna solo las llamadas sin stream (el ping del
      // portal). La generación de planes va por `ConverseStream`, donde el socket
      // nunca queda inactivo y una semana de ~63 s ya no choca con el límite.
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 2000, requestTimeout: 180000 },
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
    const inicio = Date.now();
    try {
      const res = (await this.obtenerCliente().send(
        new ConverseCommand({
          modelId: this.modelo,
          system: [{ text: sistema }],
          messages: [{ role: 'user', content: [{ text: mensaje }] }],
          inferenceConfig: { maxTokens, temperature: 0.3 },
        }),
      )) as ConverseCommandOutput;
      const ms = Date.now() - inicio;
      const entradaTokens = res.usage?.inputTokens;
      const salidaTokens = res.usage?.outputTokens;
      const texto = (res.output?.message?.content ?? [])
        .map((c) => c.text ?? '')
        .join('');
      if (res.stopReason === 'max_tokens') {
        // El texto llegó cortado: parsearlo como JSON siempre falla, así que se
        // informa la causa real y se registra la llamada como fallida.
        this.logger.warn(
          `Bedrock cortó la respuesta por tokens (${texto.length} caracteres).`,
        );
        this.ultima = {
          ok: false,
          error: SIN_TOKENS,
          en: new Date().toISOString(),
          entradaTokens,
          salidaTokens,
          ms,
        };
        throw new IaNoDisponibleError(SIN_TOKENS);
      }
      this.logger.log(
        `Bedrock ok en ${ms} ms · entrada ${entradaTokens ?? '?'} · salida ${salidaTokens ?? '?'} tokens`,
      );
      this.registrar({
        ok: true,
        entradaTokens,
        salidaTokens,
        ms,
        transporte: 'json',
      });
      return texto;
    } catch (e) {
      // Lo que ya viene clasificado (por ejemplo el corte por tokens) se
      // propaga tal cual: envolverlo en "no se pudo conectar" miente sobre la causa.
      if (e instanceof IaNoDisponibleError) throw e;
      // El detalle (ARN, cuenta, usuario IAM) queda en el log y no sale por la API.
      this.logger.warn(`Bedrock falló: ${(e as Error).message}`);
      this.registrar({ ok: false, error: ERROR_CONEXION });
      throw new IaNoDisponibleError(ERROR_CONEXION);
    }
  }

  private registrar(resultado: Omit<LlamadaIa, 'en'>): void {
    this.ultima = { ...resultado, en: new Date().toISOString() };
  }


  /**
   * Igual que `conversar`, pero leyendo el stream de Bedrock.
   *
   * Con `ConverseStream` el socket tiene actividad permanente, así que el
   * `requestTimeout` deja de ser el techo de una generación larga: una semana
   * completa tarda ~63 s y antes eso chocaba contra el límite del cliente.
   * Además mide el primer token, que es lo que percibe quien espera.
   */
  private async conversarPorStream(
    sistema: string,
    bloques: BloquePrompt[],
    maxTokens: number,
  ): Promise<string> {
    if (!this.habilitado) {
      this.registrar({ ok: false, error: SIN_CONFIGURAR });
      throw new IaNoDisponibleError(SIN_CONFIGURAR);
    }
    const inicio = Date.now();
    let primerToken: number | undefined;
    let entradaTokens: number | undefined;
    let salidaTokens: number | undefined;
    let cacheLecturaTokens: number | undefined;
    let cacheEscrituraTokens: number | undefined;
    let corte: string | undefined;

    try {
      const res = (await this.obtenerCliente().send(
        new ConverseStreamCommand({
          modelId: this.modelo,
          system: [{ text: sistema }],
          messages: [{ role: 'user', content: contenidoDe(bloques) }],
          inferenceConfig: { maxTokens, temperature: 0.3 },
        }),
      )) as ConverseStreamCommandOutput;

      let texto = '';
      for await (const evento of res.stream ?? []) {
        const delta = evento.contentBlockDelta?.delta?.text;
        if (delta) {
          primerToken ??= Date.now() - inicio;
          texto += delta;
        }
        // El uso llega en el evento `metadata`, antes del cierre del mensaje.
        if (evento.metadata?.usage) {
          const uso = evento.metadata.usage;
          entradaTokens = uso.inputTokens ?? entradaTokens;
          salidaTokens = uso.outputTokens ?? salidaTokens;
          cacheLecturaTokens =
            uso.cacheReadInputTokens ?? cacheLecturaTokens;
          cacheEscrituraTokens =
            uso.cacheWriteInputTokens ?? cacheEscrituraTokens;
        }
        if (evento.messageStop?.stopReason === 'max_tokens')
          corte = SIN_TOKENS;
      }

      const ms = Date.now() - inicio;
      if (corte) {
        this.logger.warn(
          `Bedrock cortó el stream por tokens (${texto.length} caracteres).`,
        );
        this.ultima = {
          ok: false,
          error: corte,
          en: new Date().toISOString(),
          entradaTokens,
          salidaTokens,
          cacheLecturaTokens,
          cacheEscrituraTokens,
          ms,
          ttftMs: primerToken,
          transporte: 'stream',
        };
        throw new IaNoDisponibleError(corte);
      }

      this.logger.log(
        `Bedrock stream ok en ${ms} ms · primer token ${primerToken ?? '?'} ms · entrada ${entradaTokens ?? '?'} · salida ${salidaTokens ?? '?'} · caché leída ${cacheLecturaTokens ?? 0} / escrita ${cacheEscrituraTokens ?? 0} tokens`,
      );
      this.registrar({
        ok: true,
        entradaTokens,
        salidaTokens,
        cacheLecturaTokens,
        cacheEscrituraTokens,
        ms,
        ttftMs: primerToken,
        transporte: 'stream',
      });
      return texto;
    } catch (e) {
      if (e instanceof IaNoDisponibleError) throw e;
      this.logger.warn(`Bedrock falló: ${(e as Error).message}`);
      this.registrar({ ok: false, error: ERROR_CONEXION, transporte: 'stream' });
      throw new IaNoDisponibleError(ERROR_CONEXION);
    }
  }

  /**
   * Respuesta por stream validada como JSON. Es la que usa la generación de
   * planes; `generarJson` queda para las llamadas cortas (el ping del portal).
   */
  async generarJsonStream<T>(
    sistema: string,
    bloques: BloquePrompt[] | string,
    maxTokens = 3000,
  ): Promise<T> {
    const texto = await this.conversarPorStream(
      sistema,
      typeof bloques === 'string' ? [{ texto: bloques }] : bloques,
      maxTokens,
    );
    return extraerJson<T>(texto);
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
