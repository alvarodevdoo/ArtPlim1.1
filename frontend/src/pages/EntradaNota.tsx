import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NFeUploadArea } from '@/features/nfe/components/NFeUploadArea';
import { NFeKeyInput } from '@/features/nfe/components/NFeKeyInput';
import { NFeSupplierSummary } from '@/features/nfe/components/NFeSupplierSummary';
import { NFeSupplierRegistrationModal } from '@/features/nfe/components/NFeSupplierRegistrationModal';
import { NFeItemMapper } from '@/features/nfe/components/NFeItemMapper';
import { useNFeImport } from '@/features/nfe/hooks/useNFeImport';
import { useExitGuard, type ExitIntent } from '@/hooks/useExitGuard';
import { DraftCancelDialog } from '@/components/ui/DraftCancelDialog';
import { DraftBanner } from '@/components/ui/DraftBanner';
import { readDraft, writeDraft, deleteDraft } from '@/lib/draftStorage';

/**
 * Chave do rascunho de importação de NFe.
 * Convenção: `nfe:import` (única — só pode haver uma importação em curso).
 */
const NFE_DRAFT_KEY = 'nfe:import';
const NFE_DRAFT_LABEL = 'Importação de NF-e';

/**
 * Snapshot persistido para "Continuar mais tarde".
 * Mantém apenas o essencial — o que o usuário não consegue refazer
 * sem reler o XML do zero.
 */
interface NFeImportDraft {
  step: 1 | 2 | 3;
  nfeData: any;
  selectedIndexes: number[];
}

