import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Booking,
  BookingRoom,
  Invoice,
  Room,
  Service,
  BookingService as BookingServiceEntity,
} from '@app/database';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  BookingStatus,
  CreateBookingDto,
  InvoiceStatus,
  PaymentMethod,
  VnpayReturnDto,
} from '@app/common';
import { RpcException } from '@nestjs/microservices';
import { I18nService } from 'nestjs-i18n';
import { VnpayService } from '../../../libs/common/vnpay/vnpay.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingRoom)
    private readonly bookingRoomRepository: Repository<BookingRoom>,
    @InjectRepository(Room) private readonly roomRepository: Repository<Room>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly vnpayService: VnpayService,
    private readonly i18n: I18nService,
    @InjectQueue('emails') private readonly emailQueue: Queue,
  ) {}

  async createBooking(payload: {
    createBookingDto: CreateBookingDto;
    userId: number;
    ipAddr: string;
    lang: string;
  }) {
    const { createBookingDto, userId, ipAddr, lang } = payload;
    const {
      roomIds,
      startTime,
      endTime,
      numAdults,
      numChildren,
      serviceIds = [],
      quantities = [],
    } = createBookingDto;

    const currentTime = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    // --- 1. Validate input arrays ---
    if (!roomIds.length) {
      throw new RpcException({
        message: this.i18n.t('booking.ROOM_REQUIRED', { lang }),
        status: 400,
      });
    }

    if (start <= currentTime) {
      throw new RpcException({
        message: this.i18n.t('booking.START_TIME_PAST', { lang }),
        status: 400,
      });
    }

    // --- 2. Check if rooms and services exist ---
    const rooms = await this.roomRepository.findBy({ id: In(roomIds) });
    if (rooms.length !== roomIds.length) {
      throw new RpcException({
        message: this.i18n.t('booking.ROOM_NOT_FOUND', { lang }),
        status: 404,
      });
    }

    const services = serviceIds.length
      ? await this.serviceRepository.findBy({ id: In(serviceIds) })
      : [];
    if (serviceIds.length && services.length !== serviceIds.length) {
      throw new RpcException({
        message: this.i18n.t('booking.SERVICE_NOT_FOUND', { lang }),
        status: 404,
      });
    }

    // --- 3. Check if rooms are available ---
    const existingBookings = await this.bookingRoomRepository.count({
      where: {
        room_id: In(roomIds),
        booking: {
          status: In([BookingStatus.BOOKED, BookingStatus.CHECK_IN]),
          start_time: LessThanOrEqual(new Date(endTime)),
          end_time: MoreThanOrEqual(new Date(startTime)),
        },
      },
    });
    if (existingBookings > 0) {
      throw new RpcException({
        message: this.i18n.t('booking.ROOM_NOT_AVAILABLE', { lang }),
        status: 409,
      });
    }

    // --- 4. Price and duration calculations ---
    const timeDiffMs = end.getTime() - start.getTime();
    const hoursDiff = timeDiffMs / (1000 * 3600); // Calculate in hours
    if (hoursDiff <= 0) {
      throw new RpcException({
        message: this.i18n.t('booking.INVALID_TIME', { lang }),
        status: 400,
      });
    }

    // Custom business rule: calculate nights based on time blocks
    const nights = Math.ceil(hoursDiff / 24); // Round up to days
    // Alternative: If < 12 hours count as 0.5 night, otherwise count as 1 night
    // const nights = hoursDiff >= 12 ? Math.ceil(hoursDiff / 24) : 0.5;

    const roomTotalPrice = rooms.reduce(
      (sum, room) => sum + Number(room.price) * nights,
      0,
    );

    // Validate that quantities length matches serviceIds if services exist
    if (serviceIds.length && quantities.length !== serviceIds.length) {
      throw new RpcException({
        message: this.i18n.t('booking.QUANTITY_MISMATCH', { lang }),
        status: 400,
      });
    }

    const serviceTotalPrice = services.reduce(
      (sum, service, index) =>
        sum + Number(service.price) * (quantities[index] || 0),
      0,
    );
    const totalPrice = roomTotalPrice + serviceTotalPrice;

    // --- 5. Create booking, rooms, services, and invoice in a transaction ---
    const transactionResult = await this.bookingRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const newBooking = transactionalEntityManager.create(Booking, {
          user_id: userId,
          start_time: start,
          end_time: end,
          num_adults: numAdults,
          num_children: numChildren,
          status: BookingStatus.BOOKED,
        });
        const savedBooking = await transactionalEntityManager.save(newBooking);

        // Save booking-room relations
        for (const room of rooms) {
          const newBookingRoom = transactionalEntityManager.create(
            BookingRoom,
            {
              booking_id: savedBooking.id,
              room_id: room.id,
              price_at_booking: Number(room.price),
            },
          );
          await transactionalEntityManager.save(newBookingRoom);
        }

        // Save booking-service relations
        for (let i = 0; i < services.length; i++) {
          const service = services[i];
          const quantity = quantities[i] || 0; // Default to 0 if no quantity provided
          const newBookingService = transactionalEntityManager.create(
            BookingServiceEntity,
            {
              booking_id: savedBooking.id,
              service_id: service.id,
              quantity,
              price_at_booking: Number(service.price),
            },
          );
          await transactionalEntityManager.save(newBookingService);
        }

        // Create invoice
        const newInvoice = transactionalEntityManager.create(Invoice, {
          booking_id: savedBooking.id,
          invoice_code: `INV-${Date.now()}-${savedBooking.id}`,
          subtotal: totalPrice,
          total_amount: totalPrice,
          payment_method: createBookingDto.paymentMethod || PaymentMethod.CARD,
          status: InvoiceStatus.PENDING,
          issued_date: new Date(),
        });
        const savedInvoice = await transactionalEntityManager.save(newInvoice);

        // Sanitize order info string
        const orderInfo = `Payment for invoice ${savedInvoice.invoice_code}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s/g, '-');

        // Create unique transaction reference
        const txnRef = `${savedInvoice.id}-${Date.now().toString().slice(-8)}`;

        this.logger.log(
          `Created booking ${savedBooking.id} and invoice ${savedInvoice.id}.`,
        );
        return { savedInvoice, txnRef, orderInfo };
      },
    );

    // --- 6. Generate payment URL outside the transaction ---
    const { savedInvoice, txnRef, orderInfo } = transactionResult;
    const paymentUrl = this.vnpayService.createPaymentUrl(
      ipAddr,
      savedInvoice.total_amount,
      orderInfo,
      txnRef,
    );

    return {
      status: 'success',
      message: this.i18n.t('booking.SUCCESS', { lang }),
      data: { paymentUrl },
    };
  }

  async handleVnpayReturn(vnpayReturnDto: VnpayReturnDto) {
    const lang = 'vi';
    const isVerified = this.vnpayService.verifyReturnUrl(vnpayReturnDto);
    const invoiceId = parseInt(vnpayReturnDto.vnp_TxnRef, 10);

    if (!isVerified) {
      this.logger.error(
        `VNPay return verification failed for txnRef ${vnpayReturnDto.vnp_TxnRef}. Return DTO: ${JSON.stringify(vnpayReturnDto)}`,
      );
      return {
        status: 'error',
        message: this.i18n.t('booking.INVALID_SIGNATURE', { lang }),
      };
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: [
        'booking',
        'booking.user',
        'booking.bookingRooms',
        'booking.bookingServices',
        'booking.bookingRooms.room',
        'booking.bookingServices.service',
      ],
    });
    if (!invoice) {
      this.logger.error(`Invoice not found for VNPay return: ${invoiceId}`);
      return {
        status: 'error',
        message: this.i18n.t('booking.INVALID_SIGNATURE', { lang }),
      };
    }

    const booking = invoice.booking;
    const user = booking.user;

    if (vnpayReturnDto.vnp_ResponseCode === '00') {
      invoice.status = InvoiceStatus.PAID;
      invoice.paid_date = new Date();
      booking.status = BookingStatus.BOOKED;
      await this.invoiceRepository.save(invoice);
      await this.bookingRepository.save(booking);
      this.logger.log(
        `Invoice ${invoiceId} paid. Booking ${booking.id} confirmed.`,
      );
      try {
        await this.emailQueue.add('send-booking-confirmation-email', {
          email: user.email,
          name: user.name,
          lang: lang,
          invoice: invoice,
        });

        this.logger.log(
          `Payment confirmation email job queued for booking ${booking.id} and invoice ${invoiceId}.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to add payment confirmation email job to the queue for booking ${booking.id} and invoice ${invoiceId}`,
          (error as Error).stack,
        );
      }
      return {
        status: 'success',
        message: this.i18n.t('booking.SUCCESS', { lang }),
        data: {
          invoice,
        },
      };
    } else {
      invoice.status = InvoiceStatus.CANCELED;
      booking.status = BookingStatus.CANCELED;
      await this.invoiceRepository.save(invoice);
      await this.bookingRepository.save(booking);
      this.logger.warn(
        `Invoice ${invoiceId} failed or was cancelled. Booking ${booking.id} failed.`,
      );
      return {
        status: 'failed',
        message: this.i18n.t('booking.FAILED', { lang }),
      };
    }
  }
}
