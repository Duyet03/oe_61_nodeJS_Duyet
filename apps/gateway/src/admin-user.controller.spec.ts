/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserController } from './admin-user.controller';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateUserDto,
  JwtAuthGuard,
  ListUserDto,
  RolesGuard,
  UpdateUserDto,
} from '@app/common';

// --- Mocks ---
const mockUserClient = { send: jest.fn() };
const mockUploadClient = { send: jest.fn() };
const mockI18nService = { t: jest.fn().mockImplementation((key) => key) };

jest.mock('nestjs-i18n', () => ({
  I18nModule: { forRoot: jest.fn() },
  I18nContext: { current: jest.fn() },
}));

describe('AdminUserController', () => {
  let controller: AdminUserController;
  let userClient: ClientProxy;
  let uploadClient: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    controller = module.get<AdminUserController>(AdminUserController);
    userClient = module.get<ClientProxy>('USER_SERVICE');
    uploadClient = module.get<ClientProxy>('UPLOAD_SERVICE');

    (I18nContext.current as jest.Mock).mockReturnValue({ lang: 'vi' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- listUsers ---
  describe('listUsers', () => {
    it('should call userClient.send and return result', (done) => {
      const dto: ListUserDto = { page: 1, limit: 10, search: 'test' };
      const response = { data: [], total: 0 };
      jest.spyOn(userClient, 'send').mockReturnValue(of(response));

      controller.listUsers(dto).subscribe((res) => {
        expect(res).toEqual(response);
        expect(userClient.send).toHaveBeenCalledWith({ cmd: 'list_users' }, dto);
        done();
      });
    });

    it('should propagate errors', async () => {
      const dto: ListUserDto = {};
      const rpcError = new RpcException('Error');
      jest.spyOn(userClient, 'send').mockReturnValue(throwError(() => rpcError));

      const result$ = controller.listUsers(dto);
      await expect(result$.toPromise()).rejects.toThrow(rpcError);
    });
  });

  // --- createUser ---
  describe('createUser', () => {
    const createUserDto: CreateUserDto = { name: 'User', email: 'test@test.com', password: '123456', role_id: 1 };

    it('should create user with avatar', async () => {
      const mockAvatar = { originalname: 'avatar.jpg' } as Express.Multer.File;
      jest.spyOn(uploadClient, 'send').mockReturnValue(of({ url: 'http://image.url' }));
      jest.spyOn(userClient, 'send').mockReturnValue(of({ id: 1, ...createUserDto }));

      const res = await controller.createUser(createUserDto, mockAvatar);
      expect(uploadClient.send).toHaveBeenCalled();
      expect(userClient.send).toHaveBeenCalled();
      expect(res.status).toBe(true);
      expect(res.data).toHaveProperty('id');
    });

    it('should create user without avatar', async () => {
      jest.spyOn(userClient, 'send').mockReturnValue(of({ id: 1, ...createUserDto }));
      const res = await controller.createUser(createUserDto, undefined);
      expect(uploadClient.send).not.toHaveBeenCalled();
      expect(res.status).toBe(true);
    });

    it('should handle uploadClient.send error', async () => {
      const mockAvatar = { originalname: 'avatar.jpg' } as Express.Multer.File;
      jest.spyOn(uploadClient, 'send').mockReturnValue(throwError(() => new Error('Upload failed')));

      const res = await controller.createUser(createUserDto, mockAvatar);
      expect(res.status).toBe(false);
      expect(res.message).toBe('Upload failed');
    });

    it('should handle userClient.send error', async () => {
      jest.spyOn(userClient, 'send').mockReturnValue(throwError(() => new Error('Create failed')));
      const res = await controller.createUser(createUserDto, undefined);
      expect(res.status).toBe(false);
      expect(res.message).toBe('Create failed');
    });

    describe('DTO validation', () => {
      const createDto = (data: any) => plainToInstance(CreateUserDto, data);

      it('should fail if name is missing', async () => {
        const dto = createDto({ email: 'test@test.com', password: '123456', role_id: 1 });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'name')).toBeTruthy();
      });

      it('should fail if email is missing', async () => {
        const dto = createDto({ name: 'Test', password: '123456', role_id: 1 });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'email')).toBeTruthy();
      });

      it('should fail if password is missing', async () => {
        const dto = createDto({ name: 'Test', email: 'a@b.com', role_id: 1 });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'password')).toBeTruthy();
      });

      it('should fail if role_id is missing', async () => {
        const dto = createDto({ name: 'Test', email: 'a@b.com', password: '123456' });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'role_id')).toBeTruthy();
      });
    });
  });

  // --- updateUser ---
  describe('updateUser', () => {
    const updateUserDto: UpdateUserDto = { name: 'Updated' };
    const userId = 1;

    it('should update user without avatar', async () => {
      const updatedUser = { id: userId, ...updateUserDto };
      jest.spyOn(userClient, 'send').mockReturnValue(of(updatedUser));

      const res = await controller.updateUser(userId, updateUserDto);
      expect(userClient.send).toHaveBeenCalled();
      expect(res.status).toBe(true);
      expect(res.data).toEqual(updatedUser);
    });

    it('should update user with avatar', async () => {
      const mockAvatar = { originalname: 'avatar.jpg' } as Express.Multer.File;
      jest.spyOn(uploadClient, 'send').mockReturnValue(of({ url: 'http://image.url' }));
      jest.spyOn(userClient, 'send').mockReturnValue(of({ id: userId, ...updateUserDto, avatar: 'http://image.url' }));

      const res = await controller.updateUser(userId, updateUserDto, mockAvatar);
      expect(uploadClient.send).toHaveBeenCalled();
      expect(res.status).toBe(true);
      expect(res.data?.avatar).toBe('http://image.url');
    });

    it('should handle userClient.send error', async () => {
      jest.spyOn(userClient, 'send').mockReturnValue(throwError(() => new Error('Update failed')));
      const res = await controller.updateUser(userId, updateUserDto);
      expect(res.status).toBe(false);
      expect(res.message).toBe('Update failed');
    });

    it('should handle uploadClient.send error', async () => {
      const mockAvatar = { originalname: 'avatar.jpg' } as Express.Multer.File;
      jest.spyOn(uploadClient, 'send').mockReturnValue(throwError(() => new Error('Upload failed')));
      const res = await controller.updateUser(userId, updateUserDto, mockAvatar);
      expect(res.status).toBe(false);
      expect(res.message).toBe('Upload failed');
    });

    // DTO validation
    describe('UpdateUserDto validation', () => {
      const createUpdateDto = (data: any) => plainToInstance(UpdateUserDto, data);

      it('should pass if empty object', async () => {
        const dto = createUpdateDto({});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('should fail if email invalid', async () => {
        const dto = createUpdateDto({ email: 'abc' });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'email')).toBeTruthy();
      });

      it('should fail if password too short', async () => {
        const dto = createUpdateDto({ password: '123' });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'password')).toBeTruthy();
      });
    });
  });

  // --- deleteUser ---
  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const deleteResponse = { affected: 1 };
      jest.spyOn(userClient, 'send').mockReturnValue(of(deleteResponse));

      const res = await controller.deleteUser(1);
      expect(userClient.send).toHaveBeenCalledWith({ cmd: 'delete_user' }, { id: 1, lang: 'vi' });
      expect(res.status).toBe(true);
      expect(res.data).toEqual(deleteResponse);
    });

    it('should propagate RpcException', async () => {
      const rpcError = new RpcException('User not found');
      jest.spyOn(userClient, 'send').mockReturnValue(throwError(() => rpcError));

      await expect(controller.deleteUser(1)).rejects.toThrow(rpcError);
    });

    it('should handle other errors in catch', async () => {
      jest.spyOn(userClient, 'send').mockReturnValue(throwError(() => new Error('Unknown error')));
      await expect(controller.deleteUser(1)).rejects.toThrow('Unknown error');
    });
  });
});
