import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Layers } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  description?: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  unit: string;
  standardWidth?: number;
  standardLength?: number;
  active: boolean;
  _count: {
    components: number;
    inventoryItems: number;
  };
}

const Materiais: React.FC = () => {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: 'SHEET' as const,
    costPerUnit: '',
    unit: 'm²',
    standardWidth: '',
    standardLength: ''
  });

  useEffect(() => {
    loadMateriais();
  }, []);

  const loadMateriais = async () => {
    try {
      const response = await api.get('/api/catalog/materials');
      setMateriais(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      format: formData.format,
      costPerUnit: parseFloat(formData.costPerUnit),
      unit: formData.unit,
      standardWidth: formData.standardWidth ? parseFloat(formData.standardWidth) : undefined,
      standardLength: formData.standardLength ? parseFloat(formData.standardLength) : undefined
    };
    
    try {
      if (editingMaterial) {
        await api.put(`/api/catalog/materials/${editingMaterial.id}`, payload);
        toast.success('Material atualizado com sucesso!');
      } else {
        await api.post('/api/catalog/materials', payload);
        toast.success('Material criado com sucesso!');
      }
      
      setShowForm(false);
      setEditingMaterial(null);
      resetForm();
      loadMateriais();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar material');
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      description: material.description || '',
      format: material.format,
      costPerUnit: material.costPerUnit.toString(),
      unit: material.unit,
      standardWidth: material.standardWidth?.toString() || '',
      standardLength: material.standardLength?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este material?')) return;
    
    try {
      await api.delete(`/api/catalog/materials/${id}`);
      toast.success('Material removido com sucesso!');
      loadMateriais();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover material');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      format: 'SHEET',
      costPerUnit: '',
      unit: 'm²',
      standardWidth: '',
      standardLength: ''
    });
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'ROLL': return 'Rolo';
      case 'SHEET': return 'Chapa';
      case 'UNIT': return 'Unidade';
      default: return format;
    }
  };

  const handleFormatChange = (format: string) => {
    let unit = 'm²';
    if (format === 'ROLL') unit = 'ml';
    if (format === 'UNIT') unit = 'un';
    
    setFormData(prev => ({ ...prev, format: format as any, unit }));
  };

  const filteredMateriais = materiais.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground">Materiais</h1>
          <p className="text-muted-foreground">
            Gerencie matérias-primas e insumos
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Material
        </Button>
      </div>

      {/* Search */}
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
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingMaterial ? 'Editar Material' : 'Novo Material'}
              </CardTitle>
              <CardDescription>
                Configure as informações do material
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Material *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Lona 440g Branca"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional do material"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Formato *</label>
                    <select
                      value={formData.format}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                      required
                    >
                      <option value="SHEET">Chapa (área)</option>
                      <option value="ROLL">Rolo (comprimento)</option>
                      <option value="UNIT">Unidade (quantidade)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unidade *</label>
                    <Input
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="m², ml, un"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Custo por Unidade (R$) *</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: e.target.value }))}
                    placeholder="0.0000"
                    required
                  />
                </div>

                {(formData.format === 'ROLL' || formData.format === 'SHEET') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Largura Padrão (mm)
                      </label>
                      <Input
                        type="number"
                        value={formData.standardWidth}
                        onChange={(e) => setFormData(prev => ({ ...prev, standardWidth: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {formData.format === 'ROLL' ? 'Comprimento Padrão (mm)' : 'Altura Padrão (mm)'}
                      </label>
                      <Input
                        type="number"
                        value={formData.standardLength}
                        onChange={(e) => setFormData(prev => ({ ...prev, standardLength: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingMaterial(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingMaterial ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Materiais List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMateriais.map((material) => (
          <Card key={material.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{material.name}</CardTitle>
                  <CardDescription>
                    {getFormatLabel(material.format)} • {material.unit}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(material)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(material.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {material.description && (
                  <p className="text-sm text-muted-foreground">
                    {material.description}
                  </p>
                )}
                
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Custo: </span>
                    {formatCurrency(material.costPerUnit)}/{material.unit}
                  </p>
                  
                  {(material.standardWidth || material.standardLength) && (
                    <p className="text-sm">
                      <span className="font-medium">Dimensões: </span>
                      {material.standardWidth && `${material.standardWidth}mm`}
                      {material.standardWidth && material.standardLength && ' × '}
                      {material.standardLength && `${material.standardLength}mm`}
                    </p>
                  )}
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>{material._count.components} produto(s)</span>
                    <span>{material._count.inventoryItems} estoque(s)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMateriais.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum material encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando seu primeiro material'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Material
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Materiais;