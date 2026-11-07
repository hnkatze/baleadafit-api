import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/common/configurar-app.js';

// No requiere base de datos: verifica arranque, salud, Swagger y protección de rutas.
describe('BaleadaFit API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/baleadafit';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // La misma configuración que `main.ts`: pipes, sobre, filtro y Swagger.
    configurarApp(app);
    await app.init();
  });

  it('GET / responde estado ok sin token', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ ok: true, data: { servicio: 'baleadafit-api', estado: 'ok' } });
  });

  it('publica la especificación OpenAPI en /docs-json', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(res.body.info.title).toBe('BaleadaFit API');
    expect(res.body.paths['/pacientes/{id}/planes/generar']).toBeDefined();
    // La nutricionista escribe el diario del paciente (antes solo el paciente podía).
    expect(res.body.paths['/pacientes/{id}/registros'].put).toBeDefined();
    expect(res.body.paths['/pacientes/{id}/registros'].get).toBeDefined();
  });

  it.each(['/pacientes', '/dashboard', '/me/hoy', '/auth/me', '/alimentos'])(
    'rechaza %s sin token',
    (ruta) =>
      request(app.getHttpServer())
        .get(ruta)
        .expect(401)
        .expect(({ body }: { body: Record<string, unknown> }) => {
          expect(body).toMatchObject({
            ok: false,
            error: { codigo: 'NO_AUTENTICADO' },
          });
          expect(typeof (body.error as { mensaje?: unknown }).mensaje).toBe(
            'string',
          );
        }),
  );

  it('rechaza tokens que no son Bearer', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Basic abc')
      .expect(401)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({
          ok: false,
          error: { codigo: 'NO_AUTENTICADO' },
        });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
