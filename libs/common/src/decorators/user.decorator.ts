import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import {
  AuthRequest,
  JwtPayload,
} from '@app/common/constants/database.constants';

// Extend Express Request with user

export const User = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | string | number => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    const lang = I18nContext.current()?.lang || 'vi';
    const user = request.user;

    if (!user) {
      const i18n = I18nContext.current(ctx);
      const message =
        i18n?.t('auth.USER_NOT_LOGGED_IN', { lang }) || 'User not logged in';
      throw new UnauthorizedException(message);
    }

    return data ? user[data] : user;
  },
);
