import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '@/crosscutting/config';

export interface JwtPayload {
  sub: string;
  username?: string;
}

export interface JwtValidatedUser {
  id: string;
  username?: string;
}

/**
 * Estratégia Passport JWT.
 * Placeholder: valida token e retorna usuário mínimo a partir do payload (sub → id).
 * Em produção, injetar UsersService e buscar usuário por id no DB.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.jwtSecret ?? 'placeholder-secret-change-in-production',
    });
  }

  validate(payload: JwtPayload): JwtValidatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Payload inválido');
    }
    return {
      id: payload.sub,
      username: payload.username,
    };
  }
}
