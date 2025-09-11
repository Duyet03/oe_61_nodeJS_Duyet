import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { ListUserDto, UpdateUserDto } from '@app/common';
import { UserService } from './user.service';
import { CreateUserDto } from '@app/common/dto/create-user.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'list_users' })
  listUsers(@Payload() listUserDto: ListUserDto) {
    return this.userService.listUsers(listUserDto);
  }

  @MessagePattern({ cmd: 'create_user' })
  create(
    @Payload()
    payload: {
      createUserDto: CreateUserDto;
      lang: string;
      imageUrl: string | null;
    },
  ) {
    return this.userService.create(payload);
  }

  @MessagePattern({ cmd: 'update_user_info' })
  handleUpdateUserInfo(
    @Payload()
    payload: {
      id: number;
      updateUserDto: UpdateUserDto;
      lang: string;
    },
  ) {
    return this.userService.updateUserInfo(
      payload.id,
      payload.updateUserDto,
      payload.lang,
    );
  }

  @MessagePattern({ cmd: 'delete_user' })
  handleDeleteUser(@Payload() payload: { id: number; lang: string }) {
    return this.userService.deleteUser(payload.id, payload.lang);
  }
}
