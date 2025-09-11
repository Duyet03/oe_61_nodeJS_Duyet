import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ALLOWED_FILE_TYPES,
  FILE_SIZE,
  JwtAuthGuard,
  ListUserDto,
  Roles,
  RolesGuard,
  UpdateUserDto,
} from '@app/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateUserDto } from '@app/common/dto/create-user.dto';
import { firstValueFrom } from 'rxjs';
import { User } from '@app/database';
import { ParseId } from '@app/common/decorators/parse-id.decorator';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(
    @Inject('UPLOAD_SERVICE') private readonly uploadClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @Roles('admin')
  listUsers(@Query() listUserDto: ListUserDto) {
    return this.userClient.send({ cmd: 'list_users' }, listUserDto);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
        fileIsRequired: false,
      }),
    )
    image?: Express.Multer.File,
  ) {
    const lang = I18nContext.current()?.lang || 'vi';

    try {
      let imageUrl: string | null = null;
      if (image) {
        const result = await firstValueFrom<{ url: string }>(
          this.uploadClient.send('upload_image', {
            file: image,
          }),
        );
        imageUrl = result.url;
      }

      const newUser = await firstValueFrom<User>(
        this.userClient.send(
          { cmd: 'create_user' },
          { createUserDto, lang, imageUrl },
        ),
      );

      return {
        status: true,
        message: this.i18n.t('user.CREATED_SUCCESS', { lang }),
        data: newUser,
      };
    } catch (error) {
      const err = error as Error;
      return {
        status: false,
        message: err.message || this.i18n.t('user.CREATE_FAILED', { lang }),
      };
    }
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async updateUser(
    @ParseId('id') id: number,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
        fileIsRequired: false,
      }),
    )
    image?: Express.Multer.File,
  ) {
    const lang = I18nContext.current()?.lang || 'vi';
    try {
      let imageUrl: string | null = null;

      if (image) {
        const result = await firstValueFrom<{ url: string }>(
          this.uploadClient.send('upload_image', { file: image }),
        );
        imageUrl = result.url;
      }

      const user = await firstValueFrom<User>(
        this.userClient.send(
          { cmd: 'update_user_info' },
          { id, updateUserDto: { ...updateUserDto, avatar: imageUrl }, lang },
        ),
      );

      return {
        status: true,
        message: this.i18n.t('user.UPDATED_SUCCESS', { lang }),
        data: user,
      };
    } catch (error) {
      const err = error as Error;
      return {
        status: false,
        message: err.message || this.i18n.t('user.UPDATE_FAILED', { lang }),
      };
    }
  }

  @Delete(':id')
  async deleteUser(@ParseId('id') id: number) {
    const lang = I18nContext.current()?.lang || 'vi';

    try {
      const user = await firstValueFrom<User>(
        this.userClient.send({ cmd: 'delete_user' }, { id, lang }),
      );
      
      return {
        status: true,
        message: this.i18n.t('user.DELETED_SUCCESS', { lang }),
        data: user,
      };
    } catch (error) {
      const err = error as Error;
      throw new HttpException(
        {
          status: false,
          message: this.i18n.t('user.DELETE_FAILED', { lang }),
          error: err.message || String(error),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
