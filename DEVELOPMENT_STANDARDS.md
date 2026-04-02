# Diretrizes de Desenvolvimento - ArtPlimERP

Este documento define os padrões obrigatórios de arquitetura e código para toda e qualquer implementação no projeto. **Sempre verifique estas regras antes de iniciar uma nova feature ou refatoração.**

## 1. Princípios SOLID
Toda lógica de negócio e interface deve aspirar aos seguintes critérios:
- **S (Single Responsibility):** Cada classe, hook ou componente deve ter uma única e clara responsabilidade. Se um componente faz mais de uma coisa, deve ser dividido.
- **O (Open/Closed):** O código deve ser extensível sem a necessidade de modificar o core existente (ex: uso de padrões Strategy ou Factory).
- **I (Interface Segregation):** Componentes e funções não devem depender de propriedades que não utilizam. Use interfaces enxutas.
- **D (Dependency Inversion):** Dependa de abstrações/interfaces, não de implementações concretas (ex: injetar serviços via props ou hooks).

## 2. Estrutura: Package by Feature
Organize o código em torno das funcionalidades do negócio, não por tipos técnicos.
- **Localização:** `src/features/[feature-name]/`
- **Conteúdo do Pacote:**
  - `components/`: UI específica da feature.
  - `services/` / `useCases/`: Lógica de negócio e chamadas de API.
  - `hooks/`: Gerenciamento de estado isolado.
  - `types/`: Interfaces e DTOs específicos.
- **Módulo Shared:** Extraia lógicas repetitivas (formatação de data, validações comuns) para `src/shared/`.

## 3. Componentização de UI
Evite "God Components" (componentes gigantes).
- **Divisão:** Divida páginas em formulários, listas, modais e sub-layouts.
- **Pureza:** Prefira componentes que recebam dados via props para facilitar testes e reutilização.
- **Tamanho:** Se um componente ultrapassar ~150-200 linhas de JSX, avalie a extração de sub-componentes.

## 4. Manutenibilidade e Legibilidade
- **Clean Code:** Use nomes descritivos para variáveis e funções.
- **Documentação:** Comente o "porquê" de decisões complexas, não o "quê" (o código deve ser legível por si só).
- **Padrão:** Mantenha a consistência visual e técnica com os módulos já refatorados (ex: `Configuracoes.tsx`).

---
*Assinado: Antigravity AI & Usuário*
