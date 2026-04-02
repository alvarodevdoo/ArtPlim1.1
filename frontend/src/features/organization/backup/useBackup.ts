import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface UseBackupProps {
  selectedModules: Record<string, boolean>;
  loadSettings: () => Promise<void>;
  userRole?: string;
}

export function useBackup({ selectedModules, loadSettings, userRole }: UseBackupProps) {
  const [loading, setLoading] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [unencryptedExport, setUnencryptedExport] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPasswordModal, setShowImportPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const activeModules = Object.entries(selectedModules)
        .filter(([_, active]) => active)
        .map(([module]) => module);

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
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `backup-artplim-${date}.bdb`);
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
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', passwordAttempt);

      await api.post('/api/backup/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Restauração concluída com sucesso!');
      await loadSettings();
      setShowImportPasswordModal(false);
      setPendingFile(null);
      setImportPassword('');
    } catch (error: any) {
      console.error('Erro ao importar backup:', error);
      toast.error(error.response?.data?.error?.message || 'Senha incorreta ou arquivo corrompido');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
    showImportPasswordModal,
    setShowImportPasswordModal,
    pendingFile,
    handleExportBackup,
    executeRestore,
    handleImportBackup
  };
}
