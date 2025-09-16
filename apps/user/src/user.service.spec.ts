/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';
import { UpdateUserDto } from '@app/common';
import { CreateUserDto } from '@app/common/dto/create-user.dto';
import { createMock } from '@golevelup/ts-jest';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let i18n: I18nService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: createMock<Repository<User>>({
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          }),
        },
        {
          provide: I18nService,
          useValue: { t: jest.fn().mockImplementation((key) => key) },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
    i18n = module.get<I18nService>(I18nService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- listUsers ---
  describe('listUsers', () => {
    it('should apply default pagination when no params provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.listUsers({});
      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should apply search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.listUsers({ search: 'John' });
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.listUsers({ page: 3, limit: 20 });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(40);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should return proper structure', async () => {
      const users = [{ id: 1, name: 'A' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([users, 30]);
      const res = await service.listUsers({ page: 2, limit: 15 });
      expect(res.data).toEqual(users);
      expect(res.meta.last_page).toBe(2);
    });

    it('should throw if repo fails', async () => {
      const err = new Error('DB error');
      mockQueryBuilder.getManyAndCount.mockRejectedValue(err);
      await expect(service.listUsers({})).rejects.toThrow(err);
    });
  });

  // --- create ---
  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'test@example.com',
      password: '123456',
      name: 'John',
      role_id: 3,
    };

    it('should throw if user already exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 } as User);
      await expect(
        service.create({ createUserDto: dto, lang: 'en', imageUrl: null }),
      ).rejects.toThrow(RpcException);
      expect(i18n.t).toHaveBeenCalledWith('user.EXISTS', { lang: 'en' });
    });

    it('should hash password and save new user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      const created = { id: 1, email: dto.email } as User;
      userRepository.create.mockReturnValue(created);
      userRepository.save.mockResolvedValue(created);

      const result = await service.create({
        createUserDto: dto,
        lang: 'en',
        imageUrl: 'http://img',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          password: 'hashed_pw',
          avatar: 'http://img',
        }),
      );
      expect(result).toEqual(created);
    });
  });

  // --- updateUserInfo ---
  describe('updateUserInfo', () => {
    const dto: UpdateUserDto = { name: 'Updated' };

    it('should throw if user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.updateUserInfo(1, dto, 'en')).rejects.toThrow(
        RpcException,
      );
      expect(i18n.t).toHaveBeenCalledWith('user.NOT_FOUND', {
        lang: 'en',
        args: { id: 1 },
      });
    });

    it('should update and return updated user', async () => {
      const existing = { id: 1, name: 'Old' } as User;
      const updated = { id: 1, name: 'Updated' } as User;
      userRepository.findOneBy.mockResolvedValueOnce(existing); // check existence
      userRepository.update.mockResolvedValue({} as any);
      userRepository.findOneBy.mockResolvedValueOnce(updated); // fetch updated

      const result = await service.updateUserInfo(1, dto, 'en');
      expect(userRepository.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(updated);
    });
  });

  // --- deleteUser ---
  describe('deleteUser', () => {
    it('should throw if user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.deleteUser(1, 'en')).rejects.toThrow(RpcException);
      expect(i18n.t).toHaveBeenCalledWith('user.NOT_FOUND', {
        lang: 'en',
        args: { id: 1 },
      });
    });

    it('should delete and return existing user', async () => {
      const existing = { id: 1 } as User;
      userRepository.findOneBy.mockResolvedValue(existing);
      userRepository.delete.mockResolvedValue({} as any);

      const result = await service.deleteUser(1, 'en');
      expect(userRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual(existing);
    });
  });
});
