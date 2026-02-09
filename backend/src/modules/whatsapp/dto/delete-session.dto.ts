import { Exists } from 'src/shared/common/decorators';

export class DeleteSessionDTO {
  /**
   * @todo
   * atualment estamos trabalhando sem migrations, então o @Exists está funcionando com o nome da tabela e coluna no banco de dados
   * quando começarmos a trabalhar com migrations, precisaremos atualizar o @Exists para usar o nome da entidade e da propriedade
   */
  @Exists({ tableName: 'whatsapp_sessions', column: 'session_name' })
  sessionName: string;
}
