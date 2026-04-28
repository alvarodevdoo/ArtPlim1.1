import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check, X, Clock, User, DollarSign, Info } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface AuthorizationRequest {
    id: string;
    type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    data: any;
    createdAt: string;
    requester: {
        name: string;
        email: string;
    };
    notes?: string;
}

const Pendencias: React.FC = () => {
    const [requests, setRequests] = useState<AuthorizationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    const loadRequests = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/api/sales/authorizations/pending');
            if (resp.data.success) {
                setRequests(resp.data.data);
            }
        } catch (err) {
            toast.error('Erro ao carregar pendências');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleReview = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await api.post(`/api/sales/authorizations/${requestId}/review`, {
                status,
                notes: reviewNotes
            });
            toast.success(status === 'APPROVED' ? 'Solicitação aprovada!' : 'Solicitação rejeitada!');
            setRequests(prev => prev.filter(r => r.id !== requestId));
            setReviewingId(null);
            setReviewNotes('');
        } catch (err) {
            toast.error('Erro ao processar solicitação');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Carregando pendências...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Pendências de Autorização</h1>
                <Button variant="outline" onClick={loadRequests} size="sm">
                    Atualizar
                </Button>
            </div>

            {requests.length === 0 ? (
                <Card className="border-dashed border-2 py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="p-4 bg-green-50 rounded-full mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="font-semibold text-lg text-slate-700">Tudo em dia!</h3>
                        <p className="text-slate-500">Nenhuma solicitação de desconto pendente no momento.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {requests.map(request => (
                        <Card key={request.id} className="overflow-hidden border-l-4 border-l-amber-400">
                            <CardContent className="p-0">
                                <div className="p-6 flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[10px] font-bold">
                                                    {request.type === 'DISCOUNT' ? 'Desconto Excedente' : request.type}
                                                </Badge>
                                                <span className="text-slate-400 text-xs flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {new Date(request.createdAt).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h3 className="font-bold text-lg text-slate-800">{request.data.productName}</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div className="space-y-1">
                                                    <p className="text-slate-500 text-xs">Solicitante</p>
                                                    <p className="font-medium flex items-center gap-1 text-slate-700">
                                                        <User className="w-3 h-3" /> {request.requester.name}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500 text-xs">Preço Unitário</p>
                                                    <p className="font-medium text-slate-700">{formatCurrency(request.data.unitPrice)}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500 text-xs">Quantidade</p>
                                                    <p className="font-medium text-slate-700">{request.data.quantity} un</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-slate-500 text-xs">Desconto</p>
                                                    <p className="font-bold text-red-600 flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" /> {formatCurrency(request.data.discount)} ({request.data.percent.toFixed(2)}%)
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {reviewingId === request.id ? (
                                            <div className="pt-4 space-y-3">
                                                <textarea
                                                    value={reviewNotes}
                                                    onChange={e => setReviewNotes(e.target.value)}
                                                    placeholder="Observações (opcional)..."
                                                    className="w-full p-3 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                <div className="flex gap-2">
                                                    <Button onClick={() => handleReview(request.id, 'APPROVED')} className="bg-green-600 hover:bg-green-700 flex-1">
                                                        <Check className="w-4 h-4 mr-2" /> Aprovar
                                                    </Button>
                                                    <Button onClick={() => handleReview(request.id, 'REJECTED')} variant="destructive" className="flex-1">
                                                        <X className="w-4 h-4 mr-2" /> Rejeitar
                                                    </Button>
                                                    <Button onClick={() => setReviewingId(null)} variant="ghost">Cancelar</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-4 flex gap-2">
                                                <Button onClick={() => setReviewingId(request.id)} className="bg-indigo-600 hover:bg-indigo-700 flex-1">
                                                    Analisar Solicitação
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="md:w-64 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-2">
                                            <Info className="w-3 h-3" /> Resumo Financeiro
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Subtotal:</span>
                                                <span className="font-medium">{formatCurrency(request.data.unitPrice * request.data.quantity)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Desconto:</span>
                                                <span className="font-bold text-red-600">-{formatCurrency(request.data.discount)}</span>
                                            </div>
                                            <div className="pt-2 border-t flex justify-between">
                                                <span className="font-bold">Total:</span>
                                                <span className="font-black text-indigo-600">{formatCurrency((request.data.unitPrice * request.data.quantity) - request.data.discount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Pendencias;
