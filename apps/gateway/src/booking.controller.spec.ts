/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { ClientProxy } from '@nestjs/microservices';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '@app/common';
import { CreateBookingDto, VnpayReturnDto, JwtPayload } from '@app/common';

describe('BookingController', () => {
  let controller: BookingController;
  let bookingClient: jest.Mocked<ClientProxy>;
  let i18n: jest.Mocked<I18nService>;

  beforeEach(async () => {
    bookingClient = { send: jest.fn() } as unknown as jest.Mocked<ClientProxy>;
    i18n = {
      t: jest.fn((key: string) => `translated_${key}`),
    } as unknown as jest.Mocked<I18nService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        { provide: 'BOOKING_SERVICE', useValue: bookingClient },
        { provide: ConfigService, useValue: {} },
        { provide: I18nService, useValue: i18n },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<BookingController>(BookingController);
  });

  describe('createBooking', () => {
    it('should call bookingClient.send and return result', async () => {
      const mockDto: CreateBookingDto = {
        roomIds: [1],
        startTime: '2025-09-18T10:00:00Z',
        endTime: '2025-09-18T12:00:00Z',
        numAdults: 2,
      } as CreateBookingDto;
      const mockUser: JwtPayload = { sub: 123 } as JwtPayload;
      const mockReq = {
        ip: '::1',
        socket: { remoteAddress: undefined },
      } as Request;
      const expectedResult = { status: 'success', data: { id: 1 } };

      bookingClient.send.mockReturnValue(of(expectedResult));

      const result = await controller.createBooking(mockDto, mockReq, mockUser);

      expect(result).toEqual(expectedResult);
      expect(bookingClient.send).toHaveBeenCalledWith(
        { cmd: 'create_booking' },
        expect.objectContaining({
          createBookingDto: mockDto,
          userId: 123,
          ipAddr: '127.0.0.1',
          lang: 'vi',
        }),
      );
    });
  });

  describe('handleVnpayReturn', () => {
    let res: Partial<Response>;

    beforeEach(() => {
      res = {
        json: jest
          .fn()
          .mockImplementation(
            (data: unknown) => data,
          ) as unknown as Response['json'],
        status: jest.fn().mockReturnThis() as unknown as Response['status'],
      };
    });

    it('should handle success response', async () => {
      const mockDto: VnpayReturnDto = {
        vnp_TxnRef: '123',
        vnp_ResponseCode: '00',
      } as VnpayReturnDto;
      bookingClient.send.mockReturnValue(of({ status: 'success', data: 'ok' }));

      const result = await controller.handleVnpayReturn(
        mockDto,
        res as Response,
      );

      expect(result).toEqual({
        status: 'success',
        message: 'translated_booking.SUCCESS',
        data: 'ok',
      });
    });

    it('should handle failed response', async () => {
      const mockDto: VnpayReturnDto = {
        vnp_TxnRef: '123',
        vnp_ResponseCode: '24',
      } as VnpayReturnDto;
      bookingClient.send.mockReturnValue(of({ status: 'failed' }));

      const result = await controller.handleVnpayReturn(
        mockDto,
        res as Response,
      );

      expect(result).toEqual({
        status: 'failed',
        message: 'translated_booking.FAILED',
        data: { txnRef: '123', responseCode: '24' },
      });
    });

    it('should handle unknown response', async () => {
      const mockDto: VnpayReturnDto = {
        vnp_TxnRef: '123',
        vnp_ResponseCode: '99',
      } as VnpayReturnDto;
      bookingClient.send.mockReturnValue(of({ status: 'weird' }));

      await controller.handleVnpayReturn(mockDto, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'translated_booking.INVALID_SIGNATURE',
        data: null,
      });
    });

    it('should handle exception thrown by bookingClient', async () => {
      const mockDto: VnpayReturnDto = {
        vnp_TxnRef: '123',
        vnp_ResponseCode: '00',
      } as VnpayReturnDto;
      bookingClient.send.mockReturnValue(throwError(() => new Error('boom')));

      await controller.handleVnpayReturn(mockDto, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'translated_payment.INVALID_SIGNATURE',
        data: { error: 'boom' },
      });
    });
  });
});
