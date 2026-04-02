import React from 'react';
import { NFeUploadArea } from '@/features/nfe/components/NFeUploadArea';
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
    availableMaterials,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFile,
    handleCreateNewToggle,
    handleBindExisting,
    importNFe
  } = useNFeImport();

  return (
    <div className="h-full flex flex-col space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Entrada de Nota Fiscal</h1>
        <p className="text-muted-foreground mt-1">Automatize a entrada de estoque mapeando XMLs dos fornecedores.</p>
      </div>

      {step === 1 && (
        <NFeUploadArea 
          isDragging={isDragging}
          isLoading={isLoading}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileProcess={processFile}
        />
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
          availableMaterials={availableMaterials}
          onImport={importNFe}
          onToggleNew={handleCreateNewToggle}
          onBindExisting={handleBindExisting}
        />
      )}
    </div>
  );
}
