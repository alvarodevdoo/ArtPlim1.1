import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';

interface DatasOrcamentoProps {
  criadoEm: string | Date;
  validadeEm?: string | Date | null;
  className?: string;
  /** Layout enxuto em linha única, para listagens onde o espaço vertical é escasso. */
  compact?: boolean;
}

export function DatasOrcamento({ criadoEm, validadeEm, className = '', compact = false }: DatasOrcamentoProps) {
  const formatarData = (data: string | Date) => {
    return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatarValidade = (data: string | Date) => {
    const d = new Date(data);
    // Para datas de validade (que vêm como T00:00:00Z do banco), 
    // usamos os métodos UTC para evitar que o fuso horário mude o dia.
    // Ou adicionamos o offset.
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    const ano = d.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const isVencido = validadeEm ? new Date(validadeEm) < new Date() : false;

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground ${className}`}>
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Abertura:</span>
          {formatarData(criadoEm)}
        </span>

        {validadeEm && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Validade:</span>
            <span className={isVencido ? 'text-red-600 font-medium' : ''}>
              {formatarValidade(validadeEm)}
            </span>
            {isVencido && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px]">
                Vencido
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

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
            {formatarValidade(validadeEm)}
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