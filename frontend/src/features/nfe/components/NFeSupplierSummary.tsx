import React from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NFeData } from '../types';

interface NFeSupplierSummaryProps {
  nfeData: NFeData;
  onContinue: () => void;
}

export const NFeSupplierSummary: React.FC<NFeSupplierSummaryProps> = ({ nfeData, onContinue }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Building2 className="w-5 h-5"/> 
            <span className="font-bold uppercase text-xs tracking-wider">Dados do Fornecedor</span>
          </div>
          <CardTitle className="text-xl">{nfeData.emitente.nomeFantasia}</CardTitle>
          <CardDescription>CNPJ: {nfeData.emitente.cnpj}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Chave de Acesso</p>
              <p className="font-mono text-xs font-medium text-slate-700 bg-slate-100 py-1.5 px-2 rounded w-max inline-block">{nfeData.chaveAcesso}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Data Emissão</p>
              <p className="font-medium text-sm text-slate-700">{new Date(nfeData.dataEmissao).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-emerald-100 bg-emerald-50/50">
        <CardContent className="p-6 flex flex-col justify-center h-full text-emerald-900 text-center">
          <p className="text-xs uppercase font-black text-emerald-700/60 mb-1">Total Produtos: R$ {nfeData.valorTotalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          {(nfeData.valorFrete || 0) > 0 && (
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">
              + Frete: R$ {(nfeData.valorFrete || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
          {(nfeData.valorOutros || 0) > 0 && (
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">
              + Outras Desp.: R$ {(nfeData.valorOutros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}

          <p className="text-sm uppercase font-black tracking-widest text-emerald-700/60 mb-2 mt-2 border-t border-emerald-200/50 pt-2">Valor da Nota</p>
          <p className="text-4xl font-black tabular-nums">
            R$ {nfeData.valorTotalNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <Button className="mt-8 shadow-lg shadow-emerald-500/20" variant="default" onClick={onContinue}>
            Continuar: Mapear Itens <ChevronRight className="ml-2 w-4 h-4"/>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
