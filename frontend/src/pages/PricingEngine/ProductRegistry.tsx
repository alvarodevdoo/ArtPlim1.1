import React, { useState } from 'react';
import { usePricingStore, ProdutoVinculado, Formula, FormulaInput } from './store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Package, Link, Trash2, Plus, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';

const ProductRegistry: React.FC = () => {
    const { formulas, produtos, addProduto, updateProduto, removeProduto } = usePricingStore();
    const [nome, setNome] = useState('');
    const [formulaId, setFormulaId] = useState('');
    const [configFixas, setConfigFixas] = useState<Record<string, number>>({});
    const [editingProductId, setEditingProductId] = useState<string | null>(null);

    const selectedFormula = formulas.find((f: Formula) => f.id === formulaId);

    const handleFormulaChange = (id: string) => {
        setFormulaId(id);
        const formula = formulas.find((f: Formula) => f.id === id);
        if (formula) {
            // Inicializa inputs fixos
            const fixos: Record<string, number> = {};
            formula.inputs.forEach((input: FormulaInput) => {
                if (input.tipo === 'Fixo') {
                    fixos[input.nome] = 0;
                }
            });
            setConfigFixas(fixos);
        }
    };

    const handleSave = () => {
        if (!nome || !formulaId) {
            toast.error('Preencha o nome e selecione uma fórmula');
            return;
        }

        const produtoData: ProdutoVinculado = {
            id: editingProductId || Math.random().toString(36).substr(2, 9),
            nome,
            formulaId,
            configuracoesFixas: configFixas,
        };

        if (editingProductId) {
            updateProduto(produtoData);
            toast.success('Produto atualizado!');
        } else {
            addProduto(produtoData);
            toast.success('Produto vinculado à fórmula!');
        }

        resetForm();
    };

    const resetForm = () => {
        setNome('');
        setFormulaId('');
        setConfigFixas({});
        setEditingProductId(null);
    };

    const editProduto = (p: ProdutoVinculado) => {
        setNome(p.nome);
        setFormulaId(p.formulaId);
        setConfigFixas({ ...p.configuracoesFixas });
        setEditingProductId(p.id);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Link className="w-5 h-5 text-orange-500" />
                        <span>{editingProductId ? 'Editar Vínculo de Produto' : 'Vincular Produto a Lógica de Preço'}</span>
                        {editingProductId && (
                            <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase font-bold animate-pulse">
                                Modo Edição
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome do Produto Comercial</Label>
                            <Input
                                placeholder="Ex: Placa de Aviso A4"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Selecione a Fórmula Base</Label>
                            <select
                                className="w-full h-10 bg-background border rounded px-3"
                                value={formulaId}
                                onChange={(e) => handleFormulaChange(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {formulas.map((f: Formula) => (
                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedFormula && selectedFormula.inputs.some((i: FormulaInput) => i.tipo === 'Fixo') && (
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-4">
                            <h3 className="font-semibold text-orange-800 flex items-center">
                                <SettingsIcon className="w-4 h-4 mr-2" /> Valores Fixos para este Produto
                            </h3>
                            <p className="text-xs text-orange-600">
                                Os valores abaixo serão "congelados" para este produto. O vendedor não poderá alterá-los.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {selectedFormula.inputs.filter((i: FormulaInput) => i.tipo === 'Fixo').map((input: FormulaInput) => (
                                    <div key={input.nome} className="space-y-1">
                                        <Label className="text-xs">{input.nome}</Label>
                                        <Input
                                            type="number"
                                            value={configFixas[input.nome] || 0}
                                            onChange={(e) => setConfigFixas({ ...configFixas, [input.nome]: Number(e.target.value) })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex space-x-2">
                        <Button onClick={handleSave} className="flex-1 bg-orange-500 hover:bg-orange-600">
                            <Plus className="w-4 h-4 mr-2" /> {editingProductId ? 'Atualizar Produto' : 'Cadastrar Produto Com Esta Lógica'}
                        </Button>
                        {editingProductId && (
                            <Button variant="outline" onClick={resetForm}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Produtos Configurados</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {produtos.map((p: ProdutoVinculado) => {
                            const f = formulas.find((f: Formula) => f.id === p.formulaId);
                            return (
                                <div key={p.id} className="p-4 border rounded-xl bg-card hover:shadow-md transition-shadow relative group">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-bold flex items-center">
                                                <Package className="w-4 h-4 mr-2 text-orange-400" />
                                                {p.nome}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Fórmula: <span className="font-medium">{f?.nome || 'Não encontrada'}</span>
                                            </p>
                                            {Object.keys(p.configuracoesFixas).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {Object.entries(p.configuracoesFixas).map(([k, v]) => (
                                                        <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded border">
                                                            {String(k)}: {String(v)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex space-x-1 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => editProduto(p)}
                                                className="text-orange-500"
                                            >
                                                <SettingsIcon className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeProduto(p.id)}
                                                className="text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {produtos.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                                Nenhum produto cadastrado ainda.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProductRegistry;
