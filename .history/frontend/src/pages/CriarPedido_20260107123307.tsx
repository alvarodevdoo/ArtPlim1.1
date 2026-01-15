import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Search, 
  Save, 
  ArrowLeft,
  User,
  DollarSign,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Edit,
  Plus,
  UserX,
  Receipt
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import AddItemForm from '@/components/pedidos/AddItemForm';

// Opções para exibição nos itens (importadas do AddItemForm)
const paperSizeOptions = [
  { value: 'A3', label: 'A3 (297 × 420mm)' },
  { value: 'A4', label: 'A4 (210 × 297mm)' },
  { value: 'A5', label: 'A5 (148 × 210mm)' },
  { value: 'CARTA', label: 'Carta (216 × 279mm)' },
  { value: 'OFICIO', label: 'Ofício (216 × 355mm)' },
  { value: 'CUSTOM', label: 'Personalizado' }
];

const paperTypeOptions = [
  { value: 'SULFITE_75', label: 'Sulfite 75g' },
  { value: 'SULFITE_90', label: 'Sulfite 90g' },
  { value: 'COUCHE_115', label: 'Couché 115g' },
  { value: 'COUCHE_150', label: 'Couché 150g' },
  { value: 'COUCHE_170', label: 'Couché 170g' },
  { value: 'CARTAO_250', label: 'Cartão 250g' },
  { value: 'CARTAO_300', label: 'Cartão 300g' }
];

const printColorsOptions = [
  { value: '1x0', label: '1x0 (Preto frente)', sides: 'FRENTE' },
  { value: '1x1', label: '1x1 (Preto frente e verso)', sides: 'FRENTE_VERSO' },
  { value: '4x0', label: '4x0 (Colorido frente)', sides: 'FRENTE' },
  { value: '4x1', label: '4x1 (Colorido frente, preto verso)', sides: 'FRENTE_VERSO' },
  { value: '4x4', label: '4x4 (Colorido frente e verso)', sides: 'FRENTE_VERSO' }
];

const finishingOptions = [
  { value: 'NONE', label: 'Sem acabamento' },
  { value: 'LAMINACAO_FOSCA', label: 'Laminação Fosca' },
  { value: 'LAMINACAO_BRILHO', label: 'Laminação Brilho' },
  { value: 'VERNIZ_UV', label: 'Verniz UV' },
  { value: 'VERNIZ_LOCALIZADO', label: 'Verniz Localizado' },
  { value: 'CORTE_VINCO', label: 'Corte e Vinco' }
];

const complexityOptions = [
  { value: 'SIMPLES', label: 'Simples' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'COMPLEXO', label: 'Complexo' },
  { value: 'MUITO_COMPLEXO', label: 'Muito Complexo' }
];

interface Cliente {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
}

interface Produto {
  id: string;
  name: string;
  description?: string;
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice?: number;
  minPrice?: number;
  standardSizes?: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isDefault: boolean;
  }>;
}

interface ItemPedido {
  id: string;
  productId: string;
  product?: Produto;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  
  // Campos específicos por tipo
  area?: number;
  paperSize?: string;
  paperType?: string;
  printColors?: string;
  finishing?: string;
  machineTime?: number;
  setupTime?: number;
  complexity?: string;
  
  // Tamanho personalizado
  customSizeName?: string;
  isCustomSize?: boolean;
}

