import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { VnpayService } from './vnpay.service';
import { VnpayReturnDto } from '../src/dto/vnpay-return.dto';
import * as crypto from 'crypto';
import * as qs from 'qs';

describe('VnpayService', () => {
  let service: VnpayService;

  const mockConfigService: Partial<ConfigService> = {
    get: (key: string) => {
      const env: Record<string, string> = {
        VNPAY_TMN_CODE: 'TEST_TMN',
        VNPAY_HASH_SECRET: 'SECRET',
        VNPAY_URL: 'http://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        VNPAY_RETURN_URL: 'http://localhost:3000/bookings/vnpay_return',
      };
      return env[key] ?? '';
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VnpayService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<VnpayService>(VnpayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentUrl', () => {
    it('should create a valid VNPay payment URL', () => {
      const url = service.createPaymentUrl(
        '127.0.0.1',
        1000,
        'Test order',
        '123',
      );
      expect(url).toContain('vnp_Amount=100000'); // 1000*100
      expect(url).toContain('vnp_TmnCode=TEST_TMN');
      expect(url).toContain('vnp_SecureHash');
    });

    it('should throw error if amount < 1 VND', () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      expect(() =>
        service.createPaymentUrl('127.0.0.1', 0.5, 'Test', '123'),
      ).toThrow(InternalServerErrorException);
      loggerSpy.mockRestore();
    });

    it('should throw error if amount > 9,999,999,990 VND', () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      expect(() =>
        service.createPaymentUrl(
          '127.0.0.1',
          10_000_000_000, // > 9,999,999,990
          'Test',
          '123',
        ),
      ).toThrow(InternalServerErrorException);
      loggerSpy.mockRestore();
    });
  });

  describe('verifyReturnUrl', () => {
    it('should return true for valid signature', () => {
      const dto: VnpayReturnDto = {
        vnp_Amount: '100000',
        vnp_TmnCode: 'TEST_TMN',
        vnp_TxnRef: '123',
        vnp_OrderInfo: 'Test order', // <-- thêm đây
        vnp_TransactionNo: '1',
        vnp_ResponseCode: '00',
        vnp_BankCode: 'NCB',
        vnp_BankTranNo: '123456',
        vnp_CardType: 'ATM',
        vnp_PayDate: '20250918150500',
        vnp_TransactionStatus: '00',
        vnp_SecureHash: '', // placeholder, sẽ tính ngay dưới
      };

      const paramsForHash: Record<string, string> = {
        vnp_Amount: dto.vnp_Amount,
        vnp_TmnCode: dto.vnp_TmnCode,
        vnp_TxnRef: dto.vnp_TxnRef,
        vnp_OrderInfo: dto.vnp_OrderInfo,
        vnp_TransactionNo: dto.vnp_TransactionNo,
        vnp_ResponseCode: dto.vnp_ResponseCode,
        vnp_BankCode: dto.vnp_BankCode,
        vnp_BankTranNo: dto.vnp_BankTranNo,
        vnp_CardType: dto.vnp_CardType,
        vnp_PayDate: dto.vnp_PayDate,
        vnp_TransactionStatus: dto.vnp_TransactionStatus,
      };

      delete paramsForHash.vnp_SecureHash;

      const sortedParams = service['sortObject'](paramsForHash);
      const signData = qs.stringify(sortedParams, { encode: false });
      dto.vnp_SecureHash = crypto
        .createHmac('sha512', service['hashSecret'])
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      expect(service.verifyReturnUrl(dto)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const dto: VnpayReturnDto = {
        vnp_Amount: '100000',
        vnp_TmnCode: 'TEST_TMN',
        vnp_TxnRef: '123',
        vnp_OrderInfo: 'Test order', // <-- thêm đây
        vnp_TransactionNo: '1',
        vnp_ResponseCode: '00',
        vnp_BankCode: 'NCB',
        vnp_BankTranNo: '123456',
        vnp_CardType: 'ATM',
        vnp_PayDate: '20250918150500',
        vnp_TransactionStatus: '00',
        vnp_SecureHash: 'invalidhash',
      };

      expect(service.verifyReturnUrl(dto)).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should throw error if VNPAY_TMN_CODE missing', () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const badConfig: Partial<ConfigService> = {
        get: (key: string) => (key === 'VNPAY_TMN_CODE' ? '' : 'X'),
      };
      expect(() => new VnpayService(badConfig as ConfigService)).toThrow(
        InternalServerErrorException,
      );
      loggerSpy.mockRestore();
    });

    it('should use fallback return URL if VNPAY_RETURN_URL missing', () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const badConfig: Partial<ConfigService> = {
        get: (key: string) => (key === 'VNPAY_RETURN_URL' ? '' : 'X'),
      };
      const svc = new VnpayService(badConfig as ConfigService);
      expect(svc['returnUrl']).toBe(
        'http://localhost:3000/bookings/vnpay_return',
      );
      loggerSpy.mockRestore();
    });
  });
});