export default function EntradaNota() {
  const navigate = useNavigate();

  const {
    step,
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
    updateNewItemField,
    setItemCategory,
    setItemDimensionUnit,
    copyNewItemDefaultsToSelected,
    handleSetDistributionMode,
    setExtraCost,
    importNFe,
    isCheckingSupplier,
    showSupplierRegistration,
    proceedToMapping,
    handleSupplierRegistered,
    handleSupplierRegistrationCancel,
    resetImport,
    restoreImport,
  } = useNFeImport();

  // "Está importando" = passou da seleção do XML e tem dados em memória.
  const isImporting = step > 1 && !!nfeData;

  // ── Detecção de rascunho persistido na primeira montagem ──────────────────
  const [draftCandidate, setDraftCandidate] = useState<NFeImportDraft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hasDraftBanner, setHasDraftBanner] = useState(false);

  useEffect(() => {
    const env = readDraft<NFeImportDraft>(NFE_DRAFT_KEY);
    if (env && env.values?.nfeData) {
      setDraftCandidate(env.values);
      setDraftSavedAt(env.savedAt);
      setHasDraftBanner(true);
    }
    // Roda só na montagem — não queremos reagir ao próprio save mais adiante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreFromDraft = () => {
    if (!draftCandidate) return;
    restoreImport(draftCandidate);
    setHasDraftBanner(false);
    // O draft fica em storage até ser explicitamente descartado ou expirar —
    // útil caso o usuário restaure, edite e queira voltar novamente.
  };

  const discardDraftFromBanner = () => {
    deleteDraft(NFE_DRAFT_KEY);
    setDraftCandidate(null);
    setDraftSavedAt(null);
    setHasDraftBanner(false);
  };

  // ── Guard de saída ───────────────────────────────────────────────────────
  // Banner aberto não conta como "importando" — usuário pode descartar.
  // A guarda só ativa após o usuário começar a trabalhar de fato.
  const guardActive = isImporting && !hasDraftBanner;
  const [pendingIntent, setPendingIntent] = useState<ExitIntent | null>(null);

  const { bypass } = useExitGuard({
    active: guardActive,
    onAttempt: (intent) => setPendingIntent(intent),
  });

  /** Executa a navegação retida (link ou back) sem ser re-interceptado. */
  const performPendingNav = () => {
    if (!pendingIntent) return;
    const intent = pendingIntent;
    setPendingIntent(null);
    bypass(() => {
      if (intent.type === 'link') {
        navigate(intent.path);
      } else if (intent.type === 'back') {
        // -2 porque o guard empurrou um estado fantasma a mais.
        window.history.go(-2);
      }
    });
  };

  // ── Ações do DraftCancelDialog ───────────────────────────────────────────
  const handleDiscard = () => {
    deleteDraft(NFE_DRAFT_KEY);
    resetImport();
    performPendingNav();
  };

  const handleKeepForLater = () => {
    const snapshot: NFeImportDraft = {
      step,
      nfeData,
      selectedIndexes,
    };
    writeDraft(NFE_DRAFT_KEY, snapshot, { label: NFE_DRAFT_LABEL });
    // Limpa o estado em memória para a tela ficar coerente caso o usuário
    // volte para `/entrada-nfe` antes de mudar de rota (raríssimo, mas seguro).
    resetImport();
    performPendingNav();
  };

  const handleResume = () => {
    // "Voltar ao preenchimento": cancela a tentativa de saída e fica.
    setPendingIntent(null);
  };

  /**
   * Wrapper de `importNFe`: limpa o rascunho local após a tentativa de
   * gravação. Se o `importNFe` falhar, o rascunho fica preservado para o
   * usuário não perder o trabalho.
   */
  const handleImportNFe = async (...args: Parameters<typeof importNFe>) => {
    const result = await (importNFe as any)(...args);
    // Sucesso: backend aceitou. Apaga o rascunho local.
    deleteDraft(NFE_DRAFT_KEY);
    return result;
  };

  // Memoiza o cabeçalho do estado da NFe para evitar recriações.
  const headerSummary = useMemo(() => {
    if (step <= 1 || !nfeData) return null;
    return (
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase text-slate-400">NF-e Nº</span>
          <span className="text-sm font-bold text-slate-700">{nfeData.numero}</span>
        </div>
        <div className="w-px h-8 bg-slate-100 mx-2" />
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-slate-400">Fornecedor</span>
          <span className="text-sm font-bold text-slate-700">
            {nfeData.emitente.nomeFantasia || nfeData.emitente.razaoSocial}
          </span>
        </div>
      </div>
    );
  }, [step, nfeData]);

  return (
    <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto px-4 pb-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
        <div>
          <h1 className="text-display">Entrada de Notas</h1>
          <p className="text-muted-foreground">Processamento inteligente de XML e automação de estoque.</p>
        </div>
        {headerSummary}
      </div>

      {/* Banner de recuperação: aparece quando há rascunho salvo e o usuário
          ainda não decidiu se quer continuar ou começar do zero. */}
      <DraftBanner
        visible={hasDraftBanner}
        savedAt={draftSavedAt}
        label={NFE_DRAFT_LABEL}
        onRestore={restoreFromDraft}
        onDiscard={discardDraftFromBanner}
      />

      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <NFeKeyInput
            onSearch={fetchNFeByChave}
            isLoading={isLoading}
            clearOnError={hasKeyError}
            onErrorCleared={clearKeyError}
          />

          <div className="relative flex items-center justify-center py-2">
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
        <>
          <NFeSupplierSummary
            nfeData={nfeData}
            onContinue={proceedToMapping}
            isLoading={isCheckingSupplier}
          />
          {showSupplierRegistration && (
            <NFeSupplierRegistrationModal
              nfeData={nfeData}
              onCancel={handleSupplierRegistrationCancel}
              onCreated={handleSupplierRegistered}
            />
          )}
        </>
      )}

      {step === 3 && nfeData && (
        <NFeItemMapper
          nfeData={nfeData}
          isLoading={isLoading}
          selectedIndexes={selectedIndexes}
          availableMaterials={availableMaterials}
          onImport={handleImportNFe}
          onToggleNew={handleCreateNewToggle}
          onBindExisting={handleBindExisting}
          onToggleSkip={handleToggleSkip}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateNewItemField={updateNewItemField}
          onSetItemCategory={setItemCategory}
          onSetItemDimensionUnit={setItemDimensionUnit}
          onCopyNewItemDefaultsToSelected={copyNewItemDefaultsToSelected}
          onBulkUpdate={bulkUpdate}
          onSetDistributionMode={handleSetDistributionMode}
          onSetExtraCost={setExtraCost}
          categories={categories}
        />
      )}

      {/* Dialog de saída: aparece quando o guard interceptou uma tentativa
          de sair durante uma importação em andamento. */}
      <DraftCancelDialog
        open={!!pendingIntent}
        label={NFE_DRAFT_LABEL}
        onDiscard={handleDiscard}
        onKeepForLater={handleKeepForLater}
        onResume={handleResume}
      />
    </div>
  );
}
