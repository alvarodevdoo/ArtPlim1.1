import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { ArrowRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CustomerBalanceAlertProps {
  profile?: {
    balance: number | string;
    balanceMovements?: Array<{
      type: string;
      description: string;
      order?: {
        orderNumber: string;
      }
    }>;
  } | null;
  onUseBalance?: (amount: number) => void;
  loading?: boolean;
}

export const CustomerBalanceAlert: React.FC<CustomerBalanceAlertProps> = ({
  profile,
  onUseBalance,
  loading
}) => {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 animate-pulse">
        <div className="h-4 w-24 bg-blue-200 rounded mb-2"></div>
        <div className="h-8 w-32 bg-blue-200 rounded"></div>
      </div>
    );
  }

  const balance = Number(profile?.balance || 0);
  const lastMovement = profile?.balanceMovements?.[0];

  if (balance <= 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-blue-700 font-bold uppercase text-[10px] tracking-wider">
            <Wallet className="w-3 h-3" />
            <span>Saldo do Cliente</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold text-blue-900">
              {formatCurrency(balance)}
            </span>
            
            {lastMovement?.order && (
              <div className="flex items-center space-x-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[11px] font-medium border border-blue-200">
                <span>Origem: {lastMovement.order.orderNumber}</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            )}
          </div>
          
          {lastMovement?.description && (
            <p className="text-[11px] text-blue-600/80 italic line-clamp-1">
              "{lastMovement.description}"
            </p>
          )}
        </div>

        {onUseBalance && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onUseBalance(balance)}
            className="text-blue-700 hover:bg-blue-100 hover:text-blue-800 flex items-center space-x-1 font-semibold"
          >
            <span>Usar Saldo</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
