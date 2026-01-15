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
import AddItemModalFlow from '@/components/pedidos/AddItemModalFlow';
import { ItemType, ITEM_TYPE_CONFIGS } from '@/types/item-types';

// Helper function to render simplified item display
const renderItemDisplay = (item: ItemPedido) => {
  // Only show additional info for products with special attributes
  const attributes = item.attributes || {};

  if (item.product?.pricingMode === 'DYNAMIC_ENGINEER' && (attributes.complexity || attributes.machineTime || attributes.setupTime)) {
    return (
      <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
        <p className="font-medium text-gray-800 mb-1">📦 Especificações do Produto:</p>
        <div className="grid grid-cols-2 gap-2">
          {attributes.complexity && (
            <p><span className="font-medium">Complexidade:</span> {attributes.complexity}</p>
          )}
          {attributes.machineTime && (
            <p><span className="font-medium">Tempo Máquina:</span> {attributes.machineTime} min</p>
          )}
          {attributes.setupTime && (
            <p><span className="font-medium">Setup:</span> {attributes.setupTime} min</p>
          )}
        </div>
      </div>
    );
  }

  return null;
};


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
  productType?: ItemType; // Adicionado campo productType
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
  itemType: ItemType;
  width?: number;
  height?: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  attributes?: Record<string, any>;

  // Legacy fields for backward compatibility
  area?: number;
  paperSize?: string;
  paperType?: string;
  printColors?: string;
  finishing?: string;
  machineTime?: number;
  setupTime?: number;
  complexity?: string;
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
  const [loadingClientes, setLoadingClientes] = useState(false);

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
      // Fechar dropdown de cliente apenas se estiver aberto
      if (showClienteDropdown && clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setShowClienteDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Fechar dropdowns ao pressionar Escape
      if (event.key === 'Escape') {
        setShowClienteDropdown(false);
      }
    };

    // Só adicionar listeners se o dropdown estiver aberto
    if (showClienteDropdown) {
      // Use mousedown instead of click to ensure it fires before onClick on dropdown items
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showClienteDropdown]); // Dependência do estado do dropdown

  const loadClientes = async () => {
    setLoadingClientes(true);
    try {
      const response = await api.get('/api/profiles?isCustomer=true');
      setClientes(response.data.data || []);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoadingClientes(false);
    }
  };

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products?include=standardSizes');
      const produtosData = response.data.data || [];

      // Converter productType string para ItemType enum
      const produtosComTipoCorreto = produtosData.map((produto: any) => ({
        ...produto,
        productType: produto.productType as ItemType // Cast para ItemType
      }));

      setProdutos(produtosComTipoCorreto);

      // Verificar se não há produtos cadastrados
      if (produtosData.length === 0) {
        toast.error('Nenhum produto cadastrado. Cadastre produtos antes de criar pedidos.', {
          duration: 5000,
          action: {
            label: 'Ir para Produtos',
            onClick: () => navigate('/produtos')
          }
        });
        return;
      }

      // Verificar se há materiais cadastrados (necessário para produtos)
      try {
        const materialsResponse = await api.get('/api/catalog/materials');
        const materialsData = materialsResponse.data.data || [];

        if (materialsData.length === 0) {
          toast.error('Nenhum material cadastrado. Cadastre materiais antes de criar pedidos.', {
            duration: 5000,
            action: {
              label: 'Ir para Materiais',
              onClick: () => navigate('/materiais')
            }
          });
        }
      } catch (error) {
        // Error checking materials
      }
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    }
  };

  const loadPedidoParaEdicao = async (pedidoId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales/orders/${pedidoId}`);
      const pedido = response.data.data;

      // Verificar se o pedido pode ser editado
      if (pedido.status === 'DELIVERED') {
        toast.error('Pedidos entregues não podem ser editados');
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
        itemType: item.product?.productType || item.itemType || ItemType.PRODUCT, // Usar productType do produto
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
        attributes: item.attributes || {},

        // Legacy fields for backward compatibility
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
    // Ensure product data is available
    const itemWithProduct = {
      ...item,
      product: item.product || produtos.find(p => p.id === item.productId)
    };
    setItens(prev => [...prev, itemWithProduct]);
    setShowAddModal(false);
  };

  const handleUpdateItem = (item: ItemPedido) => {
    // Ensure product data is preserved
    const itemWithProduct = {
      ...item,
      product: item.product || produtos.find(p => p.id === item.productId)
    };
    setItens(prev => prev.map(existingItem =>
      existingItem.id === itemWithProduct.id ? itemWithProduct : existingItem
    ));
    setEditingItem(null);
    setShowEditModal(false);
  };

  const abrirModalAdicionar = () => {
    // Verificar se há produtos cadastrados
    if (produtos.length === 0) {
      toast.error('Não é possível adicionar itens sem produtos cadastrados.', {
        duration: 5000,
        action: {
          label: 'Cadastrar Produtos',
          onClick: () => navigate('/produtos')
        }
      });
      return;
    }

    setShowAddModal(true);
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
    // Ensure product data is available
    const itemWithProduct = {
      ...item,
      product: item.product || produtos.find(p => p.id === item.productId)
    };
    setEditingItem(itemWithProduct);
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

    // Validação robusta: verificar se há produtos cadastrados
    if (produtos.length === 0) {
      toast.error('Não é possível criar pedidos sem produtos cadastrados.', {
        duration: 5000,
        action: {
          label: 'Cadastrar Produtos',
          onClick: () => navigate('/produtos')
        }
      });
      return;
    }

    // Validar se todos os itens têm dados obrigatórios
    const itensInvalidos = itens.filter(item => {
      const problems = [];
      const isService = item.itemType === ItemType.SERVICE;

      if (!item.productId || item.productId.trim() === '') problems.push('productId vazio');
      if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) problems.push('quantity inválida');
      if (!item.unitPrice || item.unitPrice <= 0 || isNaN(item.unitPrice)) problems.push('unitPrice inválido');
      if (!item.totalPrice || item.totalPrice <= 0 || isNaN(item.totalPrice)) problems.push('totalPrice inválido');

      // Validar se o produto ainda existe na lista de produtos carregados (apenas para produtos, não serviços)
      if (!isService) {
        const produtoExiste = produtos.find(p => p.id === item.productId);
        if (!produtoExiste) problems.push('produto não encontrado');
      }

      if (problems.length > 0) {
        return true;
      }
      return false;
    });

    if (itensInvalidos.length > 0) {
      // Items with validation problems found
      toast.error(`Existem ${itensInvalidos.length} item(ns) com dados incompletos ou produtos inválidos. Verifique os produtos, quantidades e preços.`);
      return;
    }

    // Validar se todos os produtos dos itens ainda existem no backend (apenas produtos, não serviços)
    const productIds = itens
      .filter(item => item.itemType !== ItemType.SERVICE)
      .map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    try {
      const validationPromises = uniqueProductIds.map(async (productId) => {
        try {
          const response = await api.get(`/api/catalog/products/${productId}`);
          return { productId, exists: !!response.data.data };
        } catch (error) {
          return { productId, exists: false };
        }
      });

      const validationResults = await Promise.all(validationPromises);
      const invalidProducts = validationResults.filter(result => !result.exists);

      if (invalidProducts.length > 0) {
        const invalidProductNames = invalidProducts.map(result => {
          const item = itens.find(i => i.productId === result.productId);
          return item?.product?.name || result.productId;
        });

        toast.error(`Os seguintes produtos não existem mais: ${invalidProductNames.join(', ')}. Remova estes itens e tente novamente.`);
        return;
      }
    } catch (error) {
      toast.error('Erro ao validar produtos. Tente novamente.');
      return;
    }

    // Prepare order data for submission
    setLoading(true);
    try {
      const pedidoData = {
        customerId: clienteSelecionado.id,
        items: itens.map(item => ({
          productId: item.productId,
          itemType: item.itemType, // Usar itemType do item (que vem do productType)
          width: item.width ? Number(item.width) : undefined,
          height: item.height ? Number(item.height) : undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice), // Campo obrigatório que estava faltando
          notes: item.notes,
          attributes: item.attributes || {},

          // Legacy fields for backward compatibility
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
      const errorMessage = error.response?.data?.message || 'Erro ao salvar pedido';
      const errorCode = error.response?.data?.code;

      if (errorCode === 'NO_PRODUCTS_AVAILABLE') {
        toast.error(errorMessage, {
          duration: 5000,
          action: {
            label: 'Cadastrar Produtos',
            onClick: () => navigate('/produtos')
          }
        });
      } else if (errorCode === 'INVALID_PRODUCTS') {
        toast.error(errorMessage);
      } else if (errorCode === 'NO_MATERIALS_AVAILABLE') {
        toast.error('Não é possível criar pedidos sem materiais cadastrados.', {
          duration: 5000,
          action: {
            label: 'Cadastrar Materiais',
            onClick: () => navigate('/materiais')
          }
        });
      } else {
        toast.error(errorMessage);
      }
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
                      placeholder={loadingClientes ? "Carregando clientes..." : "Buscar cliente por nome ou documento..."}
                      value={searchCliente}
                      disabled={loadingClientes}
                      onChange={(e) => {
                        setSearchCliente(e.target.value);
                        if (!showClienteDropdown) {
                          setShowClienteDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        setShowClienteDropdown(true);
                      }}
                      className="pl-10"
                    />

                    {showClienteDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {clientesFiltrados.length > 0 ? (
                          clientesFiltrados.map(cliente => (
                            <div
                              key={cliente.id}
                              className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                              onMouseDown={(e) => {
                                // Prevent the input from losing focus before the click is processed
                                e.preventDefault();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setClienteSelecionado(cliente);
                                setSearchCliente(cliente.name);
                                setShowClienteDropdown(false);
                              }}
                            >
                              <div className="font-medium">{cliente.name}</div>
                              {cliente.document && (
                                <div className="text-sm text-gray-500">{cliente.document}</div>
                              )}
                              {cliente.phone && (
                                <div className="text-sm text-gray-500">{cliente.phone}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-gray-500 text-center">
                            {loadingClientes ? (
                              <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span>Carregando clientes...</span>
                              </div>
                            ) : clientes.length === 0 ? (
                              'Nenhum cliente cadastrado'
                            ) : (
                              'Nenhum cliente encontrado'
                            )}
                          </div>
                        )}
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
                  {itens.map((item, index) => {
                    // Ensure product data is available - fetch from produtos list if missing
                    const itemProduct = item.product || produtos.find(p => p.id === item.productId);

                    return (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 ${editingItem?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-border'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">
                                #{index + 1}
                              </span>
                              <h5 className="font-medium">
                                {itemProduct?.name || item.attributes?.serviceName || `Produto (ID: ${item.productId})`}
                              </h5>
                              {(() => {
                                const typeConfig = ITEM_TYPE_CONFIGS[item.itemType];
                                const colorClasses = {
                                  blue: 'bg-blue-100 text-blue-800 border-blue-200',
                                  green: 'bg-green-100 text-green-800 border-green-200',
                                  purple: 'bg-purple-100 text-purple-800 border-purple-200',
                                  red: 'bg-red-100 text-red-800 border-red-200',
                                  gray: 'bg-gray-100 text-gray-800 border-gray-200'
                                };
                                const colorClass = colorClasses[typeConfig.color as keyof typeof colorClasses] || colorClasses.gray;

                                return (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
                                    <span className="mr-1">{typeConfig.icon}</span>
                                    {typeConfig.label}
                                  </span>
                                );
                              })()}
                              {editingItem?.id === item.id && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                  Editando
                                </span>
                              )}
                            </div>

                            {/* Basic item information */}
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <p><span className="font-medium">Qtd:</span> {item.quantity} un</p>

                              {/* Show dimensions only for area-based products */}
                              {itemProduct?.pricingMode === 'SIMPLE_AREA' && item.width && item.height && (
                                <>
                                  <p><span className="font-medium">Dimensões:</span> {item.width} × {item.height} mm</p>
                                  <p><span className="font-medium">Área:</span> {((item.width * item.height) / 1000000).toFixed(4)} m²</p>
                                  <p><span className="font-medium">Área Total:</span> {((item.width * item.height * item.quantity) / 1000000).toFixed(4)} m²</p>
                                </>
                              )}
                            </div>

                            {/* Simplified item display */}
                            {renderItemDisplay(item)}

                            {/* Notes */}
                            {item.notes && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <span className="font-medium">Observações:</span> {item.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-medium">{formatCurrency(item.unitPrice)}{formatarUnidadePreco(itemProduct)}</p>
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
                    )
                  })}

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
                        .filter(item => item.product?.pricingMode === 'SIMPLE_AREA' && item.width && item.height)
                        .reduce((total, item) =>
                          total + (((item.width || 0) * (item.height || 0) * item.quantity) / 1000000), 0
                        ).toFixed(4)} m²
                    </span>
                  </div>
                )}

                <div className="border-t pt-4 pb-0">
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
                        .filter(item => item.product?.pricingMode === 'SIMPLE_AREA' && item.width && item.height)
                        .reduce((total, item) =>
                          total + (((item.width || 0) * (item.height || 0) * item.quantity) / 1000000), 0
                        )))}</p>
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

      {/* Modal Flow para Adicionar/Editar Item */}
      <AddItemModalFlow
        produtos={produtos}
        onAddItem={handleAddItem}
        onUpdateItem={handleUpdateItem}
        editingItem={editingItem} // Sempre passar o editingItem, mesmo que seja null
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setEditingItem(null);
        }}
      />
    </div>
  );
};

export default CriarPedido;
