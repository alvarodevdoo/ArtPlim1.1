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