import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { RoomService } from './room.service';
import { ListRoomDto } from '@app/common/dto/list-room.dto';
import { CreateRoomDto, UpdateRoomDto } from '@app/common';

@Controller()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @MessagePattern({ cmd: 'list_rooms' })
  listRooms(@Payload() listRoomDto: ListRoomDto) {
    return this.roomService.listRooms(listRoomDto);
  }

  @MessagePattern({ cmd: 'get_room_by_id' })
  getRoomById(@Payload() payload: { id: number }) {
    return this.roomService.getRoomById(payload.id);
  }

  @MessagePattern({ cmd: 'create_room' })
  createRoom(
    @Payload()
    payload: {
      createRoomDto: CreateRoomDto;
      lang: string;
      imageUrl: string | null;
    },
  ) {
    return this.roomService.createRoom(payload);
  }

  @MessagePattern({ cmd: 'update_room_info' })
  handleUpdateRoomInfo(
    @Payload()
    payload: {
      id: number;
      updateRoomDto: UpdateRoomDto;
      lang: string;
    },
  ) {
    return this.roomService.updateRoomInfo(
      payload.id,
      payload.updateRoomDto,
      payload.lang,
    );
  }

  @MessagePattern({ cmd: 'delete_room' })
  handleDeleteRoom(@Payload() payload: { id: number; lang: string }) {
    return this.roomService.deleteRoom(payload.id, payload.lang);
  }
}
