import { NestFactory } from '@nestjs/core';
import { BookingModule } from './booking.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BookingModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env.SERVICE_HOST || '127.0.0.1',
        port: parseInt(process.env.BOOKING_SERVICE_PORT || '3006'),
      },
    },
  );

  await app.listen();
  console.log(
    `Booking is running at tcp://${
      process.env.SERVICE_HOST || '127.0.0.1'
    }:${process.env.BOOKING_SERVICE_PORT || 3006}`,
  );
}

void bootstrap();
