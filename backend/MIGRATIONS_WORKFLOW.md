# Fluxo de Trabalho de Migrações de Banco de Dados

Este projeto utiliza Migrações do TypeORM para gerenciar alterações no esquema do banco de dados com segurança. O recurso `synchronize: true` foi desativado para garantir a integridade absoluta dos dados.

## Fluxo de Trabalho Obrigatório

Siga estes passos para qualquer alteração no esquema do banco de dados (adicionar colunas, tabelas ou alterar tipos):

1. **Modificar a Entidade**: Faça as alterações necessárias no arquivo `.entity.ts`.
2. **Gerar a Migração**: Execute o seguinte comando para criar um arquivo de migração:
   ```bash
   npm run migration:generate -- src/crosscutting/database/migrations/NomeDaSuaMigracao
   ```
3. **Revisar o Arquivo**: Abra o arquivo gerado em `src/crosscutting/database/migrations/` e verifique os métodos `up` e `down`.
4. **Executar a Migração**: Aplique as alterações no seu banco de dados local:
   ```bash
   npm run migration:run
   ```
5. **Commit**: Inclua tanto as alterações na entidade quanto o arquivo de migração no seu commit do Git.

## Comandos Disponíveis

- `npm run migration:generate`: Gera uma migração comparando as entidades com o banco de dados.
- `npm run migration:run`: Executa todas as migrações pendentes.
- `npm run migration:revert`: Reverte a última migração executada.
- `npm run migration:create`: Cria uma migração vazia para SQL ou lógica customizada.

> [!IMPORTANT]
> Jamais altere o esquema do banco de dados manualmente em produção. Todas as alterações devem obrigatoriamente passar por um arquivo de migração.
