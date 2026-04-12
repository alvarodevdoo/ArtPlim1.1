import { NFeUploadArea } from '@/features/nfe/components/NFeUploadArea';
import { NFeKeyInput } from '@/features/nfe/components/NFeKeyInput';
import { NFeSupplierSummary } from '@/features/nfe/components/NFeSupplierSummary';
import { NFeItemMapper } from '@/features/nfe/components/NFeItemMapper';
import { useNFeImport } from '@/features/nfe/hooks/useNFeImport';

export default function EntradaNota() {
  const {
    step,
    setStep,
    isDragging,
    isLoading,
    nfeData,
    selectedIndexes,
    handleToggleSelect,
    handleSelectAll,
    bulkUpdate,
    availableMaterials,
    categories,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFile,
    fetchNFeByChave,
    hasKeyError,
    clearKeyError,
    handleCreateNewToggle,
    handleBindExisting,
    handleToggleSkip,
    handleUpdateQuantity,
    handleSetDistributionMode,
    importNFe
  } = useNFeImport();

  return (
    <div className="h-full flex flex-col space-y-6 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Entrada de Notas</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Processamento inteligente de XML e automação de estoque.</p>
        </div>
        
        {step > 1 && nfeData && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase text-slate-400">NF-e Nº</span>
              <span className="text-sm font-bold text-slate-700">{nfeData.numero}</span>
            </div>
            <div className="w-px h-8 bg-slate-100 mx-2" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400">Fornecedor</span>
              <span className="text-sm font-bold text-slate-700">{nfeData.emitente.nomeFantasia || nfeData.emitente.razaoSocial}</span>
            </div>
          </div>
        )}
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <NFeKeyInput 
            onSearch={fetchNFeByChave}
            isLoading={isLoading}
            clearOnError={hasKeyError}
            onErrorCleared={clearKeyError}
          />
          
          <div className="relative flex items-center justify-center py-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <span className="relative bg-slate-50 px-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Ou se preferir
            </span>
          </div>

          <NFeUploadArea 
            isDragging={isDragging}
            isLoading={isLoading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileProcess={processFile}
          />
        </div>
      )}

      {step === 2 && nfeData && (
        <NFeSupplierSummary 
          nfeData={nfeData} 
          onContinue={() => setStep(3)} 
        />
      )}

      {step === 3 && nfeData && (
        <NFeItemMapper 
          nfeData={nfeData}
          isLoading={isLoading}
          selectedIndexes={selectedIndexes}
          availableMaterials={availableMaterials}
          onImport={importNFe}
          onToggleNew={handleCreateNewToggle}
          onBindExisting={handleBindExisting}
          onToggleSkip={handleToggleSkip}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onUpdateQuantity={handleUpdateQuantity}
          onBulkUpdate={bulkUpdate}
          onSetDistributionMode={handleSetDistributionMode}
          categories={categories}
        />
      )}
    </div>
  );
}
