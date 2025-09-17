import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BookingService } from './booking.service';
import { VnpayReturnDto } from '@app/common';
import { CreateBookingDto } from '@app/common/dto/create-booking.dto';

@Controller()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @MessagePattern({ cmd: 'create_booking' })
  createBooking(
    @Payload()
    payload: {
      createBookingDto: CreateBookingDto;
      userId: number;
      ipAddr: string;
      lang: string;
    },
  ) {
    return this.bookingService.createBooking(payload);
  }

  @MessagePattern({ cmd: 'vnpay_return' })
  handleVnpayReturn(@Payload() vnpayReturnDto: VnpayReturnDto) {
    return this.bookingService.handleVnpayReturn(vnpayReturnDto);
  }
}
