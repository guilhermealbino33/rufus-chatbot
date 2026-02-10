import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { WhatsappClientFactory } from './whatsapp-client.factory';
import { WhatsappClientConfig } from '../config/whatsapp-client.config';

/**
 * Gerenciador de ciclo de vida dos clientes WPPConnect
 *
 * Responsável por:
 * - Armazenar instâncias ativas em memória (Map)
 * - Criar clientes via Factory quando necessário
 * - Prevenir duplicação de instâncias
 * - Gerenciar fechamento e cleanup de recursos
 * - Implementar OnModuleDestroy para cleanup automático
 *
 * Esta classe implementa o padrão Manager/Registry para centralizar
 * o controle de todas as instâncias ativas do WPPConnect.
 */
@Injectable()
export class WhatsappClientManager implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappClientManager.name);
  private readonly clients = new Map<string, wppconnect.Whatsapp>();

  constructor(private readonly factory: WhatsappClientFactory) {}

  /**
   * Obtém um cliente existente da memória
   *
   * @param sessionName - Nome da sessão
   * @returns Instância do cliente ou undefined se não existir
   */
  getClient(sessionName: string): wppconnect.Whatsapp | undefined {
    return this.clients.get(sessionName);
  }

  /**
   * Verifica se um cliente existe em memória
   *
   * @param sessionName - Nome da sessão
   * @returns true se o cliente existe, false caso contrário
   */
  hasClient(sessionName: string): boolean {
    return this.clients.has(sessionName);
  }

  /**
   * Cria e armazena um novo cliente WPPConnect
   *
   * Previne duplicação: se o cliente já existe, retorna o existente.
   *
   * @param sessionName - Nome da sessão
   * @param config - Configuração do cliente
   * @returns Promise com a instância do cliente
   */
  async createClient(
    sessionName: string,
    config: WhatsappClientConfig,
  ): Promise<wppconnect.Whatsapp> {
    // Previne duplicação de instâncias
    if (this.clients.has(sessionName)) {
      this.logger.warn(`⚠️ Client for ${sessionName} already exists. Returning existing instance.`);
      return this.clients.get(sessionName)!;
    }

    // Delega criação ao Factory
    const client = await this.factory.create(config);

    // Armazena em memória
    this.clients.set(sessionName, client);

    this.logger.log(`📦 Client stored in memory for: ${sessionName} (Total: ${this.clients.size})`);

    return client;
  }

  /**
   * Remove e fecha um cliente
   *
   * Garante que o cliente seja fechado corretamente antes de removê-lo
   * da memória, prevenindo vazamento de recursos.
   *
   * @param sessionName - Nome da sessão
   */
  async removeClient(sessionName: string): Promise<void> {
    const client = this.clients.get(sessionName);

    if (!client) {
      this.logger.warn(`⚠️ No client found for ${sessionName} to remove`);
      return;
    }

    try {
      await client.close();
      this.logger.log(`✅ Client closed for: ${sessionName}`);
    } catch (error) {
      this.logger.error(`❌ Error closing client for ${sessionName}:`, error);
    } finally {
      // Remove da memória mesmo se o close falhar
      this.clients.delete(sessionName);
      this.logger.log(
        `🗑️ Client removed from memory: ${sessionName} (Remaining: ${this.clients.size})`,
      );
    }
  }

  /**
   * Verifica se o cliente está conectado ao WhatsApp
   *
   * Remove automaticamente clientes "mortos" (que lançam erro ao verificar status).
   *
   * @param sessionName - Nome da sessão
   * @returns Promise<boolean> indicando se está conectado
   */
  async isClientConnected(sessionName: string): Promise<boolean> {
    const client = this.clients.get(sessionName);
    if (!client) return false;

    try {
      return await client.isConnected();
    } catch (error) {
      this.logger.error(`❌ Error checking connection for ${sessionName}:`, error.message);
      // Remove cliente morto da memória
      this.clients.delete(sessionName);
      return false;
    }
  }

  /**
   * Obtém o estado de conexão detalhado do cliente
   *
   * @param sessionName - Nome da sessão
   * @returns Promise com o estado de conexão ou null se não existir
   */
  async getConnectionState(sessionName: string): Promise<string | null> {
    const client = this.clients.get(sessionName);
    if (!client) return null;

    try {
      return await client.getConnectionState();
    } catch (error) {
      this.logger.error(`❌ Error getting connection state for ${sessionName}:`, error.message);
      return null;
    }
  }

  /**
   * Fecha todos os clientes ativos
   *
   * Utilizado para cleanup geral (ex: shutdown da aplicação).
   * Usa Promise.allSettled para garantir que todos sejam processados
   * mesmo se alguns falharem.
   */
  async closeAll(): Promise<void> {
    const totalClients = this.clients.size;

    if (totalClients === 0) {
      this.logger.log('No active clients to close');
      return;
    }

    this.logger.log(`🔄 Closing all ${totalClients} active clients...`);

    const closePromises = Array.from(this.clients.keys()).map((sessionName) =>
      this.removeClient(sessionName),
    );

    const results = await Promise.allSettled(closePromises);

    const failed = results.filter((r) => r.status === 'rejected').length;
    const success = results.filter((r) => r.status === 'fulfilled').length;

    this.logger.log(`✅ Cleanup completed: ${success} closed successfully, ${failed} failed`);
  }

  /**
   * Lifecycle hook - cleanup automático ao destruir o módulo
   *
   * Garante que todos os clientes sejam fechados quando a aplicação
   * for encerrada, prevenindo processos órfãos do navegador.
   */
  async onModuleDestroy() {
    this.logger.log('🛑 Module destroying - cleaning up all clients...');
    await this.closeAll();
  }

  /**
   * Retorna estatísticas sobre os clientes ativos
   *
   * @returns Objeto com informações sobre clientes em memória
   */
  getStats(): { totalClients: number; sessionNames: string[] } {
    return {
      totalClients: this.clients.size,
      sessionNames: Array.from(this.clients.keys()),
    };
  }
}
