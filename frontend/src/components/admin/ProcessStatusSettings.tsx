import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ProcessStatus {
    id: string;
    name: string;
    color: string;
    icon?: string;
    parentId?: string;
    scope: 'ORDER' | 'ITEM' | 'BOTH';
    mappedBehavior: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
    allowEdition: boolean;
    requirePayment: boolean;
    requireDeposit: boolean;
    displayOrder: number;
    active: boolean;
    hideFromFlow?: boolean;
    children?: ProcessStatus[];
}

const ProcessStatusSettings: React.FC = () => {
    const [statuses, setStatuses] = useState<ProcessStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ProcessStatus>>({
        name: '',
        color: '#000000',
        scope: 'ORDER',
        mappedBehavior: 'DRAFT',
        allowEdition: true,
        requirePayment: false,
        requireDeposit: false,
        displayOrder: 1,
        hideFromFlow: false
    });
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadStatuses();
    }, []);

    const loadStatuses = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/organization/config/process-statuses/tree');
            setStatuses(response.data.data);
        } catch (error) {
            toast.error('Erro ao carregar status');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = (parent: string | null = null) => {
        setFormData({
            name: '',
            color: '#000000',
            scope: 'ORDER',
            mappedBehavior: 'DRAFT',
            allowEdition: true,
            requirePayment: false,
            requireDeposit: false,
            displayOrder: 1,
            hideFromFlow: false,
            parentId: parent || undefined
        });
        setIsCreating(true);
        setEditingId(null);
    };

    const handleEdit = (status: ProcessStatus) => {
        setEditingId(status.id);
        setFormData(status);
        setIsCreating(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este status?')) return;
        try {
            await api.delete(`/api/organization/config/process-statuses/${id}`);
            toast.success('Status removido');
            loadStatuses();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao remover status');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                parentId: formData.parentId || undefined, // Send undefined if null/empty
                icon: formData.icon || undefined // Send undefined if empty
            };

            if (editingId) {
                await api.put(`/api/organization/config/process-statuses/${editingId}`, payload);
                toast.success('Status atualizado');
            } else {
                await api.post('/api/organization/config/process-statuses', payload);
                toast.success('Status criado');
            }
            setEditingId(null);
            setIsCreating(false);
            loadStatuses();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao salvar status');
        }
    };

    const renderStatusForm = () => (
        <div className="bg-slate-50 p-4 rounded-lg border mb-4">
            <h4 className="font-medium mb-4">{editingId ? 'Editar Status' : 'Novo Status'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Nome</label>
                        <Input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Cor</label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                className="w-12 p-1"
                            />
                            <Input
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Escopo</label>
                        <select
                            value={formData.scope}
                            onChange={e => setFormData({ ...formData, scope: e.target.value as any })}
                            className="w-full h-10 px-3 border rounded-md"
                        >
                            <option value="ORDER">Pedido (Geral)</option>
                            <option value="ITEM">Item (Produção Individual)</option>
                            <option value="BOTH">Ambos</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                            Use <strong>Pedido</strong> para etapas da venda (ex: Financeiro). Use <strong>Item</strong> para etapas de produção (ex: Corte, Impressão).
                        </p>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Comportamento (Mapeamento)</label>
                        <select
                            value={formData.mappedBehavior}
                            onChange={e => setFormData({ ...formData, mappedBehavior: e.target.value as any })}
                            className="w-full h-10 px-3 border rounded-md"
                        >
                            <option value="DRAFT">Aberto / Orçamento (Permite Alterações)</option>
                            <option value="APPROVED">Aprovado / Aguardando Aprovação (Venda Confirmada)</option>
                            <option value="IN_PRODUCTION">Em Produção / Arte / Terceirizado (No Kanban)</option>
                            <option value="FINISHED">Finalizado / Disponível para Retirada</option>
                            <option value="DELIVERED">Entregue / Concluído</option>
                            <option value="CANCELLED">Cancelado</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                            Vincula seu status à 'lógica' do sistema. Ex: 'Produção Terceirizada' deve ser <strong>Em Produção</strong> para aparecer no seu quadro de trabalho.
                        </p>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <input
                            type="checkbox"
                            id="allowEdition"
                            checked={formData.allowEdition}
                            onChange={e => setFormData({ ...formData, allowEdition: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="allowEdition" className="text-sm font-medium">Permite Edição do Pedido?</label>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <input
                            type="checkbox"
                            id="requireDeposit"
                            checked={formData.requireDeposit}
                            onChange={e => setFormData({ ...formData, requireDeposit: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="requireDeposit" className="text-sm font-medium text-blue-600">Exigir Sinal (Min %)?</label>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <input
                            type="checkbox"
                            id="requirePayment"
                            checked={formData.requirePayment}
                            onChange={e => setFormData({ ...formData, requirePayment: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="requirePayment" className="text-sm font-medium text-emerald-600">Exigir Quitação Total?</label>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <input
                            type="checkbox"
                            id="hideFromFlow"
                            checked={formData.hideFromFlow}
                            onChange={e => setFormData({ ...formData, hideFromFlow: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="hideFromFlow" className="text-sm font-medium">Ocultar do Fluxo Padrão?</label>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Icone (Lucide Name)</label>
                        <Input
                            value={formData.icon || ''}
                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                            placeholder="ex: CheckCircle"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setIsCreating(false); setEditingId(null); }}>Cancelar</Button>
                    <Button type="submit">Salvar</Button>
                </div>
            </form>
        </div>
    );

    const renderStatusItem = (status: ProcessStatus, level: number = 0) => (
        <div key={status.id} className="mb-2">
            <div className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }} />
                    <div>
                        <div className="font-medium flex items-center gap-2">
                            {status.name}
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 border">{status.mappedBehavior}</span>
                            {status.scope === 'ITEM' && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">Item</span>}
                            {!status.allowEdition && <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">Bloqueado</span>}
                            {status.requireDeposit && <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">Sinal</span>}
                            {status.requirePayment && <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Pago</span>}
                            {status.hideFromFlow && <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-200">Oculto</span>}
                        </div>
                        {status.parentId && <div className="text-xs text-gray-400">Sub-status</div>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(status)}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(status.id)}><Trash2 className="w-4 h-4" /></Button>
                    {/* Only allow sub-statuses for root items to keep it simple (2 levels) */}
                    {level === 0 && <Button size="sm" variant="outline" onClick={() => handleCreate(status.id)}><Plus className="w-3 h-3 mr-1" /> Sub-status</Button>}
                </div>
            </div>
            {status.children && status.children.length > 0 && (
                <div className="ml-8 mt-2 pl-4 border-l-2 border-gray-100">
                    {status.children.map(child => renderStatusItem(child, level + 1))}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Status do Fluxo de Trabalho</h3>
                    <p className="text-sm text-gray-500">Defina os estados possíveis para seus pedidos e itens de produção.</p>
                </div>
                {!isCreating && !editingId && (
                    <Button onClick={() => handleCreate(null)}>
                        <Plus className="w-4 h-4 mr-2" /> Novo Status
                    </Button>
                )}
            </div>

            {(isCreating || editingId) && renderStatusForm()}

            <div className="space-y-2">
                {loading ? (
                    <div>Carregando...</div>
                ) : (
                    statuses.map(s => renderStatusItem(s))
                )}
            </div>
        </div>
    );
};

export default ProcessStatusSettings;
