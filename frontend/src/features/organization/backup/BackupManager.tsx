import React, { useRef } from 'react';
import { 
  Shield, 
  Lock, 
  Unlock, 
  Download, 
  Upload, 
  Database, 
  AlertTriangle 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useBackup } from './useBackup';

interface BackupManagerProps {
  selectedModules: Record<string, boolean>;
  setSelectedModules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  loadSettings: () => Promise<void>;
  userRole?: string;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ 
  selectedModules, 
  setSelectedModules, 
  loadSettings,
  userRole 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
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
  } = useBackup({ selectedModules, loadSettings, userRole });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const onImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleImportBackup(e);
  };

  const handleConfirmRestore = async () => {
    if (pendingFile) {
      await executeRestore(pendingFile, importPassword);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Backup e Restauração</CardTitle>
          <CardDescription>Gerencie backups dos seus dados com segurança</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 text-sm">Segurança de Dados</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Seus backups são protegidos por criptografia AES-256. Você pode definir uma senha temporária abaixo para este arquivo específico ou usar a senha mestre da organização.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Senha do Arquivo (Opcional)
                  </label>
                  <div className="relative">
                    <Input 
                      type="password"
                      placeholder="Defina uma senha para este backup..."
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                      className="pr-10 h-9 text-sm"
                    />
                    <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Se não definida, apenas a senha mestre poderá abrir este arquivo.
                  </p>
                </div>

                {userRole === 'OWNER' && (
                  <div className="flex items-center space-x-2 h-full pt-6">
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-red-50 transition-colors border-red-100 flex-1">
                      <input 
                        type="checkbox" 
                        checked={unencryptedExport}
                        onChange={(e) => setUnencryptedExport(e.target.checked)}
                        className="rounded border-input text-red-500"
                      />
                      <div>
                          <span className="text-xs font-bold text-red-700 block">Exportação Desprotegida</span>
                          <span className="text-[10px] text-red-500">Remover criptografia (Apenas Proprietário)</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {Object.entries(selectedModules).map(([module, active]) => (
                  <label key={module} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${active ? 'bg-primary/5 border-primary' : 'bg-white border-border'}`}>
                    <input 
                      type="checkbox" 
                      checked={active}
                      onChange={() => setSelectedModules(prev => ({ ...prev, [module]: !active }))}
                      className="rounded border-input text-primary"
                    />
                    <span className="text-xs font-medium capitalize">
                      {module === 'config' ? 'Configurações' : 
                       module === 'profiles' ? 'Clientes/Usuários' :
                       module === 'materials' ? 'Insumos/Estoque' :
                       module === 'products' ? 'Produtos/Catálogo' :
                       module === 'production' ? 'Produção' :
                       module === 'sales' ? 'Vendas' :
                       module === 'finance' ? 'Financeiro' : module}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex space-x-2">
                 <Button 
                  onClick={handleExportBackup} 
                  disabled={loading} 
                  className={`flex-1 md:flex-none ${unencryptedExport ? 'bg-red-600 hover:bg-red-700 shadow-lg' : ''}`}
                >
                  {unencryptedExport ? <Unlock className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  {loading ? 'Processando...' : unencryptedExport ? 'Baixar Backup Aberto' : 'Gerar Pacote (.bdb)'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onImportChange}
                  className="hidden"
                  accept=".bdb"
                />
                <Button 
                  variant="outline" 
                  onClick={handleImportClick}
                  disabled={loading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Restaurar (.bdb)
                </Button>
              </div>
            </div>
            
            {/* Modal de Senha para Importação */}
            {showImportPasswordModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-sm shadow-2xl border-primary/20 animate-in fade-in zoom-in duration-200">
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                       <Shield className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg">Desbloquear Backup</CardTitle>
                    <CardDescription className="text-xs">
                      Este arquivo `.bdb` está protegido. Informe a senha definida na exportação ou a senha mestre.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Input 
                        type="password"
                        placeholder="Digite a senha de desbloqueio..."
                        autoFocus
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmRestore()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => { setShowImportPasswordModal(false); }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleConfirmRestore}
                        disabled={loading || !importPassword}
                        className="flex-1"
                      >
                        {loading ? 'Abrindo...' : 'Confirmar'}
                      </Button>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      A restauração substituirá dados existentes com o mesmo ID.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="text-center py-8 text-muted-foreground border-t border-dashed mt-4">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-semibold">Backup Modular Corporativo Ativado</p>
              <p className="text-[11px] max-w-[250px] mx-auto opacity-70">Os dados são protegidos por criptografia de envelope AES-256 e isolamento multitenant.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