const CriarPedido: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = !!editId;
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  // Refs para controlar dropdowns
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  
  // Dados do pedido
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [searchCliente, setSearchCliente] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Edição de item
  const [editingItem, setEditingItem] = useState<ItemPedido | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadClientes();
    loadProdutos();
    
    // Se estiver editando, carregar dados do pedido
    if (isEditing && editId) {
      loadPedidoParaEdicao(editId);
    }
  }, [isEditing, editId]);

  // Effect para fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Fechar dropdown de cliente
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setShowClienteDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Fechar dropdowns ao pressionar Escape
      if (event.key === 'Escape') {
        setShowClienteDropdown(false);
      }
    };

    // Adicionar event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadClientes = async () => {
    try {
      const response = await api.get('/api/profiles?isCustomer=true');
      setClientes(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products?include=standardSizes');
      setProdutos(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    }
  };

  const loadPedidoParaEdicao = async (pedidoId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales/orders/${pedidoId}`);
      const pedido = response.data.data;
      
      // Verificar se o pedido pode ser editado
      if (pedido.status !== 'DRAFT') {
        toast.error('Apenas pedidos em rascunho podem ser editados');
        navigate('/pedidos');
        return;
      }
      
      // Carregar dados do cliente
      setClienteSelecionado(pedido.customer);
      setSearchCliente(pedido.customer.name);
      
      // Carregar itens do pedido
      const itensCarregados = pedido.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
        
        // Campos específicos por tipo
        area: item.area,
        paperSize: item.paperSize,
        paperType: item.paperType,
        printColors: item.printColors,
        finishing: item.finishing,
        machineTime: item.machineTime,
        setupTime: item.setupTime,
        complexity: item.complexity,
        
        // Tamanho personalizado
        customSizeName: item.customSizeName,
        isCustomSize: item.isCustomSize || false
      }));
      
      setItens(itensCarregados);
      
      // Carregar dados adicionais
      if (pedido.deliveryDate) {
        setDeliveryDate(new Date(pedido.deliveryDate).toISOString().split('T')[0]);
      }
      setNotes(pedido.notes || '');
      
      toast.success('Pedido carregado para edição!');
    } catch (error: any) {
      console.error('Erro ao carregar pedido:', error);
      toast.error('Erro ao carregar pedido para edição');
      navigate('/pedidos');
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(cliente =>
    cliente.name.toLowerCase().includes(searchCliente.toLowerCase()) ||
    (cliente.document && cliente.document.includes(searchCliente))
  );

  const handleAddItem = (item: ItemPedido) => {
    setItens(prev => [...prev, item]);
    setShowAddModal(false);
  };

  const handleUpdateItem = (item: ItemPedido) => {
    setItens(prev => prev.map(existingItem => 
      existingItem.id === item.id ? item : existingItem
    ));
    setEditingItem(null);
    setShowEditModal(false);
  };

  const cancelarEdicao = () => {
    setEditingItem(null);
    setShowEditModal(false);
  };

  const abrirModalAdicionar = () => {
    setShowAddModal(true);
  };

  const cancelarAdicao = () => {
    setShowAddModal(false);
  };

  const formatarUnidadePreco = (produto?: Produto) => {
    if (!produto) return '/un';
    
    switch (produto.pricingMode) {
      case 'SIMPLE_AREA':
        return '/m²';
      case 'SIMPLE_UNIT':
        return '/un';
      case 'DYNAMIC_ENGINEER':
        return '/un';
      default:
        return '/un';
    }
  };

  const removerItem = (itemId: string) => {
    setItens(prev => prev.filter(item => item.id !== itemId));
    toast.success('Item removido do pedido');
  };

  const editarItem = (item: ItemPedido) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.totalPrice, 0);
  };

  const salvarPedido = async () => {
    if (!clienteSelecionado) {
      toast.error('Selecione um cliente');
      return;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    setLoading(true);
    try {
      const pedidoData = {
        customerId: clienteSelecionado.id,
        items: itens.map(item => ({
          productId: item.productId,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          
          // Campos específicos por tipo
          area: item.area,
          paperSize: item.paperSize,
          paperType: item.paperType,
          printColors: item.printColors,
          finishing: item.finishing,
          machineTime: item.machineTime,
          setupTime: item.setupTime,
          complexity: item.complexity,
          
          // Tamanho personalizado
          customSizeName: item.customSizeName,
          isCustomSize: item.isCustomSize
        })),
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined
      };

      if (isEditing && editId) {
        // Atualizar pedido existente
        await api.put(`/api/sales/orders/${editId}`, pedidoData);
        toast.success('Pedido atualizado com sucesso!');
      } else {
        // Criar novo pedido
        await api.post('/api/sales/orders', pedidoData);
        toast.success('Pedido criado com sucesso!');
      }
      
      navigate('/pedidos');
    } catch (error: any) {
      console.error('Erro ao salvar pedido:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <span>{isEditing ? 'Editar Pedido' : 'Criar Novo Pedido'}</span>
              {isEditing && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Editando
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isEditing 
                ? 'Modifique as informações do pedido existente' 
                : 'Preencha as informações para criar um novo pedido ou orçamento'
              }
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button onClick={salvarPedido} disabled={loading || !clienteSelecionado || itens.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Salvando...' : isEditing ? 'Atualizar Pedido' : 'Criar Pedido'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Seleção de Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Cliente</span>
              </CardTitle>
              <CardDescription>
                {clienteSelecionado ? 'Cliente selecionado para este pedido' : 'Selecione o cliente para este pedido'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Campo de busca - só mostra se não tiver cliente selecionado */}
                {!clienteSelecionado && (
                  <div className="relative" ref={clienteDropdownRef}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Buscar cliente por nome ou documento..."
                      value={searchCliente}
                      onChange={(e) => {
                        setSearchCliente(e.target.value);
                        setShowClienteDropdown(true);
                      }}
                      onFocus={() => setShowClienteDropdown(true)}
                      onBlur={() => {
                        // Só fechar se não estiver clicando em um item do dropdown
                        setTimeout(() => {
                          if (!clienteDropdownRef.current?.contains(document.activeElement)) {
                            setShowClienteDropdown(false);
                          }
                        }, 150);
                      }}
                      className="pl-10"
                    />
                    
                    {showClienteDropdown && clientesFiltrados.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {clientesFiltrados.map(cliente => (
                          <div
                            key={cliente.id}
                            className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                            onClick={() => {
                              setClienteSelecionado(cliente);
                              setSearchCliente(cliente.name);
                              setShowClienteDropdown(false);
                            }}
                          >
                            <div className="font-medium">{cliente.name}</div>
                            {cliente.document && (
                              <div className="text-sm text-muted-foreground">{cliente.document}</div>
                            )}
                            {cliente.phone && (
                              <div className="text-sm text-muted-foreground">{cliente.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tarja verde com cliente selecionado */}
                {clienteSelecionado && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{clienteSelecionado.name}</p>
                          <p className="text-sm text-green-600">
                            {clienteSelecionado.email} • {clienteSelecionado.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setClienteSelecionado(null);
                            setSearchCliente('');
                          }}
                          className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800"
                          title="Trocar Cliente"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800"
                          title="Dados para Faturamento"
                        >
                          <Receipt className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Itens */}
          {itens.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Itens do Pedido ({itens.length})</CardTitle>
                  <Button
                    onClick={abrirModalAdicionar}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Item</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itens.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`border rounded-lg p-4 ${
                        editingItem?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-border'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">
                              #{index + 1}
                            </span>
                            <h5 className="font-medium">{item.product?.name}</h5>
                            {editingItem?.id === item.id && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                Editando
                              </span>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                            <p><span className="font-medium">Dimensões:</span> {item.width} × {item.height} mm</p>
                            <p><span className="font-medium">Quantidade:</span> {item.quantity} unidade(s)</p>
                            {/* Mostrar área apenas para produtos por m² */}
                            {item.product?.pricingMode === 'SIMPLE_AREA' && (
                              <>
                                <p><span className="font-medium">Área:</span> {((item.width * item.height) / 1000000).toFixed(4)} m²</p>
                                <p><span className="font-medium">Área Total:</span> {((item.width * item.height * item.quantity) / 1000000).toFixed(4)} m²</p>
                              </>
                            )}
                          </div>
                          
                          {/* Campos específicos por tipo de produto */}
                          {item.product?.pricingMode === 'SIMPLE_UNIT' && (item.paperSize || item.paperType || item.printColors) && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                              <p className="font-medium text-green-800 mb-1">Especificações de Impressão:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {item.isCustomSize && item.customSizeName && (
                                  <p><span className="font-medium">Tamanho:</span> {item.customSizeName}</p>
                                )}
                                {!item.isCustomSize && item.paperSize && (
                                  <p><span className="font-medium">Papel:</span> {paperSizeOptions.find(opt => opt.value === item.paperSize)?.label || item.paperSize}</p>
                                )}
                                {item.paperType && <p><span className="font-medium">Tipo:</span> {paperTypeOptions.find(opt => opt.value === item.paperType)?.label || item.paperType}</p>}
                                {item.printColors && (
                                  <>
                                    <p><span className="font-medium">Cores:</span> {printColorsOptions.find(opt => opt.value === item.printColors)?.label || item.printColors}</p>
                                    <p><span className="font-medium">Lados:</span> {printColorsOptions.find(opt => opt.value === item.printColors)?.sides === 'FRENTE_VERSO' ? 'Frente e Verso' : 'Apenas Frente'}</p>
                                  </>
                                )}
                                {item.finishing && <p><span className="font-medium">Acabamento:</span> {finishingOptions.find(opt => opt.value === item.finishing)?.label || item.finishing}</p>}
                              </div>
                            </div>
                          )}
                          
                          {item.product?.pricingMode === 'DYNAMIC_ENGINEER' && (item.machineTime || item.setupTime || item.complexity) && (
                            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                              <p className="font-medium text-purple-800 mb-1">Especificações de Produção:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {item.machineTime && <p><span className="font-medium">Tempo Máquina:</span> {item.machineTime} min</p>}
                                {item.setupTime && <p><span className="font-medium">Setup:</span> {item.setupTime} min</p>}
                                {item.complexity && <p><span className="font-medium">Complexidade:</span> {complexityOptions.find(opt => opt.value === item.complexity)?.label || item.complexity}</p>}
                              </div>
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">Observações:</span> {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-medium">{formatCurrency(item.unitPrice)}{formatarUnidadePreco(item.product)}</p>
                          <p className="text-lg font-bold">{formatCurrency(item.totalPrice)}</p>
                          <div className="flex space-x-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editarItem(item)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => removerItem(item.id)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Mensagem quando não há itens */
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Nenhum item adicionado</h3>
                    <p className="text-muted-foreground mb-6">
                      Adicione itens ao pedido usando o formulário acima ou clique no botão abaixo
                    </p>
                  </div>
                  <Button
                    onClick={abrirModalAdicionar}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Primeiro Item</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Resumo */}
        <div className="space-y-6">
          {/* Resumo do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Resumo do Pedido</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Itens:</span>
                  <span className="font-medium">{itens.length}</span>
                </div>
                
                {/* Mostrar área total apenas se houver produtos por m² */}
                {itens.some(item => item.product?.pricingMode === 'SIMPLE_AREA') && (
                  <div className="flex justify-between items-center">
                    <span>Área Total:</span>
                    <span className="font-medium">
                      {itens
                        .filter(item => item.product?.pricingMode === 'SIMPLE_AREA')
                        .reduce((total, item) => 
                          total + ((item.width * item.height * item.quantity) / 1000000), 0
                        ).toFixed(4)} m²
                    </span>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(calcularTotal())}
                    </span>
                  </div>
                </div>

                {calcularTotal() > 0 && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {itens.some(item => item.product?.pricingMode === 'SIMPLE_AREA') && (
                      <p>Preço médio por m²: {formatCurrency(calcularTotal() / Math.max(0.0001, itens
                        .filter(item => item.product?.pricingMode === 'SIMPLE_AREA')
                        .reduce((total, item) => 
                          total + ((item.width * item.height * item.quantity) / 1000000), 0
                        )))}</p>
                    )}
                    <p>Produtos por m²: {itens.filter(item => item.product?.pricingMode === 'SIMPLE_AREA').length}</p>
                    <p>Produtos por unidade: {itens.filter(item => item.product?.pricingMode === 'SIMPLE_UNIT').length}</p>
                    {itens.some(item => item.product?.pricingMode === 'DYNAMIC_ENGINEER') && (
                      <p>Produtos dinâmicos: {itens.filter(item => item.product?.pricingMode === 'DYNAMIC_ENGINEER').length}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Informações Adicionais</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Data de Entrega (Opcional)</label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Observações Gerais</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações gerais do pedido..."
                    className="w-full h-24 p-3 border border-input rounded-md resize-none mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  {clienteSelecionado ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm">Cliente selecionado</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {itens.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm">Itens adicionados</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {calcularTotal() > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm">Valores definidos</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Edição de Item */}
      {showEditModal && editingItem && (
        <AddItemForm
          produtos={produtos}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          editingItem={editingItem}
          isModal={true}
          onCancel={cancelarEdicao}
        />
      )}

      {/* Modal de Adição de Item */}
      {showAddModal && (
        <AddItemForm
          produtos={produtos}
          onAddItem={handleAddItem}
          isModal={true}
          onCancel={cancelarAdicao}
        />
      )}
    </div>
  );
};

export default CriarPedido;
