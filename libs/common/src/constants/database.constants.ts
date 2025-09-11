export const DECIMAL_PRECISION = 10;
export const DECIMAL_SCALE = 2;
export const CUSTOMER_ID = 3;
export const PAGE = 1;
export const LIMIT = 10;
export const TOKEN_EXPIRES_HOURS = 1;
export const FILE_SIZE = 1024 * 1024 * 5; // 5MB
export const ALLOWED_FILE_TYPES = '.(png|jpeg|jpg)';

export enum BookingStatus {
  CANCELED = 0,
  BOOKED = 1,
  CHECK_IN = 2,
  CHECK_OUT = 3,
}

export enum ItemType {
  ROOM = 0,
  SERVICE = 1,
  SURCHARGE = 2,
  DISCOUNT = 3,
}

export enum PaymentMethod {
  CASH = 0,
  BANK_TRANSFER = 1,
  CARD = 2,
}

export enum InvoiceStatus {
  PENDING = 1,
  PAID = 2,
  CANCELED = 3,
}

export enum DiscountType {
  PERCENTAGE = 0,
  FIXED_AMOUNT = 1,
}

export enum RoomStatus {
  MAINTENANCE = 0,
  AVAILABLE = 1,
  OCCUPIED = 2,
}

export enum ShiftType {
  MORNING = 0,
  AFTERNOON = 1,
  NIGHT = 2,
}

export enum UserStatus {
  INACTIVE = 0,
  ACTIVE = 1,
}

export interface JwtPayload {
  jti: string;
  exp: number;
  sub: number;
  email: string;
  role: string;
  name: string;
}

export interface RpcError {
  message: string;
  status: number;
}

export interface OAuthUser {
  email: string;
  name: string;
  avatar: string | null;
}

interface SerializedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: {
    type: 'Buffer';
    data: number[];
  };
  size: number;
}
export interface UploadPayload {
  file: SerializedFile;
  roomId: number;
}

export interface UserUploadPayload {
  file: SerializedFile;
  userId: number;
}
