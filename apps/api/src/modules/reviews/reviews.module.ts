import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { WordingService } from './wording.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, WordingService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
