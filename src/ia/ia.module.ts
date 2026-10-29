import { Module } from '@nestjs/common';
import { BedrockService } from './bedrock.service.js';
import { IaController } from './ia.controller.js';

@Module({
  controllers: [IaController],
  providers: [BedrockService],
  exports: [BedrockService],
})
export class IaModule {}
