import React, { useState } from 'react';
import { usePricingStore, Insumo } from './store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Trash2, Plus, Calculator, Settings } from 'lucide-react';
import { toast } from 'sonner';

const ModuleA: React.FC = () => {
    const { insumos, addInsumo, updateInsumo, removeInsumo } = usePricingStore();
    const [newInsumo, setNewInsumo] = useState<Partial<Insumo>>({
        nome: '',
        unidadeCompra: 'Chapa',
        unidadeConsumo: 'cm²',
        fatorConversao: 10000,
        custoCompra: 0,
    });
    const [editingInsumoId, setEditingInsumoId] = useState<string | null>(null);

    const handleSave = () => {
        if (!newInsumo.nome || newInsumo.custoCompra === undefined) return;

        const custoUCI = (newInsumo.custoCompra || 0) / (newInsumo.fatorConversao || 1);

        const insumoData: Insumo = {
            id: editingInsumoId || Math.random().toString(36).substr(2, 9),
            nome: newInsumo.nome!,
            unidadeCompra: newInsumo.unidadeCompra!,
            unidadeConsumo: newInsumo.unidadeConsumo!,
            fatorConversao: newInsumo.fatorConversao!,
            custoCompra: newInsumo.custoCompra!,
            custoUCI,
        };

        if (editingInsumoId) {
            updateInsumo(insumoData);
            toast.success('Insumo atualizado!');
        } else {
            addInsumo(insumoData);
            toast.success('Insumo adicionado!');
        }

        resetForm();
    };

    const resetForm = () => {
        setNewInsumo({
            nome: '',
            unidadeCompra: 'Chapa',
            unidadeConsumo: 'cm²',
            fatorConversao: 10000,
            custoCompra: 0,
        });
        setEditingInsumoId(null);
    };

    const editInsumo = (insumo: Insumo) => {
        setNewInsumo({ ...insumo });
        setEditingInsumoId(insumo.id);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Calculator className="w-5 h-5 text-blue-500" />
                        <span>{editingInsumoId ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}</span>
                        {editingInsumoId && (
                            <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold animate-pulse">
                                Modo Edição
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Nome do Insumo</Label>
                            <Input
                                placeholder="Ex: Acrílico 3mm Cristal"
                                value={newInsumo.nome}
                                onChange={(e) => setNewInsumo({ ...newInsumo, nome: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade de Compra (UC)</Label>
                            <Input
                                placeholder="Ex: Chapa"
                                value={newInsumo.unidadeCompra}
                                onChange={(e) => setNewInsumo({ ...newInsumo, unidadeCompra: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade de Consumo (UCI)</Label>
                            <Input
                                placeholder="Ex: cm²"
                                value={newInsumo.unidadeConsumo}
                                onChange={(e) => setNewInsumo({ ...newInsumo, unidadeConsumo: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fator de Conversão</Label>
                            <Input
                                type="number"
                                value={newInsumo.fatorConversao}
                                onChange={(e) => setNewInsumo({ ...newInsumo, fatorConversao: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Custo da UC (R$)</Label>
                            <Input
                                type="number"
                                placeholder="0,00"
                                value={newInsumo.custoCompra}
                                onChange={(e) => setNewInsumo({ ...newInsumo, custoCompra: Number(e.target.value) })}
                            />
                        </div>
                        <div className="flex items-end space-x-2">
                            <Button onClick={handleSave} className="flex-1">
                                <Plus className="w-4 h-4 mr-2" /> {editingInsumoId ? 'Atualizar Insumo' : 'Adicionar Insumo'}
                            </Button>
                            {editingInsumoId && (
                                <Button variant="outline" onClick={resetForm}>
                                    Cancelar
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Insumos e Custos Unitários</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3">Insumo</th>
                                    <th className="px-4 py-3">UC</th>
                                    <th className="px-4 py-3">UCI</th>
                                    <th className="px-4 py-3 font-bold text-blue-600">Custo UCI</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {insumos.map((insumo: Insumo) => (
                                    <tr key={insumo.id} className="border-b hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 font-medium">{insumo.nome}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{insumo.unidadeCompra}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{insumo.unidadeConsumo}</td>
                                        <td className="px-4 py-3 font-bold text-blue-600">
                                            R$ {insumo.custoUCI.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end space-x-1">
                                                <Button variant="ghost" size="sm" onClick={() => editInsumo(insumo)} className="text-blue-500">
                                                    <Settings className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => removeInsumo(insumo.id)} className="text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {insumos.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                                            Nenhum insumo cadastrado para apuração de custos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ModuleA;
