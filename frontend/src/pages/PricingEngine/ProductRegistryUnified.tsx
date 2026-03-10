import React, { useState } from 'react';
import { usePricingStore, Formula, FormulaInput, Insumo } from './store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Package, Calculator, Ruler, DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';

const ProductRegistryUnified: React.FC = () => {
    const { formulas, addProduto, addInsumo, produtos, insumos, removeProduto, removeInsumo } = usePricingStore();

    // Estado do formulário
    const [nome, setNome] = useState('');
    const [tipoPrecificacao, setTipoPrecificacao] = useState<'Fixo' | 'Area' | 'Formula'>('Fixo');
    const [precoVenda, setPrecoVenda] = useState<number>(0);
    const [custoBase, setCustoBase] = useState<number>(0);
    const [unidadeMedida, setUnidadeMedida] = useState('Un');

    // Para Fórmulas
    const [formulaId, setFormulaId] = useState('');
    const [configFixas, setConfigFixas] = useState<Record<string, number>>({});

    const selectedFormula = formulas.find(f => f.id === formulaId);

    const handleSave = () => {
        if (!nome) {
            toast.error('O nome do produto é obrigatório');
            return;
        }

        // Lógica de Salvamento Mockada (Adaptando para a store atual para demonstração)
        if (tipoPrecificacao === 'Formula' && formulaId) {
            addProduto({
                id: Math.random().toString(36).substr(2, 9),
                nome,
                formulaId,
                configuracoesFixas: configFixas
            });
            toast.success(`Produto "${nome}" salvo com lógica de engenharia!`);
        } else if (tipoPrecificacao === 'Area') {
            // Simula criando um Insumo (Material de Venda)
            addInsumo({
                id: Math.random().toString(36).substr(2, 9),
                nome,
                unidadeCompra: 'm²',
                unidadeConsumo: 'm²',
                fatorConversao: 1,
                custoCompra: custoBase,
                custoUCI: custoBase
            });
            toast.success(`Material "${nome}" salvo com custo por m²!`);
        } else {
            // Simula um produto de preço fixo (apenas visual por enquanto ou salvaria como Insumo un)
            toast.success(`Produto "${nome}" salvo com preço fixo de R$ ${precoVenda}!`);
        }

        // Reset
        setNome('');
        setPrecoVenda(0);
        setCustoBase(0);
        setFormulaId('');
        setConfigFixas({});
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="border-2 border-primary/20">
                <CardHeader className="bg-muted/20">
                    <CardTitle className="flex items-center space-x-2 text-2xl">
                        <Package className="w-8 h-8 text-primary" />
                        <span>Cadastro Unificado de Produtos</span>
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Cadastre produtos acabados, serviços ou materiais em um só lugar.
                    </p>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    {/* 1. Identificação */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-lg">Nome do Item</Label>
                            <Input
                                placeholder="Ex: Placa de ACM, Adesivo Vinil, Instalação..."
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                className="h-12 text-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-lg">Unidade de Venda</Label>
                            <select
                                className="w-full h-12 bg-background border rounded-md px-3 text-lg"
                                value={unidadeMedida}
                                onChange={e => setUnidadeMedida(e.target.value)}
                            >
                                <option value="Un">Unidade (Un)</option>
                                <option value="m2">Metro Quadrado (m²)</option>
                                <option value="ml">Metro Linear (ml)</option>
                                <option value="kg">Quilo (kg)</option>
                                <option value="h">Hora (h)</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. Estratégia de Preço */}
                    <div className="space-y-4">
                        <Label className="text-lg">Como este item é precificado?</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div
                                onClick={() => setTipoPrecificacao('Fixo')}
                                className={`cursor-pointer p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-muted/50 transition-colors ${tipoPrecificacao === 'Fixo' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''}`}
                            >
                                <DollarSign className="w-8 h-8 text-green-500" />
                                <span className="font-bold">Preço Fixo</span>
                                <span className="text-xs text-center text-muted-foreground">Valor definido manualmente no cadastro.</span>
                            </div>

                            <div
                                onClick={() => setTipoPrecificacao('Area')}
                                className={`cursor-pointer p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-muted/50 transition-colors ${tipoPrecificacao === 'Area' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''}`}
                            >
                                <Ruler className="w-8 h-8 text-blue-500" />
                                <span className="font-bold">Por Área / Medida</span>
                                <span className="text-xs text-center text-muted-foreground">Calculado base x altura x custo m².</span>
                            </div>

                            <div
                                onClick={() => setTipoPrecificacao('Formula')}
                                className={`cursor-pointer p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-muted/50 transition-colors ${tipoPrecificacao === 'Formula' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''}`}
                            >
                                <Calculator className="w-8 h-8 text-purple-500" />
                                <span className="font-bold">Fórmula Inteligente</span>
                                <span className="text-xs text-center text-muted-foreground">Usa regras de engenharia (módulo B).</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Detalhes Específicos da Estratégia */}
                    <div className="p-6 bg-muted/30 rounded-xl border border-dashed animate-in fade-in slide-in-from-top-4 duration-500">

                        {tipoPrecificacao === 'Fixo' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Custo do Produto (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={custoBase}
                                        onChange={e => setCustoBase(Number(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground">Quanto custa para você comprar/produzir.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-green-600 font-bold">Preço de Venda (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="font-bold text-lg"
                                        value={precoVenda}
                                        onChange={e => setPrecoVenda(Number(e.target.value))}
                                    />
                                    {custoBase > 0 && precoVenda > 0 && (
                                        <p className="text-xs text-green-600 font-bold">
                                            Margem: {(((precoVenda - custoBase) / custoBase) * 100).toFixed(1)}%
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {tipoPrecificacao === 'Area' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Custo por {unidadeMedida} (R$)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={custoBase}
                                        onChange={e => setCustoBase(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Margem de Lucro (%)</Label>
                                    <Input
                                        type="number"
                                        placeholder="Ex: 100%"
                                        onChange={e => {
                                            const margem = Number(e.target.value);
                                            setPrecoVenda(custoBase * (1 + (margem / 100)));
                                        }}
                                    />
                                    <p className="text-sm font-bold mt-2">
                                        Preço Final: R$ {precoVenda.toFixed(2)} / {unidadeMedida}
                                    </p>
                                </div>
                            </div>
                        )}

                        {tipoPrecificacao === 'Formula' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Selecione a Regra de Engenharia</Label>
                                    <select
                                        className="w-full h-10 bg-background border rounded px-3"
                                        value={formulaId}
                                        onChange={e => setFormulaId(e.target.value)}
                                    >
                                        <option value="">Selecione uma lógica...</option>
                                        {formulas.map(f => (
                                            <option key={f.id} value={f.id}>{f.nome} (Ex: {f.expressao})</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedFormula && selectedFormula.inputs.some(i => i.tipo === 'Fixo') && (
                                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 grid grid-cols-2 gap-4">
                                        <div className="col-span-2 text-sm font-bold text-purple-800">Defina os parâmetros fixos para este produto:</div>
                                        {selectedFormula.inputs.filter(i => i.tipo === 'Fixo').map(input => (
                                            <div key={input.nome} className="space-y-1">
                                                <Label className="text-xs">{input.nome}</Label>
                                                <Input
                                                    type="number"
                                                    value={configFixas[input.nome] || 0}
                                                    onChange={e => setConfigFixas({ ...configFixas, [input.nome]: Number(e.target.value) })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    <Button onClick={handleSave} size="lg" className="w-full text-lg h-14 bg-primary hover:bg-primary/90">
                        <Save className="mr-2 h-5 w-5" /> Salvar Produto no Catálogo
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Produtos Cadastrados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {produtos.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Nenhum produto cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {produtos.map((prod) => (
                                        <div key={prod.id} className="p-3 bg-muted rounded-lg flex justify-between items-center group">
                                            <div>
                                                <div className="font-bold">{prod.nome}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {prod.formulaId ? 'Fórmula' : 'Preço Fixo'}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeProduto(prod.id)}
                                                className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Insumos / Materiais</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {insumos.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Nenhum insumo cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {insumos.map((ins) => (
                                        <div key={ins.id} className="p-3 bg-muted rounded-lg flex justify-between items-center group">
                                            <div>
                                                <div className="font-bold">{ins.nome}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {ins.unidadeCompra} - R$ {ins.custoUCI.toFixed(2)}/{ins.unidadeConsumo}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeInsumo(ins.id)}
                                                className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProductRegistryUnified;
