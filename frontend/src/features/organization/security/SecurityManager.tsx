import React from 'react';
import { Shield, Lock, AlertTriangle, Eye, EyeOff, CheckCircle2, XCircle, FileDown, QrCode, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SecurityManagerProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

export const SecurityManager: React.FC<SecurityManagerProps> = ({
  settings,
  setSettings,
  handleSaveSettings,
  loading
}) => {
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword;
  const isPasswordValid = newPassword.length >= 8;
  const canSave = passwordsMatch && isPasswordValid && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveSettings(e);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDownloadCertificate = async () => {
    if (!settings.recoveryToken) return;
    setDownloading(true);
    
    try {
      const doc = new jsPDF();
      const qrCodeDataUrl = await QRCode.toDataURL(settings.recoveryToken, { margin: 1 });
      
      // Header
      doc.setFillColor(31, 41, 55);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('CERTIFICADO DIGITAL MASTER - ARTPLIM', 105, 25, { align: 'center' });
      
      // Body
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      doc.text(`Organização: ${settings.organizationName || 'N/A'}`, 20, 60);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 70);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 80, 190, 80);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('CHAVE DE RECUPERAÇÃO MASTER', 105, 100, { align: 'center' });
      
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246);
      doc.text(settings.recoveryToken, 105, 115, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Guarde este documento impresso em um cofre. Esta chave permite abrir qualquer backup comercial.', 105, 125, { align: 'center' });
      
      // QR Code
      doc.addImage(qrCodeDataUrl, 'PNG', 75, 140, 60, 60);
      
      doc.save(`Certificado_Master_${settings.recoveryToken}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Segurança da Organização
        </CardTitle>
        <CardDescription>Gerencie chaves mestras e políticas de proteção de dados sensíveis.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-8">
        
        {/* Senha Mestre de Backup */}
        <form onSubmit={onSubmit} className="space-y-8 max-w-4xl">
           <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 transition-all hover:bg-primary/[0.07]">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Senha Mestre de Recuperação</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Chave definitiva para backups. Sem ela, os dados exportados tornam-se ilegíveis se a senha individual for perdida.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Nova Senha Mestre
                </label>
                <div className="relative group">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Defina uma senha robusta..."
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setSettings((prev: any) => ({ ...prev, defaultBackupPassword: e.target.value }));
                    }}
                    className="pr-12 h-12 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 p-1 hover:bg-accent rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Confirmar Senha Mestre</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a senha..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    "h-12 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-xl",
                    confirmPassword && !passwordsMatch && "border-red-500"
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={!canSave} className="px-8 h-12 rounded-xl font-bold shadow-lg shadow-primary/20">
              {loading ? 'Salvando...' : 'Atualizar Chave Mestre'}
            </Button>

            {settings.recoveryToken && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCertificate}
                disabled={downloading}
                className="h-12 px-6 rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold gap-2"
              >
                <FileDown className="w-5 h-5" /> Cerificado Master
              </Button>
            )}
          </div>
        </form>

        {/* --- SEÇÃO DE CERTIFICADO DIGITAL A1 (NF-e) --- */}
        <div className="space-y-6 pt-10 border-t border-slate-100 max-w-4xl">
          <div className="flex items-start space-x-4">
              <div className="p-3 bg-indigo-50 rounded-xl shadow-sm border border-indigo-100">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-base text-foreground">Certificado Digital A1 (NF-e)</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Utilizado para download automático de notas fiscais diretamente da SEFAZ.
                </p>
              </div>
          </div>

          {/* Destaque do Certificado Ativo */}
          {settings.nfeCertificateExpiry && (
            <div className="p-6 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Shield className="w-32 h-32" />
              </div>
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-wider">
                      Certificado Ativo
                    </span>
                    {new Date(settings.nfeCertificateExpiry) < new Date() ? (
                      <span className="px-2.5 py-1 bg-rose-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        Expirado
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        Válido
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-white/90">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-widest opacity-80">Expiração:</span>
                    <span className="text-sm font-bold tracking-tight">
                      {format(new Date(settings.nfeCertificateExpiry), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                   <span className="text-[9px] font-bold uppercase opacity-60 tracking-widest block mb-1">Titular do Certificado</span>
                   <h3 className="text-xl font-black tracking-tight truncate max-w-2xl">
                    {settings.nfeCertificateSubject || 'Proprietário não identificado'}
                  </h3>
                </div>
                
                <div className="flex items-center gap-6 mt-4 text-[10px] font-bold opacity-80 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-1"><Lock className="w-3 h-3" /> Senha Armazenada</div>
                  <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Transmissão Segura</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4">
            <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">
              {settings.nfeCertificateExpiry ? 'Trocar Certificado' : 'Configurar Certificado'}
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Arquivo (.pfx ou .p12)</label>
                <div className="flex flex-col gap-2">
                  <div className={cn(
                    "h-12 border-2 border-dashed rounded-xl flex items-center justify-center transition-all",
                    settings.nfeCertificate ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200"
                  )}>
                    {settings.nfeCertificate ? (
                      <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-2 px-4 truncate">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> {settings.nfeCertificateFileName || 'Pronto para validar'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Nenhum arquivo selecionado</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    className="hidden"
                    id="nfe-cert-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = (event.target?.result as string).split(',')[1];
                          setSettings((p: any) => ({ 
                            ...p, 
                            nfeCertificate: base64, 
                            nfeCertificateFileName: file.name,
                            nfeCertificatePassword: ''
                          }));
                          toast.success('Arquivo configurado. Digite a senha para validar.');
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold" onClick={() => document.getElementById('nfe-cert-input')?.click()}>
                    {settings.nfeCertificate ? 'Alterar Arquivo' : 'Selecionar Arquivo'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Senha do Certificado</label>
                <div className="relative group">
                  <Input
                    type="password"
                    placeholder="Senha do arquivo..."
                    className="pl-10 h-11 border-slate-200 focus:border-indigo-500 rounded-xl"
                    value={settings.nfeCertificatePassword || ''}
                    onChange={(e) => setSettings((p: any) => ({ ...p, nfeCertificatePassword: e.target.value }))}
                  />
                  <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                
                {!settings.nfeCertificateExpiry && settings.nfeCertificate && (
                  <div className="mt-2 text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> Salve para validar o arquivo.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSaveSettings}
                disabled={loading || !settings.nfeCertificate || !settings.nfeCertificatePassword}
                className="px-10 h-11 rounded-xl font-bold shadow-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Salvar e Validar Certificado'}
              </Button>
            </div>
          </div>
        </div>

        {/* Status de Proteção */}
        {settings.recoveryToken && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Proteção Ativa</p>
                <p className="text-xs text-emerald-700">Chave mestre configurada corretamente.</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-emerald-200/50 rounded-full text-[10px] font-black text-emerald-800">
              SISTEMA SEGURO
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};
