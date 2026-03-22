import React, { useState, useEffect } from 'react';
import { X, Clock, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import api from '@/lib/api';


interface PricingRuleHistoryModalProps {
    ruleId: string;
    onClose: () => void;
}

const PricingRuleHistoryModal: React.FC<PricingRuleHistoryModalProps> = ({ ruleId, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/api/catalog/pricing-rules/${ruleId}/history`);
                if (response.data.success) {
                    setHistory(response.data.data);
                }
            } catch (error) {
                toast.error('Erro ao carregar histórico de versões');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [ruleId]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Cabeçalho */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Histórico de Versões</h2>
                            <p className="text-sm text-slate-500">
                                Veja as mudanças desta fórmula ao longo do tempo.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
                        <X className="w-5 h-5 text-slate-500" />
                    </Button>
                </div>

                {/* Conteúdo (Lista de versões) */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm">Carregando histórico...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                            Nenhum histórico encontrado para esta regra.
                        </div>
                    ) : (
                        <div className="space-y-4 relative">
                            {/* Linha do tempo visual */}
                            <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200" />

                            {history.map((version) => {
                                let formulaData = version.formula;
                                if (typeof formulaData === 'string') {
                                    try { formulaData = JSON.parse(formulaData); } catch (e) {}
                                }
                                
                                const isCurrent = version.isLatest;

                                return (
                                    <div key={version.id} className="relative pl-14">
                                        {/* Ponto da linha do tempo */}
                                        <div className={`absolute left-[21px] top-4 w-3 h-3 rounded-full border-2 bg-white ${isCurrent ? 'border-emerald-500 scale-125' : 'border-slate-300'}`} />

                                        <div className={`p-4 rounded-xl border ${isCurrent ? 'bg-white border-emerald-200 shadow-sm ring-1 ring-emerald-50' : 'bg-white/60 border-slate-200'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold ${isCurrent ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                        Versão {version.version}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-100 rounded-full">
                                                            Atual
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {formatDate(version.createdAt)}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {/* Preço de Venda */}
                                                <div className="font-mono text-sm p-2 bg-slate-50 rounded border border-slate-100 text-slate-700 break-all">
                                                    <span className="text-slate-400 select-none text-xs block mb-1">Preço de Venda (f(x))</span>
                                                    {formulaData?.formulaString || 'N/A'}
                                                </div>
                                                
                                                {/* Custo (se houver) */}
                                                {formulaData?.costFormulaString && (
                                                    <div className="font-mono text-sm p-2 bg-orange-50 rounded border border-orange-100 text-slate-700 break-all">
                                                        <span className="text-orange-400 select-none text-xs block mb-1">Custo Base</span>
                                                        {formulaData.costFormulaString}
                                                    </div>
                                                )}

                                                <div className="pt-2 flex flex-wrap gap-1.5">
                                                    {(formulaData?.variables || []).map((v: any, i: number) => (
                                                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                            {v.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2 text-xs text-slate-500">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>Pedidos antigos manterão o cálculo da versão vigente no momento da venda.</span>
                </div>
            </div>
        </div>
    );
};

export default PricingRuleHistoryModal;
