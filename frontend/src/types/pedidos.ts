import { Edit, Package, CheckCircle, XCircle } from 'lucide-react';

export interface ProcessStatus {
  id: string;
  name: string;
  color: string;
  icon?: string;
  mappedBehavior: string;
  scope?: 'ORDER' | 'ITEM' | 'BOTH';
  allowEdition: boolean;
  hideFromFlow?: boolean;
  displayOrder?: number;
  active?: boolean;
  parentId?: string;
  children?: ProcessStatus[];
}


export interface Pedido {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  processStatusId?: string;
  processStatus?: ProcessStatus;
  total: number;
  createdAt: string;
  validUntil?: string;
  deliveryDate?: string;
  notes?: string;
  updatedAt: string;
  customer: { id: string; name: string; email?: string; phone?: string };
  productionQueue?: Array<{ actualStart?: string; actualEnd?: string; createdAt?: string }>;
  approvedAt?: string;
  inProductionAt?: string;
  finishedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelledById?: string;
  cancellationReason?: string;
  cancellationPaymentAction?: string;
  cancellationRefundAmount?: number;
  items: Array<any>;
  transactions?: Array<any>;
  statusHistory?: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    fromProcessStatusId?: string;
    toProcessStatusId?: string;
    fromProcessStatus?: ProcessStatus;
    toProcessStatus?: ProcessStatus;
    userId: string;
    user?: { name: string };
    notes?: string;
    createdAt: string;
  }>;
}

export interface PedidoStats {
  total: number;
  totalValue: number;
  byStatus: Record<string, { count: number; value: number }>;
  avgOrderValue: number;
  monthlyGrowth: number;
  pendingValue: number;
  overdueCount: number;
}

export const statusConfig = {
  DRAFT: { label: 'Pedido Recebido', color: 'bg-gray-100 text-gray-800', hex: '#94a3b8', icon: Edit, border: 'border-l-gray-400' },
  APPROVED: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', hex: '#3b82f6', icon: CheckCircle, border: 'border-l-blue-500' },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-green-50 text-green-700', hex: '#22c55e', icon: Package, border: 'border-l-green-500' },
  FINISHED: { label: 'Finalizado', color: 'bg-green-100 text-green-800', hex: '#10b981', icon: CheckCircle, border: 'border-l-green-500' },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800', hex: '#059669', icon: CheckCircle, border: 'border-l-green-600' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', hex: '#ef4444', icon: XCircle, border: 'border-l-red-500' },
};

export const shouldShowDimensions = (item: any, enableEngineering?: boolean): boolean => {
  const width = Number(item?.width || 0);
  const height = Number(item?.height || 0);
  if (width <= 0 || height <= 0) return false;
  if (item?.itemType === 'SERVICE' || item?.product?.productType === 'SERVICE') return false;
  if (item?.product?.pricingMode === 'DYNAMIC_ENGINEER' && enableEngineering === false) return false;
  return true;
};
