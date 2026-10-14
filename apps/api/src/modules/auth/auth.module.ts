import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({ secret: env.AUTH_JWT_SECRET }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, TotpService],
  exports: [AuthService, PasswordService, TokenService, TotpService],
})
export class AuthModule {}
