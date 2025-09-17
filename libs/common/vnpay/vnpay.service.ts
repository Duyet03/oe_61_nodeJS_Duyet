import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { VnpayReturnDto } from '../src/dto/vnpay-return.dto';

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly vnpUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Get and validate environment variables
    this.tmnCode = this.configService.get<string>('VNPAY_TMN_CODE') || '';
    this.hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET') || '';
    this.vnpUrl = this.configService.get<string>('VNPAY_URL') || '';
    this.returnUrl = this.configService.get<string>('VNPAY_RETURN_URL') || '';

    if (!this.tmnCode) {
      this.logger.error('Missing VNPAY_TMN_CODE in .env file!');
      throw new InternalServerErrorException('VNPAY_TMN_CODE is missing.');
    }
    if (!this.hashSecret) {
      this.logger.error('Missing VNPAY_HASH_SECRET in .env file!');
      throw new InternalServerErrorException('VNPAY_HASH_SECRET is missing.');
    }
    if (!this.vnpUrl) {
      this.logger.error('Missing VNPAY_URL in .env file!');
      throw new InternalServerErrorException('VNPAY_URL is missing.');
    }
    if (!this.returnUrl) {
      this.logger.error('Missing VNPAY_RETURN_URL in .env file!');
      this.logger.warn('Using default localhost return URL for testing.');
      this.returnUrl = 'http://localhost:3000/bookings/vnpay_return'; // Fallback for test
    }
    this.logger.log('VNPay service initialized with config.');
  }

  createPaymentUrl(
    ipAddr: string,
    amount: number,
    orderInfo: string,
    txnRef: string,
  ): string {
    // Ensure UTC+7 timezone (Asia/Ho_Chi_Minh)
    const now = new Date();
    const vietnamTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    const [year, month, day, hour, minute, second] = vietnamTime.match(/\d+/g)!;
    const createDate = `${year}${month}${day}${hour}${minute}${second}`;
    this.logger.log(`Server time (VN): ${vietnamTime}`);

    const vnpAmount = Math.round(amount * 100);
    if (vnpAmount < 100 || vnpAmount > 999999999900) {
      this.logger.error(
        `Invalid amount: ${amount} VND (vnp_Amount: ${vnpAmount})`,
      );
      throw new InternalServerErrorException(
        'Amount out of VNPay range (1 VND to 9,999,999,990 VND)',
      );
    }

    // Encode vnp_ReturnUrl once and log for debugging
    const rawReturnUrl = this.returnUrl;
    const encodedReturnUrl = encodeURIComponent(rawReturnUrl);
    this.logger.log(`vnp_ReturnUrl (raw): ${rawReturnUrl}`);
    this.logger.log(`vnp_ReturnUrl (encoded): ${encodedReturnUrl}`);

    let vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo.trim(), // Remove extra spaces, ensure <100 characters
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: encodedReturnUrl, // Use encoded value
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    // Sort alphabetically (required by VNPay for hash)
    vnp_Params = this.sortObject(vnp_Params);

    // Create signature with signData (do not re-encode, vnp_ReturnUrl is already encoded)
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    // Build URL without re-encoding to avoid double-encoding
    const queryString = qs.stringify(vnp_Params, { encode: false });
    this.logger.log(`Generated signData: ${signData}`);
    this.logger.log(`Generated payment URL: ${this.vnpUrl}?${queryString}`);

    return `${this.vnpUrl}?${queryString}`;
  }

  verifyReturnUrl(vnpayReturnDto: VnpayReturnDto): boolean {
    const vnp_Params: Record<string, string | number> = {
      ...vnpayReturnDto,
    } as Record<string, string | number>; // Ép kiểu vnpayReturnDto
    const secureHash = vnp_Params['vnp_SecureHash'];

    // Remove properties not used for hash calculation
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnp_Params);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    this.logger.log(
      `Verify - SignData: ${signData}, Expected: ${secureHash}, Calculated: ${signed}`,
    );

    return secureHash === signed;
  }

  private sortObject(
    obj: Record<string, string | number>,
  ): Record<string, string | number> {
    const sorted: Record<string, string | number> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = obj[key];
    }
    return sorted;
  }
}
