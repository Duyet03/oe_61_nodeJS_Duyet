import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { CommonModule, RpcErrorInterceptor, JwtAuthGuard } from '@app/common';
import { AuthController } from './auth.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { UserAuthController } from './user-auth.controller';
import { APP_PIPE } from '@nestjs/core';
import { I18nValidationPipe } from '@app/common/pipes/i18n-validation.pipe';
import googleOauthConfig from 'libs/config/google-oauth.config';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthModule } from 'apps/auth/src/auth.module';
import { RoomController } from './room.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminRoomController } from './admin-room.controller';
import { BookingController } from './booking.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: './.env' }),
    CommonModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '30d'),
        },
      }),
    }),
    CommonModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3001,
        },
      },
      {
        name: 'ROOM_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3002,
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3004,
        },
      },
      {
        name: 'UPLOAD_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3003,
        },
      },
      {
        name: 'BOOKING_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3006,
        },
      },
    ]),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ConfigModule.forFeature(googleOauthConfig),
  ],
  controllers: [
    GatewayController,
    AuthController,
    UserAuthController,
    RoomController,
    AdminUserController,
    AdminRoomController,
    BookingController,
  ],
  providers: [
    GatewayService,
    RpcErrorInterceptor,
    JwtAuthGuard,
    {
      provide: APP_PIPE,
      useClass: I18nValidationPipe,
    },
    GoogleStrategy,
  ],
})
export class GatewayModule {}
