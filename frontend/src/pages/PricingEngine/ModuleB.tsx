import React, { useState } from 'react';
import { usePricingStore, FormulaInput, PlaceholderCusto, Formula } from './store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Beaker, HelpCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ModuleB: React.FC = () => {
    const { formulas, addFormula, updateFormula, removeFormula } = usePricingStore();
    const [formulaName, setFormulaName] = useState('');
    const [inputs, setInputs] = useState<FormulaInput[]>([]);
    const [placeholders, setPlaceholders] = useState<PlaceholderCusto[]>([]);
    const [expressao, setExpressao] = useState('');
    const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);

    const [inputNome, setInputNome] = useState('');
    const [inputTipo, setInputTipo] = useState<'Fixo' | 'Variável'>('Variável');

    const [phNome, setPhNome] = useState('');
    const [phTipo, setPhTipo] = useState<PlaceholderCusto['tipo']>('MaterialPorArea');

    const addInput = () => {
        if (!inputNome) return;
        if (inputs.find(i => i.nome === inputNome)) {
            toast.error('Variável já existe');
            return;
        }
        setInputs([...inputs, { nome: inputNome, tipo: inputTipo }]);
        setInputNome('');
    };

    const addPlaceholder = () => {
        if (!phNome) return;
        setPlaceholders([...placeholders, { nome: phNome, tipo: phTipo }]);
        setPhNome('');
    };

    const handleSaveFormula = () => {
        if (!formulaName || !expressao) {
            toast.error('Preencha o nome e a expressão da fórmula');
            return;
        }

        const formulaData: Formula = {
            id: editingFormulaId || Math.random().toString(36).substr(2, 9),
            nome: formulaName,
            inputs,
            placeholders,
            expressao,
        };

        if (editingFormulaId) {
            updateFormula(formulaData);
            toast.success('Fórmula atualizada com sucesso!');
        } else {
            addFormula(formulaData);
            toast.success('Fórmula salva com sucesso!');
        }

        resetForm();
    };

    const resetForm = () => {
        setFormulaName('');
        setInputs([]);
        setPlaceholders([]);
        setExpressao('');
        setEditingFormulaId(null);
    };

    const editFormula = (f: Formula) => {
        setFormulaName(f.nome);
        setInputs([...f.inputs]);
        setPlaceholders([...f.placeholders]);
        setExpressao(f.expressao);
        setEditingFormulaId(f.id);
        toast.info(`Editando: ${f.nome}`);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Settings className="w-5 h-5 text-purple-500" />
                                <span>{editingFormulaId ? 'Editar Receita de Precificação' : 'Construtor de Lógica'}</span>
                                {editingFormulaId && (
                                    <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase font-bold animate-pulse">
                                        Modo Edição
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome da Receita de Precificação</Label>
                                <Input
                                    placeholder="Ex: Corte Laser - Área + Tempo"
                                    value={formulaName}
                                    onChange={(e) => setFormulaName(e.target.value)}
                                />
                            </div>

                            <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold flex items-center">
                                        <Beaker className="w-4 h-4 mr-2" /> Expressão Matemática
                                    </h3>
                                    <div className="group relative">
                                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                                        <div className="absolute right-0 top-6 hidden group-hover:block bg-popover border p-2 rounded shadow-lg text-xs w-64 z-10">
                                            Use colchetes para variáveis: [Largura] * [Comprimento] * [MaterialPorArea]
                                        </div>
                                    </div>
                                </div>
                                <Input
                                    placeholder="(([Largura] * [Comprimento]) * [MaterialPorArea]) + ([Tempo] * [CustoMaquina])"
                                    value={expressao}
                                    onChange={(e) => setExpressao(e.target.value)}
                                    className="font-mono text-lg"
                                />
                            </div>

                            <div className="flex space-x-2">
                                <Button onClick={handleSaveFormula} className="flex-1 bg-purple-600 hover:bg-purple-700">
                                    {editingFormulaId ? 'Atualizar Fórmula' : 'Salvar Fórmula Genérica'}
                                </Button>
                                {editingFormulaId && (
                                    <Button variant="outline" onClick={resetForm}>
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Fórmulas Salvas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {formulas.map((f: Formula) => (
                                    <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-bold">{f.nome}</p>
                                            <p className="text-sm font-mono text-muted-foreground">{f.expressao}</p>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Button variant="ghost" size="sm" onClick={() => editFormula(f)} className="text-purple-500">
                                                <Settings className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => removeFormula(f.id)} className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {formulas.length === 0 && (
                                    <p className="text-center text-muted-foreground italic py-4">Nenhuma fórmula cadastrada.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">1. Variáveis de Medida</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Nome (ex: Largura)"
                                    value={inputNome}
                                    onChange={(e) => setInputNome(e.target.value)}
                                />
                                <select
                                    className="bg-background border rounded px-2 text-sm"
                                    value={inputTipo}
                                    onChange={(e) => setInputTipo(e.target.value as any)}
                                >
                                    <option value="Variável">Variável</option>
                                    <option value="Fixo">Fixo</option>
                                </select>
                                <Button size="sm" onClick={addInput}><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {inputs.map((i, idx) => (
                                    <Badge key={idx} variant={i.tipo === 'Fixo' ? 'secondary' : 'default'} className="flex items-center space-x-1">
                                        <span>[{i.nome}]</span>
                                        <span className="text-[10px] opacity-70">({i.tipo})</span>
                                        <button onClick={() => setInputs(inputs.filter((_, ip) => ip !== idx))} className="ml-1 hover:text-red-400">×</button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">2. Placeholders de Custo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Nome (ex: Material)"
                                    value={phNome}
                                    onChange={(e) => setPhNome(e.target.value)}
                                />
                                <select
                                    className="bg-background border rounded px-2 text-sm"
                                    value={phTipo}
                                    onChange={(e) => setPhTipo(e.target.value as any)}
                                >
                                    <option value="MaterialPorArea">$/cm²</option>
                                    <option value="MaterialPorComprimento">$/m</option>
                                    <option value="TempoMaquina">$/min</option>
                                </select>
                                <Button size="sm" onClick={addPlaceholder}><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {placeholders.map((p, idx) => (
                                    <Badge key={idx} variant="outline" className="flex items-center space-x-1 border-purple-200 text-purple-700 bg-purple-50">
                                        <span>[{p.nome}]</span>
                                        <button onClick={() => setPlaceholders(placeholders.filter((_, ip) => ip !== idx))} className="ml-1 hover:text-red-400">×</button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ModuleB;
