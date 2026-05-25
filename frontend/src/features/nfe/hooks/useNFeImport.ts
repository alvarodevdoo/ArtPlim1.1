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
  const [isCheckingSupplier, setIsCheckingSupplier] = useState(false);
  const [showSupplierRegistration, setShowSupplierRegistration] = useState(false);

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

  /**
   * Após carregar uma NF-e, consulta o histórico de importações.
   * Se já houver itens importados anteriormente, marca-os como `skip` e
   * exibe um aviso ao usuário — evita duplicar entrada de estoque.
   */
  const applyImportHistory = async (data: NFeData): Promise<NFeData> => {
    if (!data?.chaveAcesso || data.chaveAcesso.length !== 44) return data;
    try {
      const resp = await api.get('/api/nfe/imports/check', {
        params: { chave: data.chaveAcesso }
      });
      const info = resp.data?.data;
      if (!info?.exists) return data;

      const imported = new Set<string>(info.importedCodes || []);
      let skippedCount = 0;
      const items = data.items.map(it => {
        if (imported.has(String(it.codigo))) {
          skippedCount++;
          return { ...it, skip: true, createNew: false, mappedMaterialId: undefined };
        }
        return it;
      });

      if (skippedCount > 0) {
        toast.warning(
          `Esta NF-e já foi importada antes. ${skippedCount} ${skippedCount === 1 ? 'item já registrado foi marcado como descartado' : 'itens já registrados foram marcados como descartados'} automaticamente.`,
          { duration: 6000 }
        );
      } else if (info.importsCount > 0) {
        toast.info('Esta chave já foi processada antes, mas nenhum item coincidiu com os anteriores.');
      }
      return { ...data, items };
    } catch {
      return data;
    }
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
      const enriched = await applyImportHistory(resp.data.data);
      setNfeData(enriched);
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
      const enriched = await applyImportHistory(resp.data.data);
      setNfeData(enriched);
      setStep(2);
      toast.success('Nota baixada da SEFAZ com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao buscar nota na SEFAZ. Verifique sua conexão e se o certificado está configurado.');
      setHasKeyError(true); // Sinaliza para o NFeKeyInput limpar e refocalizar
    } finally {
      setIsLoading(false);
    }
  };

  const proceedToMapping = async () => {
    if (!nfeData) return;
    const cnpj = String(nfeData.emitente.cnpj ?? '').replace(/\D/g, '');
    if (!cnpj) {
      // Sem CNPJ na nota, segue direto. O backend tentará criar o perfil na importação.
      setStep(3);
      return;
    }

    setIsCheckingSupplier(true);
    try {
      const resp = await api.get('/api/profiles', {
        params: { search: cnpj, isSupplier: true, limit: 5 }
      });
      const list: any[] = resp.data?.data || [];
      const exists = list.some(p => (p.document || '').replace(/\D/g, '') === cnpj);
      if (exists) {
        setStep(3);
      } else {
        setShowSupplierRegistration(true);
      }
    } catch (err: any) {
      // Em caso de falha na verificação, abre o cadastro como medida segura,
      // pois o usuário pediu para cadastrar antes de avançar.
      setShowSupplierRegistration(true);
    } finally {
      setIsCheckingSupplier(false);
    }
  };

  const handleSupplierRegistered = () => {
    setShowSupplierRegistration(false);
    setStep(3);
  };

  const handleSupplierRegistrationCancel = () => {
    setShowSupplierRegistration(false);
  };

  const handleCreateNewToggle = (index: number) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      const current = nm.items[index];
      const willCreate = !current.createNew;
      nm.items[index] = {
        ...current,
        createNew: willCreate,
        mappedMaterialId: undefined,
        minStockQuantity: willCreate && current.minStockQuantity === undefined ? 1 : current.minStockQuantity
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

  const setExtraCost = (
    field: 'extraFreightCost' | 'extraTaxesCost' | 'extraOtherCost',
    value: number | undefined
  ) => {
    setNfeData(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
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
      const toMeters = (v: number | undefined, unit: 'm' | 'cm' | 'mm' | undefined) => {
        if (v === undefined || v === null) return undefined;
        switch (unit) {
          case 'cm': return v / 100;
          case 'mm': return v / 1000;
          default: return v;
        }
      };
      const payload = {
        ...nfeData,
        items: nfeData.items.map(i => ({
          ...i,
          width: toMeters(i.width, i.dimensionUnit),
          height: toMeters(i.height, i.dimensionUnit),
          dimensionUnit: undefined,
        })),
      };
      await api.post('/api/nfe/import', payload);
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

  const updateNewItemField = (
    index: number,
    field: 'minStockQuantity' | 'width' | 'height',
    value: number | undefined
  ) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      nm.items = [...nm.items];
      nm.items[index] = { ...nm.items[index], [field]: value };
      return nm;
    });
  };

  const setItemDimensionUnit = (index: number, unit: 'm' | 'cm' | 'mm') => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      nm.items = [...nm.items];
      nm.items[index] = { ...nm.items[index], dimensionUnit: unit };
      return nm;
    });
  };

  const copyNewItemDefaultsToSelected = (sourceIndex: number) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const src = prev.items[sourceIndex];
      if (!src) return prev;
      const targets = selectedIndexes.filter(i => i !== sourceIndex);
      if (targets.length === 0) return prev;
      const nm = { ...prev };
      nm.items = [...nm.items];
      targets.forEach(idx => {
        nm.items[idx] = {
          ...nm.items[idx],
          createNew: true,
          skip: false,
          mappedMaterialId: undefined,
          categoryId: src.categoryId,
          width: src.width,
          height: src.height,
          dimensionUnit: src.dimensionUnit,
          // estoque mínimo NÃO é copiado — preserva valor atual ou default 1 se ainda indefinido
          minStockQuantity: nm.items[idx].minStockQuantity ?? 1,
        };
      });
      return nm;
    });
  };

  const setItemCategory = (index: number, categoryId: string) => {
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      nm.items = [...nm.items];
      nm.items[index] = { ...nm.items[index], categoryId: categoryId || undefined };
      return nm;
    });
  };

  const bulkUpdate = (data: Partial<NFeItem>) => {
    if (selectedIndexes.length === 0) return;
    setNfeData(prev => {
      if (!prev) return prev;
      const nm = { ...prev };
      selectedIndexes.forEach(idx => {
        const merged = { ...nm.items[idx], ...data };
        // Garantir estoque mínimo padrão = 1 ao marcar como novo (sem sobrescrever valor já definido)
        if (data.createNew && merged.minStockQuantity === undefined) {
          merged.minStockQuantity = 1;
        }
        nm.items[idx] = merged;
      });
      return nm;
    });
  };

  /**
   * Limpa o estado de importação e volta ao passo inicial.
   * Usado pelo botão "Descartar" ao tentar sair da página.
   */
  const resetImport = () => {
    setStep(1);
    setNfeData(null);
    setSelectedIndexes([]);
    setHasKeyError(false);
    setIsCheckingSupplier(false);
    setShowSupplierRegistration(false);
  };

  /**
   * Restaura um snapshot previamente persistido (ex: ao voltar pra página
   * depois de "Continuar mais tarde"). Aceita parcial — campos ausentes
   * caem em defaults seguros.
   */
  const restoreImport = (snapshot: {
    step?: 1 | 2 | 3;
    nfeData?: NFeData | null;
    selectedIndexes?: number[];
  }) => {
    if (snapshot.nfeData) setNfeData(snapshot.nfeData);
    if (snapshot.selectedIndexes) setSelectedIndexes(snapshot.selectedIndexes);
    if (snapshot.step) setStep(snapshot.step);
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
    resetImport,
    restoreImport,
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
    updateNewItemField,
    setItemCategory,
    setItemDimensionUnit,
    copyNewItemDefaultsToSelected,
    bulkUpdate,
    handleSetDistributionMode,
    setExtraCost,
    importNFe,
    isCheckingSupplier,
    showSupplierRegistration,
    proceedToMapping,
    handleSupplierRegistered,
    handleSupplierRegistrationCancel
  };
}
