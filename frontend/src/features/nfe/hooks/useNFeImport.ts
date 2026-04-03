import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { NFeData } from '../types';

export function useNFeImport() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [availableMaterials, setAvailableMaterials] = useState<{ id: string; name: string; category: string }[]>([]);

  useEffect(() => {
    // Carrega materiais do ERP para possibilitar o vínculo (auto-complete)
    api.get('/api/catalog/materials').then(res => {
      setAvailableMaterials(res.data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        category: m.category || 'Outros'
      })));
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
      nm.items[index] = {
        ...nm.items[index],
        createNew: false,
        skip: false,
        mappedMaterialId: materialId
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

  return {
    step,
    setStep,
    isDragging,
    isLoading,
    nfeData,
    availableMaterials,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFile,
    handleCreateNewToggle,
    handleBindExisting,
    handleToggleSkip,
    handleSetDistributionMode,
    importNFe
  };
}
