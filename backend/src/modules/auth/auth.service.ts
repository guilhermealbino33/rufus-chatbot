import { Injectable } from '@nestjs/common';

export interface ValidateUserResult {
  id: string;
  username: string;
}

/**
 * Serviço de autenticação.
 * Placeholder: validateUser mock retorna usuário fixo quando password não vazio.
 * Na próxima fase, injetar repositório de usuários e validar contra DB (ex.: bcrypt).
 */
@Injectable()
export class AuthService {
  /**
   * Valida credenciais e retorna o usuário ou null.
   * Mock: aceita qualquer username com password não vazio e retorna usuário fixo.
   */
  async validateUser(username: string, password: string): Promise<ValidateUserResult | null> {
    if (!password?.trim()) {
      return null;
    }
    return {
      id: '1',
      username: username || 'mock-user',
    };
  }
}
