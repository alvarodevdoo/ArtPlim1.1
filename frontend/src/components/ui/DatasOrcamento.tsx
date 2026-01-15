import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';

interface DatasOrcamentoProps {
  criadoEm: string | Date;
  validadeEm?: string | Date | null;
  className?: string;
}

export function DatasOrcamento({ criadoEm, validadeEm, className = '' }: DatasOrcamentoProps) {
  const formatarData = (data: string | Date) => {
    return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const isVencido = validadeEm ? new Date(validadeEm) < new Date() : false;

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <div className="flex items-center space-x-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">Abertura:</span>
        <span className="text-muted-foreground">
          {formatarData(criadoEm)}
        </span>
      </div>
      
      {validadeEm && (
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Validade:</span>
          <span className={`${isVencido ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {formatarData(validadeEm)}
            {isVencido && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                Vencido
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}