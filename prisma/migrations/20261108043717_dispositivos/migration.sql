-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "dispositivo" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "uid" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_token_key" ON "dispositivo"("token");

-- CreateIndex
CREATE INDEX "dispositivo_uid_idx" ON "dispositivo"("uid");
