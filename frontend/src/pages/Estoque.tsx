import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Scissors,
  MapPin,
  Eye,
  Edit
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { EntradasMaterial } from '../features/estoque/EntradasMaterial';

interface InventoryItem {
  id: string;
  width: number;
  length?: number;
  height?: number;
  quantity: number;
  location?: string;
  isOffcut: boolean;
  material: {
    id: string;
    name: string;
    format: string;
    unit: string;
    costPerUnit: number;
  };
  _count: {
    movements: number;
  };
}

interface StockAlert {
  type: string;
  material: {
    id: string;
    name: string;
    format: string;
    unit: string;
  };
  currentLevel: number;
  threshold: number;
  message: string;
}

const Estoque: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'estoque' | 'entradas'>('estoque');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    materialId: '',
    width: '',
    length: '',
    height: '',
    quantity: '1',
    location: '',
    isOffcut: false
  });

  useEffect(() => {
    loadInventory();
    loadAlerts();
  }, []);

  const loadInventory = async () => {
    try {
      const response = await api.get('/api/wms/inventory');
      setInventory(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await api.get('/api/wms/alerts');
      setAlerts(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar alertas');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.post('/api/wms/inventory', {
        materialId: formData.materialId,
        width: parseFloat(formData.width),
        length: formData.length ? parseFloat(formData.length) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        quantity: parseInt(formData.quantity),
        location: formData.location,
        isOffcut: formData.isOffcut
      });
      
      toast.success('Item adicionado ao estoque!');
      setShowAddForm(false);
      resetForm();
      loadInventory();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao adicionar item');
    }
  };

  const resetForm = () => {
    setFormData({
      materialId: '',
      width: '',
      length: '',
      height: '',
      quantity: '1',
      location: '',
      isOffcut: false
    });
  };

  const filteredInventory = inventory.filter(item => {
    if (!item?.material) return false;
    const matchesSearch = 
      item.material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'normal' && !item.isOffcut) ||
      (filterType === 'offcuts' && item.isOffcut);
    
    return matchesSearch && matchesFilter;
  });

  const totalItems = inventory.length;
  const normalStock = inventory.filter(item => item?.material && !item.isOffcut).length;
  const offcuts = inventory.filter(item => item?.material && item.isOffcut).length;
  const totalValue = inventory.reduce((sum, item) => 
    sum + ((item?.quantity || 0) * (item?.material?.costPerUnit ? Number(item.material.costPerUnit) : 0)), 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">
            Gestão avançada de materiais, rolos e retalhos
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className={activeTab === 'entradas' ? 'hidden' : ''}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Item
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'estoque' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          onClick={() => setActiveTab('estoque')}
        >
          Estoque Atual
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'entradas' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          onClick={() => setActiveTab('entradas')}
        >
          Entradas e Recibos
        </button>
      </div>

      {activeTab === 'estoque' && (
        <div className="space-y-6">
          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-sm text-muted-foreground">Total de Itens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{normalStock}</p>
                <p className="text-sm text-muted-foreground">Estoque Normal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Scissors className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{offcuts}</p>
                <p className="text-sm text-muted-foreground">Retalhos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                <p className="text-sm text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span>Alertas de Estoque</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <Button size="sm" variant="outline">
                    Ver Detalhes
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar materiais..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 px-3 py-2 border border-input rounded-md bg-background"
        >
          <option value="all">Todos os itens</option>
          <option value="normal">Estoque normal</option>
          <option value="offcuts">Retalhos</option>
        </select>
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-2xl">

            <CardHeader>
              <CardTitle>Adicionar Item ao Estoque</CardTitle>
              <CardDescription>
                Registre um novo item no controle de estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Material *</label>
                    <select
                      value={formData.materialId}
                      onChange={(e) => setFormData(prev => ({ ...prev, materialId: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                      required
                    >
                      <option value="">Selecione um material</option>
                      {/* Aqui você carregaria os materiais da API */}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantidade *</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Largura (mm) *</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.width}
                      onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comprimento (mm)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.length}
                      onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Altura (mm)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.height}
                      onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Localização</label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Ex: Prateleira A1"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isOffcut"
                    checked={formData.isOffcut}
                    onChange={(e) => setFormData(prev => ({ ...prev, isOffcut: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="isOffcut" className="text-sm font-medium">
                    Este item é um retalho
                  </label>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Adicionar ao Estoque
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventory.map((item) => (
          <Card key={item.id} className={item.isOffcut ? 'border-orange-200 bg-orange-50' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>{item.material.name}</span>
                    {item.isOffcut && (
                      <Scissors className="w-4 h-4 text-orange-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {item.material.format} • {item.material.unit}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button size="icon" variant="ghost">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Dimensões:</span>
                    <p className="text-muted-foreground">
                      {item.width}mm
                      {item.length && ` × ${item.length}mm`}
                      {item.height && ` × ${item.height}mm`}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Quantidade:</span>
                    <p className="text-muted-foreground">{item.quantity} {item.material.unit}</p>
                  </div>
                </div>

                {item.location && (
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{item.location}</span>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Valor: {formatCurrency(item.quantity * Number(item.material.costPerUnit))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item._count.movements} movimentação(ões)
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredInventory.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum item encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'Tente ajustar os filtros' 
                : 'Comece adicionando itens ao estoque'
              }
            </p>
            {!searchTerm && filterType === 'all' && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}
        </div>
      )}

      {activeTab === 'entradas' && <EntradasMaterial />}
    </div>
  );
};

export default Estoque;