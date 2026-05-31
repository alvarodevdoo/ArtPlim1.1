import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface UseBackupProps {
  selectedModules: Record<string, boolean>;
  loadSettings: () => Promise<void>;
  userRole?: string;
  customBackup?: boolean;
}

// Módulos incluídos no "backup completo" padrão (auditoria fica opt-in mesmo aqui).
const FULL_BACKUP_MODULES = [
  'config',
  'profiles',
  'materials',
  'products',
  'production',
  'sales',
  'finance'
];

export function useBackup({ selectedModules, loadSettings, userRole, customBackup = false }: UseBackupProps) {
  const [loading, setLoading] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [unencryptedExport, setUnencryptedExport] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  // Mirror: limpa os dados dos módulos do backup na org antes de inserir (default ON).
  const [mirrorRestore, setMirrorRestore] = useState(true);
  // Detecta se o arquivo escolhido está criptografado (para mostrar/ocultar o campo de senha).
  const [pendingFileEncrypted, setPendingFileEncrypted] = useState(true);
  // Restauração parcial: quando ativa, importa apenas os módulos marcados.
  const [partialRestore, setPartialRestore] = useState(false);
  const [restoreModules, setRestoreModules] = useState<Record<string, boolean>>({
    config: true, profiles: true, materials: true, products: true,
    production: true, sales: true, finance: true, audit: true,
  });
  const [showImportPasswordModal, setShowImportPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [importProgress, setImportProgress] = useState(0);

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const activeModules = customBackup
        ? Object.entries(selectedModules)
            .filter(([_, active]) => active)
            .map(([module]) => module)
        : // Modo "completo": todos os módulos operacionais + audit se o usuário marcou.
          selectedModules.audit
            ? [...FULL_BACKUP_MODULES, 'audit']
            : FULL_BACKUP_MODULES;

      if (activeModules.length === 0) {
        toast.error('Selecione pelo menos um módulo para exportar');
        return;
      }

      const response = await api.get('/api/backup/export', {
        params: { 
          modules: activeModules.join(','),
          password: backupPassword || undefined,
          unencrypted: unencryptedExport ? 'true' : 'false'
        },
        responseType: 'blob' 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extrai o nome do arquivo definido pelo backend (fonte única).
      // Fallback usa um timestamp local caso o header não esteja exposto.
      const disposition = response.headers?.['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename\s*=\s*"?([^";]+)"?/i);
      const filename = match?.[1] ?? `backup-${Date.now()}.bdb`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Pacote de backup modular (.bdb) gerado com sucesso!');
      setBackupPassword('');
    } catch (error: any) {
      console.error('Erro ao exportar backup:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao gerar pacote de backup modular');
    } finally {
      setLoading(false);
    }
  };

  const executeRestore = async (file: File, passwordAttempt: string) => {
    setLoading(true);
    setImportStatus('uploading');
    setImportProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', passwordAttempt);
      formData.append('mirror', mirrorRestore ? 'true' : 'false');
      if (partialRestore) {
        const selected = Object.entries(restoreModules)
          .filter(([, on]) => on)
          .map(([mod]) => mod);
        formData.append('modules', selected.join(','));
      }

      const response = await api.post('/api/backup/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setImportProgress(percentCompleted);
            if (percentCompleted >= 100) {
              setImportStatus('processing');
            }
          }
        }
      });

      const results = response.data?.data || [];
      const totalErrors = results.reduce((acc: number, cur: any) => acc + (cur.errorCount || 0), 0);
      const totalSuccess = results.reduce((acc: number, cur: any) => acc + (cur.successCount || 0), 0);

      if (totalErrors > 0) {
        console.error('Erros de importação retornados pelo backend:', results);
        const firstError = results.find((r: any) => r.errors?.length > 0)?.errors?.[0] || 'Erros ocorreram na importação';
        if (totalSuccess === 0) {
          toast.error(`Falha total: Nenhum registro importado. Erro: ${firstError}`);
        } else {
          toast.warning(`Importação parcial: ${totalSuccess} com sucesso, ${totalErrors} com erro. Ex: ${firstError}`);
        }
      } else {
        toast.success(`Restauração concluída com sucesso! ${totalSuccess} registros importados.`);
      }

      await loadSettings();
      setShowImportPasswordModal(false);
      setPendingFile(null);
      setImportPassword('');

      // Uma restauração pode alterar dados de todas as telas; os caches/estado em
      // memória do app ficariam desatualizados (exigindo F5 manual). Como é uma
      // operação rara e pesada, recarregamos a página para refletir tudo de uma vez.
      // Pequeno atraso para o usuário conseguir ler o toast antes do reload.
      if (totalSuccess > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error: any) {
      console.error('Erro ao importar backup:', error);
      toast.error(error.response?.data?.error?.message || 'Senha incorreta ou arquivo corrompido');
    } finally {
      setLoading(false);
      setImportStatus('idle');
      setImportProgress(0);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Detecta backup sem criptografia: ZIP cru começa com os magic bytes 50 4B 03 04.
    let encrypted = true;
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      encrypted = !(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04);
    } catch {
      encrypted = true;
    }
    setPendingFileEncrypted(encrypted);
    if (!encrypted) setImportPassword('');
    setPendingFile(file);
    setShowImportPasswordModal(true);
  };

  return {
    loading,
    backupPassword,
    setBackupPassword,
    unencryptedExport,
    setUnencryptedExport,
    importPassword,
    setImportPassword,
    mirrorRestore,
    setMirrorRestore,
    pendingFileEncrypted,
    partialRestore,
    setPartialRestore,
    restoreModules,
    setRestoreModules,
    showImportPasswordModal,
    setShowImportPasswordModal,
    pendingFile,
    handleExportBackup,
    executeRestore,
    handleImportBackup,
    importStatus,
    importProgress
  };
}
