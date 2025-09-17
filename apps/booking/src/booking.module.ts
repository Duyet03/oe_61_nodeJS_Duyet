import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { CommonModule } from '@app/common';
import {
  DatabaseModule,
  Booking,
  Room,
  BookingRoom,
  Invoice,
  Service,
} from '@app/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    TypeOrmModule.forFeature([Booking, BookingRoom, Invoice, Room, Service]),
    BullModule.registerQueueAsync({
      name: 'emails',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
