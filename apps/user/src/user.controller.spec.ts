/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { ListUserDto, UpdateUserDto } from '@app/common';
import { CreateUserDto } from '@app/common/dto/create-user.dto';
import { RpcException } from '@nestjs/microservices';

// 1. Create a mock object (stand-in) for UserService
const mockUserService = {
  listUsers: jest.fn(),
  create: jest.fn(),
  updateUserInfo: jest.fn(),
  deleteUser: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset mocks after each test
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- Test suite for handler 'listUsers' ---
  describe('listUsers', () => {
    const listUserDto: ListUserDto = {
      page: 1,
      limit: 10,
      search: 'test',
    };

    it('should call userService.listUsers with the correct payload and return the result', async () => {
      const successResponse = {
        data: [{ id: 1, name: 'Test User' }],
        total: 1,
        page: 1,
        last_page: 1,
      };

      mockUserService.listUsers.mockResolvedValue(successResponse);

      const result = await controller.listUsers(listUserDto);

      expect(service.listUsers).toHaveBeenCalledWith(listUserDto);
      expect(result).toEqual(successResponse);
    });

    it('should propagate any error thrown by the service', async () => {
      const rpcError = new RpcException('Database connection failed');
      mockUserService.listUsers.mockRejectedValue(rpcError);

      await expect(controller.listUsers(listUserDto)).rejects.toThrow(rpcError);
      expect(service.listUsers).toHaveBeenCalledWith(listUserDto);
    });
  });

  // --- Test suite for handler 'create' ---
  describe('create', () => {
    const basePayload = {
      createUserDto: { email: 'test@example.com', name: 'John Doe' } as CreateUserDto,
      lang: 'en',
      imageUrl: 'http://example.com/image.png',
    };

    it('should call userService.create with the correct payload and return result', async () => {
      const successResponse = { id: 1, ...basePayload.createUserDto };
      mockUserService.create.mockResolvedValue(successResponse);

      const result = await controller.create(basePayload);

      expect(service.create).toHaveBeenCalledWith(basePayload);
      expect(result).toEqual(successResponse);
    });

    it('should propagate error from userService.create', async () => {
      const rpcError = new RpcException('Failed to create user');
      mockUserService.create.mockRejectedValue(rpcError);

      await expect(controller.create(basePayload)).rejects.toThrow(rpcError);
      expect(service.create).toHaveBeenCalledWith(basePayload);
    });

    it('should work correctly when imageUrl is null', async () => {
      const payload = { ...basePayload, imageUrl: null };
      const successResponse = { id: 2, ...payload.createUserDto };
      mockUserService.create.mockResolvedValue(successResponse);

      const result = await controller.create(payload);

      expect(service.create).toHaveBeenCalledWith(payload);
      expect(result).toEqual(successResponse);
    });
  });

  // --- Test suite for handler 'handleUpdateUserInfo' ---
  describe('handleUpdateUserInfo', () => {
    const payload = {
      id: 1,
      updateUserDto: { name: 'Updated User' } as UpdateUserDto,
      lang: 'en',
    };

    it('should call userService.updateUserInfo with the correct args and return result', async () => {
      const successResponse = { id: 1, name: 'Updated User' };
      mockUserService.updateUserInfo.mockResolvedValue(successResponse);

      const result = await controller.handleUpdateUserInfo(payload);

      expect(service.updateUserInfo).toHaveBeenCalledWith(
        payload.id,
        payload.updateUserDto,
        payload.lang,
      );
      expect(result).toEqual(successResponse);
    });

    it('should propagate error from userService.updateUserInfo', async () => {
      const rpcError = new RpcException('Failed to update user');
      mockUserService.updateUserInfo.mockRejectedValue(rpcError);

      await expect(controller.handleUpdateUserInfo(payload)).rejects.toThrow(rpcError);
      expect(service.updateUserInfo).toHaveBeenCalledWith(
        payload.id,
        payload.updateUserDto,
        payload.lang,
      );
    });
  });

  // --- Test suite for handler 'handleDeleteUser' ---
  describe('handleDeleteUser', () => {
    const payload = { id: 1, lang: 'en' };

    it('should call userService.deleteUser with the correct args and return result', async () => {
      const successResponse = { success: true };
      mockUserService.deleteUser.mockResolvedValue(successResponse);

      const result = await controller.handleDeleteUser(payload);

      expect(service.deleteUser).toHaveBeenCalledWith(payload.id, payload.lang);
      expect(result).toEqual(successResponse);
    });

    it('should propagate error from userService.deleteUser', async () => {
      const rpcError = new RpcException('Failed to delete user');
      mockUserService.deleteUser.mockRejectedValue(rpcError);

      await expect(controller.handleDeleteUser(payload)).rejects.toThrow(rpcError);
      expect(service.deleteUser).toHaveBeenCalledWith(payload.id, payload.lang);
    });
  });
});
