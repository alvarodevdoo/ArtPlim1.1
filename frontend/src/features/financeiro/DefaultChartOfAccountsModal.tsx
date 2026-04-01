import React, { useState, useEffect } from 'react';
import { Info, Check, X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DefaultChartOfAccountsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'REVENUE_DEDUCTION' | 'COST' | 'EXPENSE' | 'RESULT_CALCULATION' | 'CONTROL';
type AccountType = 'SYNTHETIC' | 'ANALYTIC';

interface AccountEntry {
  id: string;
  code: string;
  name: string;
  nature: AccountNature;
  type: AccountType;
  parentCode?: string;
  description?: string;
  systemRole?: 'GENERAL' | 'BANK_ACCOUNT' | 'INVENTORY' | 'REVENUE_SALE' | 'COST_EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'TAX' | 'FIXED_ASSET' | 'EQUITY';
}

// =============================================
// ESTRUTURA COMPLETA DO PLANO DE CONTAS SPED
// Árvore Contábil para Gráfica e Papelaria
// =============================================
const ALL_ACCOUNTS: AccountEntry[] = [
  // === 1. ATIVO ===
  { id: '1', code: '1', name: 'Ativo', nature: 'ASSET', type: 'SYNTHETIC', description: 'Representa tudo o que a empresa tem (Dinheiro, Equipamentos, Direitos de receber).' },
  { id: '1.1', code: '1.1', name: 'Ativo Circulante', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1', description: 'Recursos que vão girar no curto prazo (em até 12 meses).' },
  { id: '1.1.1', code: '1.1.1', name: 'Disponibilidades', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1.1', description: 'Dinheiro disponível para uso imediato (dinheiro físico e saldos bancários).' },
  { id: '1.1.1.01', code: '1.1.1.01', name: 'Caixa', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.1', systemRole: 'BANK_ACCOUNT', description: 'Dinheiro em espécie guardado na empresa.' },
  { id: '1.1.1.02', code: '1.1.1.02', name: 'Bancos Conta Movimento (Itaú, Nubank, etc.)', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.1', systemRole: 'BANK_ACCOUNT', description: 'Saldos em contas bancárias correntes da empresa.' },
  { id: '1.1.1.03', code: '1.1.1.03', name: 'Aplicações Financeiras de Liquidez Imediata', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.1', systemRole: 'BANK_ACCOUNT', description: 'Investimentos que podem ser resgatados a qualquer momento.' },
  { id: '1.1.2', code: '1.1.2', name: 'Contas a Receber', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1.1', description: 'Vendas que você já fez, mas que o cliente ainda não pagou.' },
  { id: '1.1.2.01', code: '1.1.2.01', name: 'Clientes Nacionais', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.2', systemRole: 'RECEIVABLE', description: 'Valores que sua empresa tem a receber de clientes localizados no Brasil.' },
  { id: '1.1.2.02', code: '1.1.2.02', name: 'Cartões de Crédito a Receber', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.2', systemRole: 'RECEIVABLE', description: 'Vendas feitas no cartão que a operadora ainda vai depositar na sua conta.' },
  { id: '1.1.3', code: '1.1.3', name: 'Estoques', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1.1', description: 'Produtos e materiais que você já comprou e estão guardados no seu estoque.' },
  { id: '1.1.3.01', code: '1.1.3.01', name: 'Estoque de Mercadorias para Revenda', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.3', systemRole: 'INVENTORY', description: 'Itens que você comprou prontos para vender diretamente.' },
  { id: '1.1.3.02', code: '1.1.3.02', name: 'Estoque de Matéria-Prima (Papel, Tintas, Filamentos)', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.3', systemRole: 'INVENTORY', description: 'Materiais que serão usados para produzir seus itens ou serviços.' },
  { id: '1.1.3.03', code: '1.1.3.03', name: 'Estoque de Produtos Acabados', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.1.3', systemRole: 'INVENTORY', description: 'Itens que já estão prontos, aguardando entrega ou retirada.' },
  { id: '1.2', code: '1.2', name: 'Ativo Não Circulante', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1', description: 'Bens de uso permanente (longo prazo) que ajudam a empresa a crescer.' },
  { id: '1.2.1', code: '1.2.1', name: 'Imobilizado', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1.2', description: 'O patrimônio físico: máquinas, móveis e veículos da empresa.' },
  { id: '1.2.1.01', code: '1.2.1.01', name: 'Máquinas e Equipamentos (Impressoras, Maquinário)', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.1', systemRole: 'FIXED_ASSET', description: 'Equipamentos físicos como máquinas e ferramentas de produção.' },
  { id: '1.2.1.02', code: '1.2.1.02', name: 'Móveis e Utensílios', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.1', systemRole: 'FIXED_ASSET', description: 'Mobiliário da empresa como mesas, cadeiras e armários.' },
  { id: '1.2.1.03', code: '1.2.1.03', name: 'Veículos', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.1', systemRole: 'FIXED_ASSET', description: 'Carros, motos ou vans usados na operação e entregas.' },
  { id: '1.2.1.04', code: '1.2.1.04', name: 'Equipamentos de Informática', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.1', systemRole: 'FIXED_ASSET', description: 'Computadores, monitores, servidores e redes da empresa.' },
  { id: '1.2.2', code: '1.2.2', name: 'Intangível', nature: 'ASSET', type: 'SYNTHETIC', parentCode: '1.2', description: 'Bens que não podemos tocar (como softwares e marcas), mas que têm valor.' },
  { id: '1.2.2.01', code: '1.2.2.01', name: 'Softwares e Licenças', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.2', systemRole: 'FIXED_ASSET', description: 'Licenças de programas e sistemas de gestão.' },
  { id: '1.2.2.02', code: '1.2.2.02', name: 'Marcas e Patentes', nature: 'ASSET', type: 'ANALYTIC', parentCode: '1.2.2', systemRole: 'FIXED_ASSET', description: 'A proteção legal do nome e da logo da sua marca.' },
  // === 2. PASSIVO ===
  { id: '2', code: '2', name: 'Passivo', nature: 'LIABILITY', type: 'SYNTHETIC', description: 'Representa todas as obrigações e dívidas que a empresa precisa pagar.' },
  { id: '2.1', code: '2.1', name: 'Passivo Circulante', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2', description: 'Dívidas que vencem nos próximos 12 meses.' },
  { id: '2.1.1', code: '2.1.1', name: 'Obrigações com Fornecedores', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2.1', description: 'Dívidas pendentes com empresas que te vendem matéria-prima ou serviços.' },
  { id: '2.1.1.01', code: '2.1.1.01', name: 'Fornecedores Nacionais', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.1', systemRole: 'PAYABLE', description: 'Pagamentos devidos a distribuidores e fabricantes dentro do Brasil.' },
  { id: '2.1.2', code: '2.1.2', name: 'Obrigações Trabalhistas e Previdenciárias', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2.1', description: 'Pagamentos relativos aos seus funcionários e encargos do governo.' },
  { id: '2.1.2.01', code: '2.1.2.01', name: 'Salários e Ordenados a Pagar', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.2', systemRole: 'PAYABLE', description: 'A folha de pagamento do mês que ainda não foi quitada.' },
  { id: '2.1.2.02', code: '2.1.2.02', name: 'INSS a Recolher', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.2', systemRole: 'TAX', description: 'A contribuição previdenciária descontada e devida ao governo.' },
  { id: '2.1.2.03', code: '2.1.2.03', name: 'FGTS a Recolher', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.2', systemRole: 'TAX', description: 'O fundo de garantia obrigatório para cada colaborador.' },
  { id: '2.1.2.04', code: '2.1.2.04', name: 'Férias e 13º Salário a Pagar', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.2', systemRole: 'PAYABLE', description: 'Reserva para o pagamento dos direitos anuais dos funcionários.' },
  { id: '2.1.3', code: '2.1.3', name: 'Obrigações Tributárias', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2.1', description: 'Impostos sobre o lucro e sobre as vendas pendentes de pagamento.' },
  { id: '2.1.3.01', code: '2.1.3.01', name: 'Simples Nacional a Recolher', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.3', systemRole: 'TAX', description: 'A guia unificada de impostos mensais da sua empresa.' },
  { id: '2.1.3.02', code: '2.1.3.02', name: 'ICMS / ISS a Recolher', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.1.3', systemRole: 'TAX', description: 'Impostos estaduais (sobre produtos) e municipais (sobre serviços).' },
  { id: '2.2', code: '2.2', name: 'Passivo Não Circulante', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2', description: 'Dívidas de longo prazo que vencem daqui a mais de um ano.' },
  { id: '2.2.1', code: '2.2.1', name: 'Empréstimos e Financiamentos', nature: 'LIABILITY', type: 'SYNTHETIC', parentCode: '2.2', description: 'Financiamentos bancários pesados para expansão do negócio.' },
  { id: '2.2.1.01', code: '2.2.1.01', name: 'Financiamentos de Máquinas/Veículos', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.2.1', systemRole: 'PAYABLE', description: 'Parcelas de financiamento ou leasing de bens de grande porte.' },
  { id: '2.2.1.02', code: '2.2.1.02', name: 'Empréstimos Bancários a Longo Prazo', nature: 'LIABILITY', type: 'ANALYTIC', parentCode: '2.2.1', systemRole: 'PAYABLE', description: 'Linhas de crédito para investimento parceladas em muitos meses.' },
  { id: '2.3', code: '2.3', name: 'Patrimônio Líquido', nature: 'EQUITY', type: 'SYNTHETIC', parentCode: '2', description: 'A riqueza real dos sócios na empresa após todas as dívidas serem pagas.' },
  { id: '2.3.1', code: '2.3.1', name: 'Capital Social', nature: 'EQUITY', type: 'SYNTHETIC', parentCode: '2.3', description: 'O valor inicial que os sócios investiram para abrir o negócio.' },
  { id: '2.3.1.01', code: '2.3.1.01', name: 'Capital Social Subscrito/Integralizado', nature: 'EQUITY', type: 'ANALYTIC', parentCode: '2.3.1', systemRole: 'EQUITY', description: 'O valor exato registrado no contrato social da empresa.' },
  { id: '2.3.2', code: '2.3.2', name: 'Reservas e Resultados', nature: 'EQUITY', type: 'SYNTHETIC', parentCode: '2.3', description: 'Lucros acumulados e reservas que a empresa mantém internamente.' },
  { id: '2.3.2.01', code: '2.3.2.01', name: 'Lucros ou Prejuízos Acumulados', nature: 'EQUITY', type: 'ANALYTIC', parentCode: '2.3.2', systemRole: 'EQUITY', description: 'A soma dos resultados (positivo ou negativo) de todos os anos.' },
  // === 3. RECEITAS ===
  { id: '3', code: '3', name: 'Receitas', nature: 'REVENUE', type: 'SYNTHETIC', description: 'Todo o dinheiro que entra na empresa através de vendas e serviços prestados.' },
  { id: '3.1', code: '3.1', name: 'Receita Bruta Operacional', nature: 'REVENUE', type: 'SYNTHETIC', parentCode: '3', description: 'Faturamento total antes de descontar impostos e devoluções.' },
  { id: '3.1.1', code: '3.1.1', name: 'Vendas e Serviços', nature: 'REVENUE', type: 'SYNTHETIC', parentCode: '3.1', description: 'O total acumulado de todos os pedidos vendidos e serviços prestados.' },
  { id: '3.1.1.01', code: '3.1.1.01', name: 'Receita com Venda de Produtos Acabados', nature: 'REVENUE', type: 'ANALYTIC', parentCode: '3.1.1', systemRole: 'REVENUE_SALE', description: 'Dinheiro vindo da venda de itens que você mesmo produz.' },
  { id: '3.1.1.02', code: '3.1.1.02', name: 'Receita com Venda de Mercadorias', nature: 'REVENUE', type: 'ANALYTIC', parentCode: '3.1.1', systemRole: 'REVENUE_SALE', description: 'Dinheiro vindo da revenda de itens comprados prontos.' },
  { id: '3.1.1.03', code: '3.1.1.03', name: 'Receita com Prestação de Serviços', nature: 'REVENUE', type: 'ANALYTIC', parentCode: '3.1.1', systemRole: 'REVENUE_SALE', description: 'Ganhos com mão de obra, instalações ou consultoria técnica.' },
  { id: '3.2', code: '3.2', name: 'Deduções da Receita', nature: 'REVENUE_DEDUCTION', type: 'SYNTHETIC', parentCode: '3', description: 'Valores que diminuem o faturamento bruto (impostos e cancelamentos).' },
  { id: '3.2.1', code: '3.2.1', name: 'Impostos Incidentes sobre Vendas', nature: 'REVENUE_DEDUCTION', type: 'SYNTHETIC', parentCode: '3.2', description: 'Quanto o governo leva diretamente de cada nota fiscal que você emite.' },
  { id: '3.2.1.01', code: '3.2.1.01', name: 'Simples Nacional sobre Vendas', nature: 'REVENUE_DEDUCTION', type: 'ANALYTIC', parentCode: '3.2.1', systemRole: 'TAX', description: 'A porcentagem fixa do Simples Nacional calculada sobre as vendas.' },
  { id: '3.2.1.02', code: '3.2.1.02', name: 'ICMS / ISS sobre Vendas', nature: 'REVENUE_DEDUCTION', type: 'ANALYTIC', parentCode: '3.2.1', systemRole: 'TAX', description: 'Impostos estaduais e municipais específicos recolhidos sobre o faturamento.' },
  { id: '3.2.2', code: '3.2.2', name: 'Devoluções e Descontos', nature: 'REVENUE_DEDUCTION', type: 'SYNTHETIC', parentCode: '3.2', description: 'Perdas de faturamento por erro de produção, devoluções ou negociação.' },
  { id: '3.2.2.01', code: '3.2.2.01', name: 'Devoluções de Vendas', nature: 'REVENUE_DEDUCTION', type: 'ANALYTIC', parentCode: '3.2.2', systemRole: 'COST_EXPENSE', description: 'Quando o cliente devolve o produto e você gera um estorno.' },
  { id: '3.2.2.02', code: '3.2.2.02', name: 'Descontos Incondicionais Concedidos', nature: 'REVENUE_DEDUCTION', type: 'ANALYTIC', parentCode: '3.2.2', systemRole: 'COST_EXPENSE', description: 'Descontos dados no momento da venda (no boleto ou nota).' },
  // === 4. CUSTOS ===
  { id: '4', code: '4', name: 'Custos', nature: 'COST', type: 'SYNTHETIC', description: 'Gastos DIRETOS para produzir ou vender. Se não houver venda, esse custo não existe.' },
  { id: '4.1', code: '4.1', name: 'Custos Operacionais', nature: 'COST', type: 'SYNTHETIC', parentCode: '4', description: 'O somatório de todos os gastos necessários para colocar a fábrica para rodar.' },
  { id: '4.1.1', code: '4.1.1', name: 'Custo dos Produtos Vendidos (CPV)', nature: 'COST', type: 'SYNTHETIC', parentCode: '4.1', description: 'Tudo o que você gastou (material, luz, salário) para produzir o que foi vendido.' },
  { id: '4.1.1.01', code: '4.1.1.01', name: 'Custo com Matéria-Prima', nature: 'COST', type: 'ANALYTIC', parentCode: '4.1.1', systemRole: 'COST_EXPENSE', description: 'Investimento em materiais e insumos básicos usados na produção.' },
  { id: '4.1.1.02', code: '4.1.1.02', name: 'Custo com Embalagens', nature: 'COST', type: 'ANALYTIC', parentCode: '4.1.1', systemRole: 'COST_EXPENSE', description: 'Materiais para proteger seu produto como plásticos, caixas e fitas.' },
  { id: '4.1.1.03', code: '4.1.1.03', name: 'Mão de Obra Direta (Produção)', nature: 'COST', type: 'ANALYTIC', parentCode: '4.1.1', systemRole: 'COST_EXPENSE', description: 'O salário dos profissionais que atuam diretamente na produção.' },
  { id: '4.1.1.04', code: '4.1.1.04', name: 'Custos Indiretos de Fabricação (Energia, manutenção)', nature: 'COST', type: 'ANALYTIC', parentCode: '4.1.1', systemRole: 'COST_EXPENSE', description: 'Gastos como a energia elétrica operacional e reparo de maquinário.' },
  { id: '4.1.2', code: '4.1.2', name: 'Custo dos Serviços Prestados (CSP)', nature: 'COST', type: 'SYNTHETIC', parentCode: '4.1', description: 'Custos atrelados especificamente à prestação de serviços externos ou internos.' },
  { id: '4.1.2.01', code: '4.1.2.01', name: 'Material Aplicado nos Serviços', nature: 'COST', type: 'ANALYTIC', parentCode: '4.1.2', systemRole: 'COST_EXPENSE', description: 'Materiais secundários e insumos usados especificamente em serviços executados.' },
  // === 5. DESPESAS ===
  { id: '5', code: '5', name: 'Despesas', nature: 'EXPENSE', type: 'SYNTHETIC', description: 'Gastos FIXOS para manter a empresa aberta (luz, aluguel, salários adm), independente de quanto você vende.' },
  { id: '5.1', code: '5.1', name: 'Despesas Operacionais', nature: 'EXPENSE', type: 'SYNTHETIC', parentCode: '5' },
  { id: '5.1.1', code: '5.1.1', name: 'Despesas Administrativas', nature: 'EXPENSE', type: 'SYNTHETIC', parentCode: '5.1', description: 'Gastos necessários para manter o escritório e a administração da empresa rodando.' },
  { id: '5.1.1.01', code: '5.1.1.01', name: 'Pró-labore dos Sócios', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.1', systemRole: 'COST_EXPENSE', description: 'O valor mensal fixo retirado pelos donos pelo trabalho na empresa.' },
  { id: '5.1.1.02', code: '5.1.1.02', name: 'Aluguel e Condomínio', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.1', systemRole: 'COST_EXPENSE', description: 'Custo do imóvel (ponto comercial) onde a empresa está instalada.' },
  { id: '5.1.1.03', code: '5.1.1.03', name: 'Água, Luz e Telefone/Internet', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.1', systemRole: 'COST_EXPENSE', description: 'Contas de consumo básico para manter a estrutura mínima do negócio.' },
  { id: '5.1.1.04', code: '5.1.1.04', name: 'Honorários Contábeis e Jurídicos', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.1', systemRole: 'COST_EXPENSE', description: 'Pagamento mensal do seu contador ou assessoria jurídica.' },
  { id: '5.1.1.05', code: '5.1.1.05', name: 'Material de Escritório e Limpeza', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.1', systemRole: 'COST_EXPENSE', description: 'Gastos com papelaria interna, café e produtos de limpeza do estabelecimento.' },
  { id: '5.1.2', code: '5.1.2', name: 'Despesas Comerciais e de Vendas', nature: 'EXPENSE', type: 'SYNTHETIC', parentCode: '5.1', description: 'Gastos feitos para atrair clientes, vender mais e entregar os pedidos.' },
  { id: '5.1.2.01', code: '5.1.2.01', name: 'Comissões sobre Vendas', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.2', systemRole: 'COST_EXPENSE', description: 'Percentual do faturamento pago aos seus vendedores.' },
  { id: '5.1.2.02', code: '5.1.2.02', name: 'Marketing e Publicidade', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.2', systemRole: 'COST_EXPENSE', description: 'Anúncios no Instagram/Google e confecção de portfólios da empresa.' },
  { id: '5.1.2.03', code: '5.1.2.03', name: 'Fretes e Entregas', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.2', systemRole: 'COST_EXPENSE', description: 'Gasto com motoboys ou transportadoras para fazer chegar o pedido ao cliente.' },
  { id: '5.1.3', code: '5.1.3', name: 'Despesas Financeiras', nature: 'EXPENSE', type: 'SYNTHETIC', parentCode: '5.1', description: 'O dinheiro que os bancos e operadoras levam da sua empresa.' },
  { id: '5.1.3.01', code: '5.1.3.01', name: 'Tarifas Bancárias e Taxas de Boletos', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.3', systemRole: 'COST_EXPENSE', description: 'Manutenção de conta e custos para emissão e liquidação de boletos.' },
  { id: '5.1.3.02', code: '5.1.3.02', name: 'Taxas de Máquinas de Cartão', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.3', systemRole: 'COST_EXPENSE', description: 'O percentual de desconto das operadoras de cartão em cada venda.' },
  { id: '5.1.3.03', code: '5.1.3.03', name: 'Juros e Multas Pagos', nature: 'EXPENSE', type: 'ANALYTIC', parentCode: '5.1.3', systemRole: 'COST_EXPENSE', description: 'Gastos extras decorrentes do atraso no pagamento de boletos ou impostos.' },
  // === 6. APURAÇÃO DE RESULTADO ===
  { id: '6', code: '6', name: 'Apuração de Resultado', nature: 'RESULT_CALCULATION', type: 'SYNTHETIC', description: 'Conta técnica usada no fechamento do ano para calcular o lucro líquido final.' },
  { id: '6.1', code: '6.1', name: 'Apuração do Resultado do Exercício', nature: 'RESULT_CALCULATION', type: 'SYNTHETIC', parentCode: '6', description: 'A conta final que resume se a empresa teve lucro ou prejuízo no ano.' },
  { id: '6.1.1', code: '6.1.1', name: 'Resultado do Exercício', nature: 'RESULT_CALCULATION', type: 'SYNTHETIC', parentCode: '6.1', description: 'O saldo líquido entre todas as suas receitas e todos os seus gastos.' },
  { id: '6.1.1.01', code: '6.1.1.01', name: 'Apuração do Resultado (ARE)', nature: 'RESULT_CALCULATION', type: 'ANALYTIC', parentCode: '6.1.1', systemRole: 'GENERAL', description: 'Registro técnico contábil do fechamento anual das contas.' },
  // === 9. CONTAS DE COMPENSAÇÃO ===
  { id: '9', code: '9', name: 'Contas de Compensação / Controle', nature: 'CONTROL', type: 'SYNTHETIC', description: 'Anotações obrigatórias sobre bens que não são seus, mas estão sob sua guarda.' },
  { id: '9.1', code: '9.1', name: 'Ativos Compensados', nature: 'CONTROL', type: 'SYNTHETIC', parentCode: '9', description: 'Bens de outras pessoas que estão fisicamente na sua empresa hoje.' },
  { id: '9.1.1', code: '9.1.1', name: 'Bens de Terceiros', nature: 'CONTROL', type: 'SYNTHETIC', parentCode: '9.1', description: 'Equipamentos ou materiais que você guarda para clientes ou parceiros.' },
  { id: '9.1.1.01', code: '9.1.1.01', name: 'Bens de Terceiros em Nosso Poder', nature: 'CONTROL', type: 'ANALYTIC', parentCode: '9.1.1', systemRole: 'GENERAL', description: 'Amostras de prova, máquinas em comodato ou arquivos em custódia.' },
  { id: '9.2', code: '9.2', name: 'Passivos Compensados', nature: 'CONTROL', type: 'SYNTHETIC', parentCode: '9', description: 'Registro de que esses bens de terceiros pertencem ao dono original.' },
  { id: '9.2.1', code: '9.2.1', name: 'Responsabilidades por Terceiros', nature: 'CONTROL', type: 'SYNTHETIC', parentCode: '9.2', description: 'O compromisso de garantir a integridade dos bens de terceiros guardados.' },
  { id: '9.2.1.01', code: '9.2.1.01', name: 'Contrapartida de Bens de Terceiros', nature: 'CONTROL', type: 'ANALYTIC', parentCode: '9.2.1', systemRole: 'GENERAL', description: 'Lançamento que anula o valor dos bens para não inflar seu patrimônio real.' },
];

const GROUPS = [
  { code: '1', label: '1 Ativo', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', accent: '#2563EB', description: 'Representa todos os bens e direitos da empresa (dinheiro em caixa, máquinas, estoques e o que você tem a receber).' },
  { code: '2', label: '2 Passivo & Patrimônio Líquido', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', accent: '#EA580C', description: 'Indica as obrigações da empresa: dívidas com fornecedores, impostos, salários e o capital dos sócios.' },
  { code: '3', label: '3 Receitas & Deduções', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', accent: '#16A34A', description: 'É a entrada de dinheiro bruto pelas vendas de produtos ou serviços.' },
  { code: '4', label: '4 Custos', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', accent: '#CA8A04', description: 'Gastos que variam conforme a produção: quanto mais você produz ou vende, mais gasta com materiais. Isso é Custo.' },
  { code: '5', label: '5 Despesas', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', accent: '#DC2626', description: 'Gastos fixos para manter a empresa aberta: aluguel, luz, internet e marketing. Independem se você vendeu muito ou pouco.' },
  { code: '6', label: '6 Apuração de Resultado', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', accent: '#9333EA', description: 'Conta de transição para o fechamento contábil, onde se encontra o lucro ou prejuízo final.' },
  { code: '9', label: '9 Contas de Controle', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', accent: '#475569', description: 'Responsabilidades sobre bens que estão na empresa mas não pertencem a ela (materiais de terceiros).' },
];

const SYSTEM_ROLE_LABELS: Record<string, { label: string, color: string }> = {
  BANK_ACCOUNT: { label: '🏦 BANCO/CAIXA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  INVENTORY: { label: '📦 ESTOQUE', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  REVENUE_SALE: { label: '💰 VENDA', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  COST_EXPENSE: { label: '📉 CUSTO/DESP', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  RECEIVABLE: { label: '🤝 A RECEBER', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  PAYABLE: { label: '💳 A PAGAR', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  TAX: { label: '🏛️ IMPOSTO', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  FIXED_ASSET: { label: '🏗️ PATRIMÔNIO', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  EQUITY: { label: '⚖️ CAPITAL', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  GENERAL: { label: '⚙️ OUTROS', color: 'bg-slate-50 text-slate-500 border-slate-200' },
};

/** Returns all ancestor codes of a given account code. E.g. '1.1.2.01' → ['1', '1.1', '1.1.2'] */
function getAncestorCodes(code: string): string[] {
  const parts = code.split('.');
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

/** Returns all descendant codes of a given account. */
function getDescendantCodes(code: string): string[] {
  return ALL_ACCOUNTS
    .filter(a => a.code !== code && (a.code.startsWith(code + '.') || a.code.startsWith(code + '0')))
    .map(a => a.code);
}

export const HelpTooltip = ({ title, description, children, side = "top" }: { title: string, description: string, children: React.ReactNode, side?: "top" | "bottom" | "left" | "right" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div 
          className="inline-block cursor-help"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side={side}
        align="center"
        sideOffset={8}
        className="w-80 bg-slate-950 text-white p-4 rounded-xl shadow-2xl border-slate-800 z-[99999] pointer-events-none"
      >
        <div className="font-bold border-b border-slate-800 mb-2 pb-1 uppercase tracking-wider text-[10px] text-amber-400">
          {title}
        </div>
        <div className="text-[12px] text-slate-100 leading-relaxed font-normal">
          {description}
        </div>
        {/* Arrow implementation for standard Radix Popover usually uses PopoverArrow, but here we can rely on Radix built-in or custom */}
      </PopoverContent>
    </Popover>
  );
};

export const DefaultChartOfAccountsModal: React.FC<DefaultChartOfAccountsModalProps> = ({ onClose, onSuccess }) => {
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [existingIdentity, setExistingIdentity] = useState<Set<string>>(new Set()); // name|nature
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set<string>());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing accounts on open
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await api.get('/api/finance/v2/chart-of-accounts?includeInactive=true');
        const rootData = res.data?.data || [];
        
        // Flat collection of ALL existing codes and identities from the tree
        const codes = new Set<string>();
        const identities = new Set<string>();

        const flatten = (items: any[]) => {
          items.forEach(item => {
            if (item.code) codes.add(item.code);
            if (item.name && item.nature) {
              const idKey = `${item.name.trim().toLowerCase()}|${item.nature}`;
              identities.add(idKey);
            }
            if (item.children && item.children.length > 0) flatten(item.children);
          });
        };
        flatten(rootData);
        
        setExistingCodes(codes);
        setExistingIdentity(identities);
        setSelectedIds(new Set());
      } catch (err) {
        console.error('Erro ao buscar contas:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExisting();
  }, []);

  /**
   * Toggle selection for an account:
   * - Selecting   → also selects all ancestors (mandatory)
   * - Deselecting → also deselects all descendants
   * - Existing accounts are locked (cannot be toggled)
   */
  const toggleAccount = (acc: AccountEntry) => {
    const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
    if (existingCodes.has(acc.code) || existingIdentity.has(idKey)) return; // locked

    setSelectedIds(prev => {
      const next = new Set(prev);
      const isSelected = next.has(acc.id);

      if (isSelected) {
        // DESMARCAR: Se desmarcamos um pai, desmarcamos TODOS os descendentes dele também
        const descendants = getDescendantCodes(acc.code);
        next.delete(acc.id);
        descendants.forEach(dc => {
          const child = ALL_ACCOUNTS.find(a => a.code === dc);
          if (child) next.delete(child.id);
        });
      } else {
        // MARCAR: Se marcamos um filho, marcamos TODOS os ancestrais dele também
        const ancestors = getAncestorCodes(acc.code);
        next.add(acc.id);
        ancestors.forEach(ac => {
          const anc = ALL_ACCOUNTS.find(a => a.code === ac);
          if (anc) next.add(anc.id);
        });
      }
      return next;
    });
  };

  const toggleExpand = (code: string) => {
    setExpandedGroups(prev => {
      // Accordion Exclusivo: Limpa o grupo anterior se estiver abrindo um novo
      const next = new Set<string>();
      if (!prev.has(code)) {
        next.add(code);
      }
      return next;
    });
  };

  // Counts: selected NEW accounts only (not existing)
  const newToImportCount = [...selectedIds].filter(id => {
    const acc = ALL_ACCOUNTS.find(a => a.id === id);
    if (!acc) return false;
    const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
    return !existingCodes.has(acc.code) && !existingIdentity.has(idKey);
  }).length;

  const handleSelectAll = () => {
    const allSelectable = ALL_ACCOUNTS.filter(a => {
      const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
      return !existingCodes.has(a.code) && !existingIdentity.has(idKey);
    }).map(a => a.id);
    setSelectedIds(new Set(allSelectable));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImport = async () => {
    const toImport = ALL_ACCOUNTS.filter(a => {
      const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
      return selectedIds.has(a.id) && !existingCodes.has(a.code) && !existingIdentity.has(idKey);
    });
    if (toImport.length === 0) { toast.error('Nenhuma conta nova para importar.'); return; }

    setIsSubmitting(true);
    let count = 0;
    try {
      for (const acc of toImport) {
        await api.post('/api/finance/v2/chart-of-accounts', {
          code: acc.code,
          name: acc.name,
          nature: acc.nature,
          type: acc.type,
          description: acc.description || null,
          parentCode: acc.parentCode || null,
          systemRole: acc.systemRole || 'GENERAL'
        });
        count++;
      }
      toast.success(`${count} contas contábeis importadas com sucesso!`);
      onSuccess();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
      toast.error(`Erro após ${count} contas: ${msg}`);
      if (count > 0) onSuccess();
      else setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay z-[9999] flex items-center justify-center p-4">
      <Card className="modal-content-card max-w-3xl w-full max-h-[90vh] flex flex-col">
        <CardHeader className="bg-slate-50 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl text-primary">Plano de Contas Padrão</CardTitle>
            <CardDescription className="mt-1">
              Estrutura contábil <strong>completa (9 naturezas)</strong>, otimizada para Gráfica e Papelaria.
              Contas com <span className="inline-block w-3 h-3 rounded bg-slate-300 align-middle mx-1" /> cinza já existem e serão ignoradas.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto overflow-x-hidden p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verificando contas já existentes...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-xs text-primary font-medium hover:bg-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Marcar Tudo
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-500 font-medium hover:bg-white"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Desmarcar Tudo
                </Button>
              </div>
              
              {GROUPS.map(group => {
              const groupAccounts = ALL_ACCOUNTS.filter(a => a.code === group.code || a.code.startsWith(group.code + '.'));
              const expanded = expandedGroups.has(group.code);
              const selectedInGroup = groupAccounts.filter(a => {
                const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
                return selectedIds.has(a.id) || existingCodes.has(a.code) || existingIdentity.has(idKey);
              }).length;

              return (
                <div key={group.code} className={`border rounded-lg relative hover:z-50 transition-all ${group.border} bg-white`}>
                  {/* Group Header */}
                  <div
                    className={`flex items-center gap-3 p-3 cursor-pointer rounded-lg ${group.bg} hover:brightness-95 transition select-none`}
                    onClick={() => toggleExpand(group.code)}
                  >
                    <span className={`font-bold text-sm flex-1 ${group.color} flex items-center gap-2 group/help relative`}>
                      {group.label}
                      <HelpTooltip title="Entenda este Grupo" description={group.description} side="top">
                        <Info className="w-4 h-4 text-slate-400 hover:text-primary transition-colors" />
                      </HelpTooltip>
                      <span className="ml-2 font-normal text-slate-500 text-xs">
                        ({selectedInGroup}/{groupAccounts.length} selecionadas)
                      </span>
                    </span>
                    <button className="text-slate-400 hover:text-slate-700 transition">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Accounts list */}
                  {expanded && (
                    <div className="divide-y bg-white">
                      {groupAccounts.map(acc => {
                        const depth = acc.code.split('.').length;
                        const indent = (depth - 1) * 16;
                        const isSynthetic = acc.type === 'SYNTHETIC';
                        const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
                        const isExistingByCode = existingCodes.has(acc.code);
                        const isExistingByName = existingIdentity.has(idKey);
                        const isExisting = isExistingByCode || isExistingByName;
                        const isChecked = selectedIds.has(acc.id) || isExisting;
                        const locked = isExisting; // Somente bloqueia se já existir no banco
                        const canToggle = !locked;

                        return (
                          <div
                            key={acc.id}
                            className={`flex items-center gap-3 py-2 px-3 transition ${canToggle ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                            style={{ paddingLeft: `${12 + indent}px` }}
                            onClick={() => canToggle && toggleAccount(acc)}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canToggle}
                              onChange={() => canToggle && toggleAccount(acc)}
                              className="w-3.5 h-3.5 rounded cursor-pointer disabled:cursor-not-allowed"
                              style={{ accentColor: isExisting ? '#94A3B8' : group.accent }}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className={`font-mono text-xs w-24 shrink-0 text-slate-400`}>
                              {acc.code}
                            </span>
                            <span className={`text-sm flex-1 ${isSynthetic ? 'font-semibold' : ''} text-slate-700 flex items-center gap-2 group/help relative`}>
                              {acc.name}
                              {!isSynthetic && acc.systemRole && SYSTEM_ROLE_LABELS[acc.systemRole] && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase transition-all whitespace-nowrap ${SYSTEM_ROLE_LABELS[acc.systemRole].color}`}>
                                  {SYSTEM_ROLE_LABELS[acc.systemRole].label}
                                </span>
                              )}
                              {acc.description && (
                                <HelpTooltip title="Dica Financeira" description={acc.description} side="top">
                                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-primary transition-colors" />
                                </HelpTooltip>
                              )}
                            </span>
                            <span 
                              key={`type-${acc.id}-${isChecked}`}
                              className={`text-[10px] w-6 h-5 flex items-center justify-center rounded uppercase font-bold shrink-0 shadow-sm border transition-all ${
                                isSynthetic 
                                  ? 'bg-slate-200 text-slate-700 border-slate-300' 
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              {isSynthetic ? 'S' : 'A'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t p-4 shrink-0 flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">
            {newToImportCount} novas contas para importar
            {existingCodes.size > 0 && (
              <span className="ml-2 text-slate-400">({existingCodes.size} já existentes)</span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleImport} disabled={isSubmitting || isLoading || newToImportCount === 0}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <>Importar {newToImportCount} Contas <Check className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
