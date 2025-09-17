import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@app/common/constants/database.constants';

export class CreateBookingDto {
  @IsArray({ message: 'validation.IS_ARRAY' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @IsInt({ each: true, message: 'validation.IS_INT' })
  roomIds: number[];

  @IsDateString({}, { message: 'validation.IS_DATE_STRING' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  startTime: string;

  @IsDateString({}, { message: 'validation.IS_DATE_STRING' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  endTime: string;

  @Type(() => Number)
  @IsInt({ message: 'validation.IS_INT' })
  @Min(1, { message: 'validation.MIN' })
  numAdults: number;

  @Type(() => Number)
  @IsInt({ message: 'validation.IS_INT' })
  @Min(0, { message: 'validation.MIN' })
  @IsOptional()
  numChildren?: number = 0;

  @IsArray({ message: 'validation.IS_ARRAY' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @IsInt({ each: true, message: 'validation.IS_INT' })
  serviceIds: number[];

  @IsArray({ message: 'validation.IS_ARRAY' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @IsPositive({ each: true, message: 'validation.IS_POSITIVE' })
  quantities: number[];

  @IsInt()
  @IsEnum(PaymentMethod, { message: 'validation.IS_ENUM' })
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CARD;
}
