import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Insumo {
    id: string;
    nome: string;
    unidadeCompra: string;
    unidadeConsumo: string;
    fatorConversao: number;
    custoCompra: number;
    custoUCI: number;
}

export interface FormulaInput {
    nome: string;
    tipo: 'Fixo' | 'Variável';
}

export interface PlaceholderCusto {
    nome: string;
    tipo: 'MaterialPorArea' | 'MaterialPorComprimento' | 'TempoMaquina';
}

export interface Formula {
    id: string;
    nome: string;
    inputs: FormulaInput[];
    placeholders: PlaceholderCusto[];
    expressao: string; // Ex: (([Largura] * [Comprimento]) / 100) * [MaterialPorArea]
}

export interface ProdutoVinculado {
    id: string;
    nome: string;
    formulaId: string;
    configuracoesFixas: Record<string, number>;
    insumosPreDefinidos?: Record<string, string>;
}

interface PricingStore {
    insumos: Insumo[];
    formulas: Formula[];
    produtos: ProdutoVinculado[];

    addInsumo: (insumo: Insumo) => void;
    updateInsumo: (insumo: Insumo) => void;
    removeInsumo: (id: string) => void;

    addFormula: (formula: Formula) => void;
    updateFormula: (formula: Formula) => void;
    removeFormula: (id: string) => void;

    addProduto: (produto: ProdutoVinculado) => void;
    updateProduto: (produto: ProdutoVinculado) => void;
    removeProduto: (id: string) => void;
}

