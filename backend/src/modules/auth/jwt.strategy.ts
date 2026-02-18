import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET_CONFIG_KEY } from './constants';

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
 * Placeholder: valida token e retorna usuário mínimo a partir do payload (sub -> id).
 * Em produção, injetar UsersService e buscar usuário por id no DB.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const secret =
      configService.get<string>(JWT_SECRET_CONFIG_KEY) ?? 'placeholder-secret-change-in-production';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
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
