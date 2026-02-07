import { Exists } from 'src/shared/common/decorators';

export class DeleteSessionDTO {
    /**
     * @todo testar validação
     */
    @Exists({ tableName: 'whatsapp_sessions', column: 'session_name' })
    sessionName: string;
}