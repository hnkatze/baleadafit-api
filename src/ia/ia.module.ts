import { Module } from '@nestjs/common';
import { BedrockService } from './bedrock.service.js';

@Module({
  providers: [BedrockService],
  exports: [BedrockService],
})
export class IaModule {}
