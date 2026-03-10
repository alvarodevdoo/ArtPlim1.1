import React, { useState, useEffect, useMemo } from 'react';
import { usePricingStore, Insumo, Formula, ProdutoVinculado, FormulaInput, PlaceholderCusto } from './store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Star, Info, AlertTriangle } from 'lucide-react';

const ModuleC: React.FC = () => {
    const { insumos, formulas, produtos } = usePricingStore();

    const [selectedProductId, setSelectedProductId] = useState('');
    const [variableValues, setVariableValues] = useState<Record<string, number>>({});
    const [materialSelections, setMaterialSelections] = useState<Record<string, string>>({});
    const [finalPrice, setFinalPrice] = useState<number>(0);
    const [calculationLog, setCalculationLog] = useState<string>('');

    const selectedProduct = useMemo(() =>
        produtos.find((p: ProdutoVinculado) => p.id === selectedProductId),
        [produtos, selectedProductId]
    );

    const selectedFormula = useMemo(() =>
        formulas.find((f: Formula) => f.id === selectedProduct?.formulaId),
        [formulas, selectedProduct]
    );

    // Reset states when product changes
    useEffect(() => {
        if (selectedFormula) {
            const vars: Record<string, number> = {};
            selectedFormula.inputs.filter((i: FormulaInput) => i.tipo === 'Variável').forEach((i: FormulaInput) => {
                vars[i.nome] = 0;
            });
            setVariableValues(vars);

            const mats: Record<string, string> = {};
            selectedFormula.placeholders.forEach((p: PlaceholderCusto) => {
                // Se o produto tem este material pre-definido, usa ele. Senão, vazio.
                if (selectedProduct?.insumosPreDefinidos && selectedProduct.insumosPreDefinidos[p.nome]) {
                    mats[p.nome] = selectedProduct.insumosPreDefinidos[p.nome];
                } else {
                    mats[p.nome] = '';
                }
            });
            setMaterialSelections(mats);
        }
    }, [selectedFormula, selectedProduct]);

    // Performance Calculation
    useEffect(() => {
        if (!selectedFormula || !selectedProduct) {
            setFinalPrice(0);
            setCalculationLog('');
            return;
        }

        try {
            let expression = selectedFormula.expressao;
            let log = `Fórmula: ${expression}\n\n`;

            // 1. Substituir Inputs Fixos (do Produto)
            Object.entries(selectedProduct.configuracoesFixas).forEach(([name, value]) => {
                const regex = new RegExp(`\\[${name}\\]`, 'g');
                expression = expression.replace(regex, String(value));
                log += `Substituindo [${name}] (Fixo) -> ${value}\n`;
            });

            // 2. Substituir Inputs Variáveis (da Tela)
            Object.entries(variableValues).forEach(([name, value]) => {
                const regex = new RegExp(`\\[${name}\\]`, 'g');
                expression = expression.replace(regex, String(value || 0));
                log += `Substituindo [${name}] (Variável) -> ${value || 0}\n`;
            });

            // 3. Substituir Placeholders de Custo
            let missingMaterial = false;
            Object.entries(materialSelections).forEach(([name, insumoId]) => {
                const insumo = insumos.find((i: Insumo) => i.id === insumoId);
                const costValue = insumo ? insumo.custoUCI : 0;

                if (!insumo) missingMaterial = true;

                const regex = new RegExp(`\\[${name}\\]`, 'g');
                expression = expression.replace(regex, String(costValue));
                log += `Substituindo [${name}] (Material: ${insumo?.nome || 'PENDENTE'}) -> R$ ${costValue}\n`;
            });

            log += `\nExpressão Final: ${expression}`;

            if (missingMaterial) {
                setFinalPrice(0);
                setCalculationLog(log + '\n\n⚠️ Aguardando seleção de materiais...');
                return;
            }

            // Cálculo simplificado usando Function constructor (mais seguro que eval)
            // eslint-disable-next-line no-new-func
            const result = new Function(`return ${expression}`)();
            setFinalPrice(result);
            setCalculationLog(log + `\n\n✅ Resultado: R$ ${result.toFixed(2)}`);

        } catch (err) {
            console.error(err);
            setCalculationLog('Erro no cálculo: verifique a syntax da fórmula.');
            setFinalPrice(0);
        }
    }, [selectedFormula, selectedProduct, variableValues, materialSelections, insumos]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="overflow-hidden border-2 border-green-100">
                        <CardHeader className="bg-green-50 border-b border-green-100">
                            <CardTitle className="flex items-center space-x-2 text-green-800">
                                <ShoppingCart className="w-5 h-5" />
                                <span>Interface do Vendedor</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <Label>O que você está vendendo?</Label>
                                <select
                                    className="w-full h-12 bg-background border-2 rounded-xl px-4 text-lg font-medium focus:ring-2 focus:ring-green-500 outline-none"
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                >
                                    <option value="">Selecione o produto...</option>
                                    {produtos.map((p: ProdutoVinculado) => (
                                        <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {!selectedProduct && (
                                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border-dashed border-2">
                                    Selecione um produto para começar o orçamento.
                                </div>
                            )}

                            {selectedProduct && selectedFormula && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                    {/* Inputs Variáveis */}
                                    {selectedFormula.inputs.filter((i: FormulaInput) => i.tipo === 'Variável').length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Dimensões / Medidas</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                {selectedFormula.inputs.filter((i: FormulaInput) => i.tipo === 'Variável').map((i: FormulaInput) => (
                                                    <div key={i.nome} className="space-y-1">
                                                        <Label>{i.nome}</Label>
                                                        <Input
                                                            type="number"
                                                            className="h-10"
                                                            placeholder="0"
                                                            value={variableValues[i.nome] || ''}
                                                            onChange={(e) => setVariableValues({ ...variableValues, [i.nome]: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Seleção de Materiais Reais para os Placeholders */}
                                    {selectedFormula.placeholders.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Seleção de Insumos</h3>
                                            <div className="space-y-4">
                                                {selectedFormula.placeholders.map((p: PlaceholderCusto) => {
                                                    const isLocked = selectedProduct?.insumosPreDefinidos && selectedProduct.insumosPreDefinidos[p.nome];
                                                    const lockedInsumo = isLocked ? insumos.find(i => i.id === isLocked) : null;

                                                    return (
                                                        <div key={p.nome} className="space-y-1">
                                                            <Label className="flex justify-between">
                                                                <span>{p.nome}</span>
                                                                <div className="flex gap-2">
                                                                    {isLocked && <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">FIXO NO CADASTRO</Badge>}
                                                                    <Badge variant="outline" className="text-[10px] uppercase">{p.tipo}</Badge>
                                                                </div>
                                                            </Label>

                                                            {isLocked ? (
                                                                <div className="flex items-center space-x-2 p-2 bg-muted rounded-lg border border-dashed border-yellow-300">
                                                                    <div className="flex-1 font-medium text-sm">
                                                                        {lockedInsumo ? lockedInsumo.nome : 'Material não encontrado'}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {lockedInsumo ? `R$ ${lockedInsumo.custoUCI.toFixed(4)}/${lockedInsumo.unidadeConsumo}` : ''}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <select
                                                                    className="w-full h-10 bg-background border rounded-lg px-3"
                                                                    value={materialSelections[p.nome] || ''}
                                                                    onChange={(e) => setMaterialSelections({ ...materialSelections, [p.nome]: e.target.value })}
                                                                >
                                                                    <option value="">Escolha o material...</option>
                                                                    {insumos.map((insumo: Insumo) => (
                                                                        <option key={insumo.id} value={insumo.id}>
                                                                            {insumo.nome} (R$ {insumo.custoUCI.toFixed(4)}/{insumo.unidadeConsumo})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Campos Fixos (Somente Leitura) */}
                                    {Object.keys(selectedProduct.configuracoesFixas).length > 0 && (
                                        <div className="pt-4 border-t">
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(selectedProduct.configuracoesFixas).map(([k, v]) => (
                                                    <Badge key={k} variant="secondary" className="bg-muted text-muted-foreground">
                                                        {String(k)}: {String(v)} (travado)
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-slate-900 text-white shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-slate-400 text-sm font-bold uppercase tracking-widest">Resultado da Precificação</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="text-center py-8">
                                <span className="text-slate-500 text-2xl font-light">R$</span>
                                <span className="text-6xl font-black ml-2 tabular-nums">
                                    {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <p className="text-green-400 mt-2 flex items-center justify-center text-sm font-medium">
                                    <Star className="w-4 h-4 mr-1 fill-current" /> Preço com Lucro Calculado
                                </p>
                            </div>

                            <div className="bg-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-auto max-h-64 whitespace-pre-wrap">
                                <div className="flex items-center space-x-2 text-slate-500 mb-2 border-b border-slate-700 pb-2">
                                    <Info className="w-3 h-3" />
                                    <span>Log de Apuração (Módulos A + B + C)</span>
                                </div>
                                {calculationLog || 'Aguardando inputs...'}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="text-xs text-yellow-800 space-y-1">
                            <p className="font-bold uppercase tracking-tight">Nota de Protótipo</p>
                            <p>Este motor utiliza <strong>evaluadores dinâmicos</strong>. Em produção, as fórmulas são validadas contra ataques de injeção e executadas em ambiente isolado no servidor para máxima segurança.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModuleC;
