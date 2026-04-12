import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { NFeData, NFeItem } from '../types';

export function useNFeImport() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<{ id: string; name: string; category: string; multiplier: number }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [hasKeyError, setHasKeyError] = useState(false);

  useEffect(() => {
    // Carrega materiais do ERP para possibilitar o vínculo (auto-complete) e conversões
    api.get('/api/catalog/materials').then(res => {
      setAvailableMaterials(res.data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        category: m.category?.name || 'Outros',
        multiplier: m.multiplicador_padrao_entrada || 1,
        controlUnit: m.controlUnit,
        conversionFactor: m.conversionFactor || 1
      })));
    }).catch(() => {});

    // Carrega categorias do financeiro (EXPENSE)
    api.get('/api/finance/categories?type=EXPENSE').then(res => {
      setCategories(res.data.data || []);
    }).catch(() => {});
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFile(files[0]);
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast.error('O arquivo precisa ser um .xml válido da NF-e');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await api.post('/api/nfe/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setNfeData(resp.data.data);
      setStep(2);
      toast.success('XML lido com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao processar o XML');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNFeByChave = async (chave: string) => {
    if (chave.length !== 44) {
      toast.error('A chave de acesso precisa ter 44 dígitos.');
      return;
    }

    setIsLoading(true);
    try {
      const resp = await api.post('/api/nfe/fetch', { chave });
      setNfeData(resp.data.data);
      setStep(2);
      toast.success('Nota baixada da SEFAZ com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar nota na SEFAZ. Verifique sua conexão e se o certificado está configurado.');
      setHasKeyError(true); // Sinaliza para o NFeKeyInput limpar e refocalizar
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewToggle = (index: number) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      nm.items[index] = {
        ...nm.items[index],
        createNew: !nm.items[index].createNew,
        mappedMaterialId: undefined
      };
      return nm;
    });
  };

  const handleBindExisting = (index: number, materialId: string) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      const item = nm.items[index];
      
      const mat = availableMaterials.find(m => m.id === materialId);
      const mult = mat?.multiplier || 1;
      const factor = mat?.conversionFactor || 1;
      const isMeasurement = ['M2', 'M', 'ML'].includes(mat?.controlUnit || '');
      
      const internalPieces = (item.quantidadeOriginal ?? item.quantidade) * mult;
      const novaQtde = isMeasurement ? internalPieces * factor : internalPieces;
      const novoCusto = item.valorTotal / (novaQtde > 0 ? novaQtde : 1);

      nm.items[index] = {
        ...item,
        createNew: false,
        skip: false,
        mappedMaterialId: materialId,
        quantidade: novaQtde,
        custoEfetivoUnitario: novoCusto
      };
      return nm;
    });
  };

  const handleToggleSkip = (index: number) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      const isSkipping = !nm.items[index].skip;
      nm.items[index] = {
        ...nm.items[index],
        skip: isSkipping,
        createNew: isSkipping ? false : nm.items[index].createNew,
        mappedMaterialId: isSkipping ? undefined : nm.items[index].mappedMaterialId
      };
      return nm;
    });
  };

  const handleSetDistributionMode = (mode: 'STRICT' | 'REDISTRIBUTE') => {
    setNfeData(prev => {
      if (!prev) return prev;
      return { ...prev, costDistributionMode: mode };
    });
  };

  const importNFe = async () => {
    if (!nfeData) return;

    const hasUnmapped = nfeData.items.some(i => !i.createNew && !i.mappedMaterialId && !i.skip);
    if (hasUnmapped) {
      toast.error('Por favor, vincule todos os itens (ou marque como Novo ou Ignorado) antes de importar.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/nfe/import', nfeData);
      toast.success('Nota de entrada registrada com sucesso. Estoque atualizado!');
      setNfeData(null);
      setStep(1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao importar NF-e.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndexes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = (action: 'ALL' | 'NONE') => {
    if (!nfeData) return;
    if (action === 'ALL') {
      setSelectedIndexes(nfeData.items.map((_, i) => i));
    } else {
      setSelectedIndexes([]);
    }
  };

  const handleUpdateQuantity = (index: number, qty: number) => {
    if (qty <= 0) return;
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      const item = nm.items[index];
      
      // Recalcular o custo unitário baseado no novo total dividido pela nova quantidade
      const novoCustoEfetivo = item.valorTotal / qty;

      nm.items[index] = {
        ...item,
        quantidade: qty,
        custoEfetivoUnitario: novoCustoEfetivo
      };
      
      return nm;
    });
  };

  const bulkUpdate = (data: Partial<NFeItem>) => {
    if (selectedIndexes.length === 0) return;
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      selectedIndexes.forEach(idx => {
        nm.items[idx] = { ...nm.items[idx], ...data };
      });
      return nm;
    });
  };

  return {
    step,
    setStep,
    isDragging,
    isLoading,
    nfeData,
    selectedIndexes,
    availableMaterials,
    categories,
    hasKeyError,
    clearKeyError: () => setHasKeyError(false),
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFile,
    fetchNFeByChave,
    handleCreateNewToggle,
    handleBindExisting,
    handleToggleSkip,
    handleToggleSelect,
    handleSelectAll,
    handleUpdateQuantity,
    bulkUpdate,
    handleSetDistributionMode,
    importNFe
  };
}