export const usePricingStore = create<PricingStore>()(
    persist(
        (set) => ({
            insumos: [
                { id: 'i-lona-440', nome: 'Lona Frontlight 440g', unidadeCompra: 'Bobina (50m x 3.20m)', unidadeConsumo: 'm²', fatorConversao: 160, custoCompra: 2400, custoUCI: 15.00 },
                { id: 'i-vinil-auto', nome: 'Vinil Adesivo Branco', unidadeCompra: 'Bobina (50m x 1.25m)', unidadeConsumo: 'm²', fatorConversao: 62.5, custoCompra: 750, custoUCI: 12.00 },
                { id: 'i-tinta-ecosolvente', nome: 'Tinta Ecosolvente (L,M,C,K)', unidadeCompra: 'Litro', unidadeConsumo: 'ml', fatorConversao: 1000, custoCompra: 250, custoUCI: 0.25 },
                { id: 'i-ilhos', nome: 'Ilhós Niquelado', unidadeCompra: 'Milheiro', unidadeConsumo: 'Un', fatorConversao: 1000, custoCompra: 80, custoUCI: 0.08 },
                { id: 'i-ps-2mm', nome: 'Chapa PS 2mm 2x1m', unidadeCompra: 'Chapa', unidadeConsumo: 'm²', fatorConversao: 2, custoCompra: 60, custoUCI: 30.00 },
                { id: 'i-acm-3mm', nome: 'Chapa ACM 3mm 5x1.22m', unidadeCompra: 'Chapa', unidadeConsumo: 'm²', fatorConversao: 6.1, custoCompra: 488, custoUCI: 80.00 },
                { id: 'i-mao-obra', nome: 'Operador Acabamento', unidadeCompra: 'Hora', unidadeConsumo: 'min', fatorConversao: 60, custoCompra: 25, custoUCI: 0.42 },
            ],
            formulas: [
                {
                    id: 'f-banner',
                    nome: 'Banner Promocional (Lona + Bastão/Corda)',
                    expressao: '(([Largura] * [Altura]) * [CustoLona]) + ([Perimetro] * 0.5) + ([QtdIlhos] * [CustoIlhos])',
                    inputs: [
                        { nome: 'Largura', tipo: 'Variável' },
                        { nome: 'Altura', tipo: 'Variável' },
                        { nome: 'Perimetro', tipo: 'Variável' },
                        { nome: 'QtdIlhos', tipo: 'Variável' }
                    ],
                    placeholders: [
                        { nome: 'CustoLona', tipo: 'MaterialPorArea' },
                        { nome: 'CustoIlhos', tipo: 'MaterialPorArea' }
                    ]
                },
                {
                    id: 'f-adesivo',
                    nome: 'Adesivo Impressão Digital',
                    expressao: '([Largura] * [Altura]) * ([CustoVinil] + [CustoImpressao])',
                    inputs: [
                        { nome: 'Largura', tipo: 'Variável' },
                        { nome: 'Altura', tipo: 'Variável' }
                    ],
                    placeholders: [
                        { nome: 'CustoVinil', tipo: 'MaterialPorArea' },
                        { nome: 'CustoImpressao', tipo: 'MaterialPorArea' }
                    ]
                },
                {
                    id: 'f-placa-ps',
                    nome: 'Placa de Sinalização PS',
                    expressao: '(([Largura] * [Altura]) * ([CustoPS] + [CustoVinil])) + ([TempoCorte] * [CustoOperador])',
                    inputs: [
                        { nome: 'Largura', tipo: 'Variável' },
                        { nome: 'Altura', tipo: 'Variável' },
                        { nome: 'TempoCorte', tipo: 'Variável' }
                    ],
                    placeholders: [
                        { nome: 'CustoPS', tipo: 'MaterialPorArea' },
                        { nome: 'CustoVinil', tipo: 'MaterialPorArea' },
                        { nome: 'CustoOperador', tipo: 'TempoMaquina' }
                    ]
                },
                {
                    id: 'f-fachada-acm',
                    nome: 'Revestimento de Fachada em ACM',
                    expressao: '([MetragemQuadrada] * [CustoACM]) + ([MetragemQuadrada] * [CustoEstrutura]) + ([DiasInstalacao] * [DiariaEquipe])',
                    inputs: [
                        { nome: 'MetragemQuadrada', tipo: 'Variável' },
                        { nome: 'DiasInstalacao', tipo: 'Variável' }
                    ],
                    placeholders: [
                        { nome: 'CustoACM', tipo: 'MaterialPorArea' },
                        { nome: 'CustoEstrutura', tipo: 'MaterialPorArea' },
                        { nome: 'DiariaEquipe', tipo: 'MaterialPorArea' }
                    ]
                }
            ],
            produtos: [
                {
                    id: 'p-cartao-visita',
                    nome: 'Cartão de Visita 4x0 300g (Milheiro)',
                    formulaId: '',
                    configuracoesFixas: {} as Record<string, number>
                },
                {
                    id: 'p-banner-440',
                    nome: 'Banner 440g c/ Acabamento',
                    formulaId: 'f-banner',
                    configuracoesFixas: {} as Record<string, number>,
                    insumosPreDefinidos: {
                        'CustoLona': 'i-lona-440',
                        'CustoIlhos': 'i-ilhos'
                    }
                },
                {
                    id: 'p-adesivo-brilho',
                    nome: 'Adesivo Vinil Brilho',
                    formulaId: 'f-adesivo',
                    configuracoesFixas: {} as Record<string, number>,
                    insumosPreDefinidos: {
                        'CustoVinil': 'i-vinil-auto',
                        'CustoImpressao': 'i-tinta-ecosolvente'
                    }
                },
                {
                    id: 'p-placa-ps-2mm',
                    nome: 'Placa de Aviso PS 2mm',
                    formulaId: 'f-placa-ps',
                    configuracoesFixas: {} as Record<string, number>
                },
                {
                    id: 'p-fachada-acm-std',
                    nome: 'Paineis de ACM 3mm - Instalação Inclusa',
                    formulaId: 'f-fachada-acm',
                    configuracoesFixas: {} as Record<string, number>
                }
            ] as ProdutoVinculado[],

            addInsumo: (insumo: Insumo) => set((state: PricingStore) => ({ insumos: [...state.insumos, insumo] })),
            updateInsumo: (insumo: Insumo) => set((state: PricingStore) => ({
                insumos: state.insumos.map((i: Insumo) => i.id === insumo.id ? insumo : i)
            })),
            removeInsumo: (id: string) => set((state: PricingStore) => ({ insumos: state.insumos.filter((i: Insumo) => i.id !== id) })),

            addFormula: (formula: Formula) => set((state: PricingStore) => ({ formulas: [...state.formulas, formula] })),
            updateFormula: (formula: Formula) => set((state: PricingStore) => ({
                formulas: state.formulas.map((f: Formula) => f.id === formula.id ? formula : f)
            })),
            removeFormula: (id: string) => set((state: PricingStore) => ({ formulas: state.formulas.filter((f: Formula) => f.id !== id) })),

            addProduto: (produto: ProdutoVinculado) => set((state: PricingStore) => ({ produtos: [...state.produtos, produto] })),
            updateProduto: (produto: ProdutoVinculado) => set((state: PricingStore) => ({
                produtos: state.produtos.map((p: ProdutoVinculado) => p.id === produto.id ? produto : p)
            })),
            removeProduto: (id: string) => set((state: PricingStore) => ({ produtos: state.produtos.filter((p: ProdutoVinculado) => p.id !== id) })),
        }),
        {
            name: 'pricing-engine-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
