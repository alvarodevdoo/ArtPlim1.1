# Diretrizes de Git e Ambiente
- NUNCA utilize ou recomende comandos relacionados a `git worktree`.
- Realize todas as operações diretamente no diretório principal do repositório.
- Se for necessário isolar o contexto de uma feature, crie uma branch padrão usando `git checkout -b <nome-da-feature>` e trabalhe nela.
- Não altere o arquivo `.gitignore` para acomodar pastas de sessão do agente.

# Padrões de Arquitetura e Código (SOLID e Modularidade)
1. Princípios SOLID: Garanta que cada classe/componente possua uma responsabilidade única (SRP), dependa de abstrações em vez de implementações (DIP) e mantenha interfaces pequenas e limpas (ISP).
2. Estrutura de Pacotes (Package by Feature): Mantenha os arquivos organizados por funcionalidade (ex: `/user`, `/payment`). Cada pacote deve conter seu próprio controller, service, repository e DTO. Extraia lógica reutilizável para o módulo `/shared`.
3. Frontend: Componentize as páginas isolando formulários, listas e modais. NUNCA remova campos de entrada, IDs ou redundâncias visuais sem solicitar minha confirmação prévia, mesmo em etapas de refatoração ou otimização.
4. Entregue SEMPRE o código completo da versão refatorada ao aplicar melhorias.

# Backup e Restauração (.bdb)

## Escopo dos módulos exportáveis
Cada checkbox no painel "Backup e Restauração" corresponde a um conjunto de tabelas Prisma definido em `backend/src/modules/backup/useCases/ExportBackupUseCase.ts` (`moduleMap`):

| Módulo UI            | Chave    | Tabelas incluídas                                                                                                  | Default |
|----------------------|----------|--------------------------------------------------------------------------------------------------------------------|---------|
| Configurações        | config   | organization, organizationSettings, automationRule                                                                 | ✅      |
| Clientes/Usuários    | profiles | profile, user                                                                                                      | ✅      |
| Insumos/Estoque      | materials| materialType, material, insumoFornecedor, materialSupplier, inventoryItem, inventoryMovement                       | ✅      |
| Produtos/Catálogo    | products | pricingRule, product, productComponent, productConfiguration, configurationOption, fichaTecnicaInsumo              | ✅      |
| Produção             | production| processStatus, machine, productionQueue, productionOperation                                                      | ✅      |
| Vendas               | sales    | budget, budgetItem, order, orderItem, delivery, deliveryItem                                                       | ✅      |
| Financeiro           | finance  | account, chartOfAccount, category, paymentMethod, transaction, accountPayable, accountReceivable                   | ✅      |
| Auditoria (logs)     | audit    | auditLog                                                                                                           | ❌      |

## Soft-delete
O schema NÃO usa colunas `deletedAt`/`isDeleted`. A "exclusão lógica" é representada por flag `active: Boolean` em models como `Material`, `User` etc. O backup NÃO filtra por `active`, ou seja, registros inativos ("excluídos logicamente") são incluídos para que a restauração seja fiel ao estado completo do banco.

## Auditoria (módulo `audit`)
- O model `AuditLog` registra ações com `oldValues`/`newValues` (ver `prisma/schema.prisma`).
- Por ser potencialmente volumoso, vem **desmarcado por padrão** na UI. Marque manualmente quando precisar de forense/compliance.
- Na restauração, é importado por último (`ImportBackupUseCase.executionOrder`) porque depende de `user`/`profile` já restaurados.

## Exportação descriptografada
- Disponível apenas para `role` `OWNER` ou `ADMIN` (validado tanto no front quanto em `BackupController.export`).
- Gera ZIP puro com extensão `.bdb` — renomear para `.zip` para abrir. Contém todos os dados em texto claro; trate como segredo.

## Ao adicionar um novo módulo
1. Adicione a chave em `BackupModule` (`backend/src/modules/backup/backup.types.ts`).
2. Mapeie as tabelas em `ExportBackupUseCase.moduleMap` (e filtros `where` específicos no `switch` se a tabela não tiver `organizationId` direto).
3. Inclua na `executionOrder` de `ImportBackupUseCase` respeitando dependências de FK.
4. Adicione entradas em `allModules` e `fileNameMap`/`fileNameMapRev` em `BackupController`.
5. Adicione ao `useState` inicial em `frontend/src/pages/Configuracoes.tsx` e ao label do checkbox em `BackupManager.tsx`.
6. Se houver chave única composta, registre o mapper em `ImportBackupUseCase.getUniqueWhereClause` (fallback é `{ id }`).