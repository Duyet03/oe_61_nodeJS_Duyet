import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';
import { LIMIT, ListUserDto, PAGE, UpdateUserDto } from '@app/common';
import { CreateUserDto } from '@app/common/dto/create-user.dto';
import { RpcException } from '@nestjs/microservices';
import { I18nService } from 'nestjs-i18n';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  async listUsers(listUserDto: ListUserDto) {
    const { page = PAGE, limit = LIMIT, search } = listUserDto;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    queryBuilder.select([
      'user.id',
      'user.name',
      'user.email',
      'user.phone',
      'user.avatar',
      'user.status',
      'user.created_at',
      'role.name',
    ]);

    queryBuilder.leftJoin('user.role', 'role');

    if (search) {
      const escapeSearch = search.replace(/[%_]/g, (s) => `\\${s}`);
      queryBuilder.where(
        "(LOWER(user.name) LIKE LOWER(:search) ESCAPE '\\' OR LOWER(user.email) LIKE LOWER(:search) ESCAPE '\\')",
        { search: `%${escapeSearch}%` },
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async create(payload: {
    createUserDto: CreateUserDto;
    lang: string;
    imageUrl: string | null;
  }) {
    const { createUserDto, lang, imageUrl } = payload;

    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new RpcException({
        message: this.i18n.t('user.EXISTS', { lang }),
        status: 409,
      });
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const createdUser = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      avatar: imageUrl,
    });

    return this.userRepository.save(createdUser);
  }

  async updateUserInfo(
    id: number,
    updateUserDto: UpdateUserDto,
    lang: string,
  ): Promise<User | null> {
    const existingUser = await this.userRepository.findOneBy({ id });
    if (!existingUser) {
      throw new RpcException({
        message: this.i18n.t('user.NOT_FOUND', { lang, args: { id } }),
        status: 404,
      });
    }
    await this.userRepository.update(id, updateUserDto);

    return await this.userRepository.findOneBy({ id });
  }

  async deleteUser(id: number, lang: string): Promise<User | null> {
    const existingUser = await this.userRepository.findOneBy({ id });
    if (!existingUser) {
      throw new RpcException({
        message: this.i18n.t('user.NOT_FOUND', { lang, args: { id } }),
        status: 404, // Not Found
      });
    }
    await this.userRepository.delete(id);
    return existingUser;
  }
}
