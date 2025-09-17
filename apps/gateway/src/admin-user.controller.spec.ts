/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserController } from './admin-user.controller';
import { RpcException } from '@nestjs/microservices';
import { of, throwError, Observable, firstValueFrom } from 'rxjs';
import { I18nService } from 'nestjs-i18n';
import {
  CreateUserDto,
  JwtAuthGuard,
  ListUserDto,
  RolesGuard,
  UpdateUserDto,
} from '@app/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { User } from '@app/database';
import { Logger } from '@nestjs/common';

// Mock dependencies
const mockUserClient = { send: jest.fn() };
const mockUploadClient = { send: jest.fn() };
const mockI18nService = { t: jest.fn((key: string) => key) };

// Mock I18nContext globally
jest.mock('nestjs-i18n', () => ({
  I18nModule: { forRoot: jest.fn() },
  I18nService: jest.fn().mockImplementation(() => mockI18nService),
  I18nContext: { current: jest.fn(() => ({ lang: 'vi' })) },
}));

// Helper function to create DTO instances
const createDto = <T>(dtoClass: new () => T, data: Partial<T>): T =>
  plainToInstance(dtoClass, data);

// Common testing module setup
const setupTestingModule = async (): Promise<TestingModule> =>
  Test.createTestingModule({
    controllers: [AdminUserController],
    providers: [
      { provide: 'USER_SERVICE', useValue: mockUserClient },
      { provide: 'UPLOAD_SERVICE', useValue: mockUploadClient },
      { provide: I18nService, useValue: mockI18nService },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

describe('AdminUserController', () => {
  let controller: AdminUserController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await setupTestingModule();
    controller = module.get<AdminUserController>(AdminUserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('should call userClient.send and return response', async () => {
      const dto: ListUserDto = {};
      const response = { data: [], total: 0 };
      mockUserClient.send.mockReturnValue(of(response));

      const result = await firstValueFrom(
        controller.listUsers(dto) as Observable<typeof response>,
      );

      expect(mockUserClient.send).toHaveBeenCalledWith(
        { cmd: 'list_users' },
        dto,
      );
      expect(result).toEqual(response);
    });

    describe('ListUserDto validation', () => {
      it('should pass validation with correct data', async () => {
        const dto = createDto(ListUserDto, {
          page: 1,
          limit: 20,
          search: 'test',
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });

      it('should fail validation if page is not a number', async () => {
        const dto = createDto(ListUserDto, {
          page: 'abc' as unknown as number,
        });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'page')).toBeTruthy();
      });

      it('should fail validation if limit is out of range', async () => {
        const dto = createDto(ListUserDto, { limit: 200 });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'limit')).toBeTruthy();
      });

      it('should fail validation if search is not a string', async () => {
        const dto = createDto(ListUserDto, {
          search: 123 as unknown as string,
        });
        const errors = await validate(dto);
        expect(
          errors.some((error) => error.property === 'search'),
        ).toBeTruthy();
      });

      it('should pass validation if optional fields are missing', async () => {
        const dto = createDto(ListUserDto, {});
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      name: 'New User',
      email: 'newuser@example.com',
      password: 'password123',
      role_id: 1,
    };
    const mockAvatar = { originalname: 'avatar.jpg' } as Express.Multer.File;
    const newUserResponse = { id: 1, ...createUserDto };

    it('should upload avatar and create user', async () => {
      mockUploadClient.send.mockReturnValue(
        of({ url: 'http://image.url' }) as Observable<{ url: string }>,
      );
      mockUserClient.send.mockReturnValue(of(newUserResponse));

      const result = await controller.createUser(createUserDto, mockAvatar);

      expect(mockUploadClient.send).toHaveBeenCalled();
      expect(mockUserClient.send).toHaveBeenCalledWith(
        { cmd: 'create_user' },
        expect.objectContaining({
          createUserDto,
          lang: 'vi',
          imageUrl: 'http://image.url',
        }),
      );
      expect(result.data).toEqual(newUserResponse);
    });

    it('should create user without avatar', async () => {
      mockUserClient.send.mockReturnValue(of(newUserResponse));

      const result = await controller.createUser(createUserDto, undefined);

      expect(mockUploadClient.send).not.toHaveBeenCalled();
      expect(mockUserClient.send).toHaveBeenCalled();
      expect(result.data).toEqual(newUserResponse);
    });

    it('should return failure response on error', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const errorMessage = 'user.CREATE_FAILED';
      mockUserClient.send.mockReturnValue(
        throwError(() => new RpcException(errorMessage)),
      );

      const result = await controller.createUser(createUserDto, undefined);

      expect(result).toEqual({
        status: false,
        message: errorMessage,
      });
      loggerSpy.mockRestore();
    });

    describe('CreateUserDto validation', () => {
      it.each([
        [
          'name',
          { email: 'test@test.com', password: 'password123', role_id: 1 },
        ],
        ['email', { name: 'Test User', password: 'password123', role_id: 1 }],
        ['password', { name: 'Test User', email: 'test@test.com', role_id: 1 }],
        [
          'role_id',
          {
            name: 'Test User',
            email: 'test@test.com',
            password: 'password123',
          },
        ],
      ])('should fail validation if %s is missing', async (property, data) => {
        const dto = createDto(CreateUserDto, data);
        const errors = await validate(dto);
        expect(
          errors.some((error) => error.property === property),
        ).toBeTruthy();
      });
    });
  });

  describe('updateUser', () => {
    const userId = 1;
    const updateUserDto: UpdateUserDto = { name: 'Updated Name' };
    const updatedUser: Partial<User> = { id: userId, name: 'Updated Name' };

    it('should update user successfully', async () => {
      mockUserClient.send.mockReturnValue(of(updatedUser));

      const result = await controller.updateUser(userId, updateUserDto);

      expect(mockUserClient.send).toHaveBeenCalledWith(
        { cmd: 'update_user_info' },
        {
          id: userId,
          updateUserDto: { ...updateUserDto },
          lang: 'vi',
        },
      );
      expect(result.data).toEqual(updatedUser);
    });

    it('should return failure response on error', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const errorMessage = 'user.UPDATE_FAILED';
      mockUserClient.send.mockReturnValue(
        throwError(() => new RpcException(errorMessage)),
      );

      const result = await controller.updateUser(userId, updateUserDto);

      expect(result).toEqual({
        status: false,
        message: errorMessage,
      });
      loggerSpy.mockRestore();
    });

    describe('UpdateUserDto validation', () => {
      it('should pass validation with empty object', async () => {
        const dto = createDto(UpdateUserDto, {});
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });

      it('should fail if email is invalid', async () => {
        const dto = createDto(UpdateUserDto, { email: 'invalid-email' });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'email')).toBeTruthy();
      });

      it('should fail if password is too short', async () => {
        const dto = createDto(UpdateUserDto, { password: '123' });
        const errors = await validate(dto);
        expect(
          errors.some((error) => error.property === 'password'),
        ).toBeTruthy();
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const deleteResponse = { id: 1 };
      mockUserClient.send.mockReturnValue(of(deleteResponse));

      const result = await controller.deleteUser(1);

      expect(mockUserClient.send).toHaveBeenCalledWith(
        { cmd: 'delete_user' },
        { id: 1, lang: 'vi' },
      );
      expect(result.data).toEqual(deleteResponse);
    });

    it('should throw HttpException on failure', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const errorMessage = 'User not found';
      mockUserClient.send.mockReturnValue(
        throwError(() => new RpcException(errorMessage)),
      );

      await expect(controller.deleteUser(1)).resolves.toEqual({
        status: false,
        message: 'user.DELETE_FAILED',
      });
      loggerSpy.mockRestore();
    });
  });
});
