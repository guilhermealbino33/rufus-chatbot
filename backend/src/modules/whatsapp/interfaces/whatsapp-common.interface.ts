import { WhatsappSession } from '../entities/whatsapp-session.entity';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface SessionStatusResponse {
  session: WhatsappSession;
  isClientActive: boolean;
  connectionState: string;
}

export interface QRCodeResponse {
  qrCode?: string;
  status: string;
  message?: string;
}

/**
 * @todo
 * Futuramente mover para interface de paginação genérica
 */
export interface PaginationResponse<T> {
  data: T[];
  pages: number;
  total: number;
}
