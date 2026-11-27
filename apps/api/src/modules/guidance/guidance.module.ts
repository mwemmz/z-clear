import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuidanceController } from './guidance.controller';
import { GuidanceService } from './guidance.service';

@Module({
  imports: [AuthModule],
  controllers: [GuidanceController],
  providers: [GuidanceService],
})
export class GuidanceModule {}
