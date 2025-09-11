import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsInt,
  IsOptional,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { UserStatus } from '../constants/database.constants';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString({ message: 'validation.IS_STRING' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @MaxLength(100, { message: 'validation.MAX_LENGTH' })
  name: string;

  @IsEmail({}, { message: 'validation.IS_EMAIL' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @MaxLength(255, { message: 'validation.MAX_LENGTH' })
  email: string;

  @IsString({ message: 'validation.IS_STRING' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  @MinLength(6, { message: 'validation.MIN_LENGTH' })
  @MaxLength(128, { message: 'validation.MAX_LENGTH' })
  password: string;

  @IsString()
  @IsOptional() // phone is not required
  phone?: string;

  @Type(() => Number)
  @IsInt({ message: 'validation.IS_INT' })
  @IsNotEmpty({ message: 'validation.IS_NOT_EMPTY' })
  role_id: number;

  @IsUrl({}, { message: 'validation.IS_URL' })
  @IsOptional() // avatar is not required
  avatar?: string;

  @Type(() => Number)
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus = UserStatus.ACTIVE;
}
