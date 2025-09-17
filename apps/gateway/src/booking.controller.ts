import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtAuthGuard, VnpayReturnDto } from '@app/common';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { CreateBookingDto } from '@app/common/dto/create-booking.dto';
import { User } from '@app/common/decorators/user.decorator';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { JwtPayload } from '@app/common/constants/database.constants';

// Giả định kiểu trả về từ microservice
interface MicroserviceResponse {
  status: string;
  message?: string;
  data?: any;
}

@Controller('bookings')
export class BookingController {
  constructor(
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: Request,
    @User() user: JwtPayload,
  ) {
    const lang = I18nContext.current()?.lang || 'vi';
    let ipAddr = req.ip || req.socket.remoteAddress;
    if (ipAddr === '::1' || ipAddr?.includes('::ffff:')) {
      ipAddr = '127.0.0.1';
    }
    const finalIpAddr = ipAddr || '127.0.0.1';
    // Sử dụng firstValueFrom để chờ kết quả từ microservice và tuân thủ require-await
    const result = await firstValueFrom<MicroserviceResponse>(
      this.bookingClient.send(
        { cmd: 'create_booking' },
        { createBookingDto, userId: user.sub, ipAddr: finalIpAddr, lang },
      ),
    );
    return result; // Trả về kết quả từ microservice
  }

  @Get('vnpay_return')
  async handleVnpayReturn(
    @Query() vnpayReturnDto: VnpayReturnDto,
    @Res() res: Response,
  ) {
    try {
      const lang = 'vi';
      const result = await firstValueFrom<MicroserviceResponse>(
        this.bookingClient.send({ cmd: 'vnpay_return' }, vnpayReturnDto),
      );

      if (result.status === 'success') {
        return res.json({
          status: result.status,
          message: result.message || this.i18n.t('booking.SUCCESS', { lang }),
          data: (result.data as string) || null,
        });
      } else if (result.status === 'failed' || result.status === 'error') {
        return res.json({
          status: result.status,
          message: result.message || this.i18n.t('booking.FAILED', { lang }),
          data: (result.data as string) || {
            txnRef: vnpayReturnDto.vnp_TxnRef,
            responseCode: vnpayReturnDto.vnp_ResponseCode,
          },
        });
      } else {
        return res.status(500).json({
          status: 'error',
          message: this.i18n.t('booking.INVALID_SIGNATURE', { lang }),
          data: null,
        });
      }
    } catch (error) {
      const lang = 'vi';
      // Type assertion cho error.message để tránh unsafe assignment
      return res.status(500).json({
        status: 'error',
        message: this.i18n.t('payment.INVALID_SIGNATURE', { lang }),
        data: { error: (error as Error).message }, // Ép kiểu error thành Error
      });
    }
  }
}
