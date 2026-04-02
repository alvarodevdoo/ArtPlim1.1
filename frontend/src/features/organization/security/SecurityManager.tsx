import React from 'react';
import { Shield, Lock, AlertTriangle, Eye, EyeOff, CheckCircle2, XCircle, FileDown, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

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
      doc.setFillColor(31, 41, 55); // Dark blue
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
      doc.setTextColor(59, 130, 246); // Primary blue
      doc.text(settings.recoveryToken, 105, 115, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Guarde este documento impresso em um cofre. Esta chave permite abrir qualquer backup comercial.', 105, 125, { align: 'center' });
      
      // QR Code
      doc.addImage(qrCodeDataUrl, 'PNG', 75, 140, 60, 60);
      
      // Footer
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text('Gerado pelo sistema ArtPlim ERP v1.1 - Segurança Avançada AntiGravity', 105, 280, { align: 'center' });
      
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
        <form onSubmit={onSubmit} className="space-y-8 max-w-2xl">
           <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 transition-all hover:bg-primary/[0.07]">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground">Senha Mestre de Recuperação</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Esta senha é a <strong>chave definitiva</strong> para todos os backups da organização. 
                  Sem ela, os dados exportados podem se tornar ilegíveis caso a senha individual seja perdida.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Campo 1: Nova Senha */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Nova Senha Mestre (Owner)</span>
                {newPassword && (
                  <span className={cn("text-[10px] uppercase tracking-wider font-black", isPasswordValid ? "text-emerald-600" : "text-amber-500")}>
                    {isPasswordValid ? "Comprimento OK" : "Mínimo 8 caracteres"}
                  </span>
                )}
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
                  className="pr-12 h-12 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-xl bg-card"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground group-focus-within:text-primary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Campo 2: Confirmação */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Confirmar Senha Mestre</span>
                {confirmPassword && (
                  <span className={cn("flex items-center gap-1 text-[10px] font-bold", passwordsMatch ? "text-emerald-600" : "text-red-500")}>
                    {passwordsMatch ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {passwordsMatch ? "Senhas coincidem" : "Senhas diferentes"}
                  </span>
                )}
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha digitada acima..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  "h-12 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-xl bg-card",
                  confirmPassword && !passwordsMatch && "border-red-500 focus:border-red-500 focus:ring-red-500"
                )}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={!canSave} 
              className={cn(
                "px-8 h-12 rounded-xl font-bold shadow-lg transition-all flex-1 md:flex-none",
                canSave ? "bg-primary hover:scale-[1.02]" : "opacity-50"
              )}
            >
              {loading ? 'Salvando Chave Mestre...' : 'Salvar Chave Mestre'}
            </Button>

            {settings.recoveryToken && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCertificate}
                disabled={downloading}
                className="h-12 px-6 rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold gap-2"
              >
                {downloading ? (
                  'Gerando...'
                ) : (
                  <>
                    <FileDown className="w-5 h-5" />
                    Certificado Digital Master
                  </>
                )}
              </Button>
            )}
          </div>
        </form>

        {settings.recoveryToken && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-emerald-100 text-emerald-600">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">Certificado Ativo</p>
                <p className="text-xs text-emerald-700">O seu Recovery Token já está disponível para download.</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-emerald-200/50 rounded-full text-[10px] font-black text-emerald-800 tracking-tighter">
              SISTEMA PROTEGIDO
            </div>
          </div>
        )}


        <div className="mt-8 p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-amber-800 block">Aviso de Segurança</span>
            <span className="text-[10px] text-amber-700">
              Operadores autorizados podem exportar backups com senhas próprias, mas você SEMPRE poderá abri-los usando esta Senha Mestre.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
