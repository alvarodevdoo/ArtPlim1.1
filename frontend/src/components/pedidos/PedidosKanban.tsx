import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Eye, Calendar } from 'lucide-react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  DragEndEvent, useDroppable, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { statusConfig } from '@/types/pedidos';

// ─── SortableItemCard ────────────────────────────────────────────────────────
interface SortableItemCardProps {
  item: any;
  onView: (id: string) => void;
  onItemStatusChange: (itemId: string, newStatus: string, showToast?: boolean) => void;
}

const SortableItemCard = React.memo(({ item, onView, onItemStatusChange }: SortableItemCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'Item', item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : ('auto' as any),
    touchAction: 'none' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className={`cursor-grab active:cursor-grabbing border-slate-200 ${isDragging ? 'shadow-lg ring-1 ring-primary' : 'hover:border-slate-300'}`}>
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-sm flex flex-col">
                <span className="text-primary">{item?.orderNumber || 'N/A'}</span>
                <span className="mt-1 text-base">{item?.product?.name || 'Produto sem nome'}</span>
              </h4>
              <Badge variant="outline" className="text-[10px]">{item?.quantity || 0}un</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium">{item?.customerName || 'Cliente não informado'}</p>
            {item?.status && statusConfig[item.status as keyof typeof statusConfig] && (
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="outline" className={`text-[10px] font-bold ${statusConfig[item.status as keyof typeof statusConfig].color}`}>
                  {statusConfig[item.status as keyof typeof statusConfig].label}
                </Badge>
              </div>
            )}
            {item?.status === 'FINISHED' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 text-green-600 border-green-200 hover:bg-green-50 text-[10px] h-6"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onItemStatusChange(item.id, 'DELIVERED', true); }}
              >
                ✓ Marcar como Entregue
              </Button>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-dashed mt-2">
              <span className="text-[10px] text-muted-foreground flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {item?.orderCreatedAt ? new Date(item.orderCreatedAt).toLocaleDateString('pt-BR') : '-'}
              </span>
              <div className="flex items-center space-x-1">
                <Button
                  size="icon" variant="ghost" className="h-6 w-6"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); if (item?.parentOrderId) onView(item.parentOrderId); }}
                >
                  <Eye className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
SortableItemCard.displayName = 'SortableItemCard';

// ─── KanbanColumnPedido ──────────────────────────────────────────────────────
interface KanbanColumnPedidoProps {
  status: string;
  config: typeof statusConfig[keyof typeof statusConfig];
  items: any[];
  onView: (id: string) => void;
  onItemStatusChange: (itemId: string, newStatus: string, showToast?: boolean) => void;
}

const KanbanColumnPedido = React.memo(({ status, config, items, onView, onItemStatusChange }: KanbanColumnPedidoProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const itemIds = useMemo(() => (items || []).map((i: any) => i.id), [items]);

  return (
    <Card
      ref={setNodeRef}
      className={`w-[325px] flex flex-col h-full border-2 select-none ${isOver ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50'}`}
    >
      <CardHeader className="p-4 sticky top-0 bg-slate-50 z-20 rounded-t-lg border-b shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${config.color?.replace('text-', 'bg-').replace('800', '100') || 'bg-slate-100'}`}>
              <config.icon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">{config.label}</span>
          </div>
          <Badge variant="secondary" className="font-bold h-6 px-2.5 bg-slate-200 text-slate-700 border-none rounded-lg">
            {items?.length || 0}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        <SortableContext id={status} items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col space-y-3 flex-1 h-full min-h-[50px] pb-6">
            {(items || []).map((item: any) => (
              <SortableItemCard
                key={item.id}
                item={item}
                onView={onView}
                onItemStatusChange={onItemStatusChange}
              />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
});
KanbanColumnPedido.displayName = 'KanbanColumnPedido';

// ─── PedidosKanban ───────────────────────────────────────────────────────────
interface PedidosKanbanProps {
  kanbanItems: any[];
  itemsByStatus: Record<string, any[]>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleViewOrder: (id: string) => void;
  handleItemOrderStatusChange: (itemId: string, newStatus: string, showToast?: boolean) => void;
}

const PedidosKanban: React.FC<PedidosKanbanProps> = React.memo(({
  kanbanItems, itemsByStatus, activeId, setActiveId, handleDragEnd, handleViewOrder, handleItemOrderStatusChange,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const kanbanColumns = useMemo(() =>
    Object.entries(statusConfig)
      .filter(([status]) => status !== 'DELIVERED' && status !== 'CANCELLED')
      .map(([status, config]) => (
        <KanbanColumnPedido
          key={status}
          status={status}
          config={config}
          items={itemsByStatus[status] || []}
          onView={handleViewOrder}
          onItemStatusChange={handleItemOrderStatusChange}
        />
      )),
    [itemsByStatus, handleViewOrder, handleItemOrderStatusChange]
  );

  const activeItem = useMemo(() =>
    activeId ? kanbanItems.find(i => i.id === activeId) : null,
    [activeId, kanbanItems]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-200px)] gap-6 pb-6 overflow-x-auto min-w-full px-4">
        {kanbanColumns}
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeItem ? (
          <div className="cursor-grabbing w-[280px]">
            <Card className="shadow-lg border-primary/50 opacity-90">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm">#{activeItem?.orderNumber || ''}</span>
                  <Badge variant="outline" className="text-[10px]">{activeItem?.quantity || 0}un</Badge>
                </div>
                <p className="text-sm font-medium truncate mb-1">{activeItem?.product?.name || ''}</p>
                <p className="text-xs text-muted-foreground truncate">{activeItem?.customerName || ''}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

PedidosKanban.displayName = 'PedidosKanban';
export default PedidosKanban;
