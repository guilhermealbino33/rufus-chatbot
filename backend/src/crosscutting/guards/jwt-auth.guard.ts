import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Guard que protege rotas com JWT via Passport.
 * Placeholder: quando JWT_SECRET não estiver configurado, pode ser configurado
 * para permitir acesso (não bloquear rotas até a auth estar ativa).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException('Token inválido ou ausente');
    }
    return user;
  }
}
