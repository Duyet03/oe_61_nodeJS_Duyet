import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { VnpayService } from '../vnpay/vnpay.service';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: path.join(process.cwd(), 'libs/common/src/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.get<string>('REDIS_URL'),
        }),
      }),
      isGlobal: true,
    }),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: './.env' }),
  ],
  providers: [CommonService, VnpayService],
  exports: [CommonService, CacheModule, VnpayService],
})
export class CommonModule {}
