import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// No requiere base de datos: solo verifica arranque, salud y protección de rutas.
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
    await app.init();
  });

  it('GET / responde estado ok sin token', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ servicio: 'baleadafit-api', estado: 'ok' });
  });

  it('rechaza rutas protegidas sin token', () => {
    return request(app.getHttpServer()).get('/pacientes').expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
