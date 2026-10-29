import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configurarSwagger } from './../src/common/swagger.js';

// No requiere base de datos: verifica arranque, salud, Swagger y protección de rutas.
describe('BaleadaFit API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/baleadafit';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    configurarSwagger(app);
    await app.init();
  });

  it('GET / responde estado ok sin token', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ servicio: 'baleadafit-api', estado: 'ok' });
  });

  it('publica la especificación OpenAPI en /docs-json', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(res.body.info.title).toBe('BaleadaFit API');
    expect(res.body.paths['/pacientes/{id}/planes/generar']).toBeDefined();
  });

  it.each(['/pacientes', '/dashboard', '/me/hoy', '/auth/me', '/alimentos'])(
    'rechaza %s sin token',
    (ruta) => request(app.getHttpServer()).get(ruta).expect(401),
  );

  it('rechaza tokens que no son Bearer', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Basic abc')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
