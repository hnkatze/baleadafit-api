import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Vacío permite `prisma generate` sin .env (p. ej. en `npm install`); migrate y seed sí la necesitan.
    url: process.env.DATABASE_URL ?? '',
  },
});
