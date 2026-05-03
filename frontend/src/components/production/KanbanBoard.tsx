import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    useDroppable,
    defaultDropAnimationSideEffects,
    DropAnimation
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/Card';
import TaskAssignmentAction from './TaskAssignmentAction';

// Component for Sortable Item
const SortableItem = ({ item, onClick, onAssignSuccess }: { item: KanbanItem; onClick: () => void; onAssignSuccess: () => void }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: item.id,
        data: {
            type: 'Item',
            item,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card
                className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow mb-2"
                onClick={onClick}
            >
                <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">#{item.order.orderNumber}</span>
                        {item.order.deliveryDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.order.deliveryDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    <p className="text-sm font-medium mb-1 truncate" title={item.product.name}>
                        {item.product.name}
                    </p>

                    <div className="text-xs text-muted-foreground">
                        <p>{item.order.customer.name}</p>
                        <div className="flex gap-2 mt-1 mb-3">
                            <Badge variant="outline" className="text-[10px] h-5">
                                {item.quantity}un
                            </Badge>
                            {item.width && item.height && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                    {Number(item.width)}x{Number(item.height)}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end" onPointerDown={(e) => e.stopPropagation()}>
                        <TaskAssignmentAction
                            orderId={item.order.id!}
                            variant="compact"
                            tasks={{
                                art: item.order.artDesigner || null,
                                prod: item.order.producer || null,
                                finish: item.order.packer || null,
                            }}
                            onAssignSuccess={onAssignSuccess}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const KanbanColumn = ({ status, items, onClick, onAssignSuccess }: { status: ProcessStatus; items: KanbanItem[]; onClick: (item: KanbanItem) => void; onAssignSuccess: () => void }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: status.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 flex flex-col h-full max-h-full rounded-lg transition-colors ${isOver ? 'bg-primary/5' : 'bg-muted/30'}`}
        >
            <div className="flex items-center justify-between p-2 mb-2 rounded-t-lg border-b bg-background/50 sticky top-0" style={{ borderTop: `3px solid ${status.color}` }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="font-semibold text-sm truncate" title={status.name}>{status.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>

            <div className="flex-1 p-2 overflow-y-auto min-h-[100px]">
                <SortableContext
                    id={status.id}
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-2 min-h-full">
                        {items.map(item => (
                            <SortableItem
                                key={item.id}
                                item={item}
                                onClick={() => onClick(item)}
                                onAssignSuccess={onAssignSuccess}
                            />
                        ))}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
};

interface ProcessStatus {
    id: string;
    name: string;
    color: string;
    mappedBehavior: string;
    children?: ProcessStatus[];
}

interface KanbanItem {
    id: string;
    order: {
        id: string;
        orderNumber: string;
        customer: { name: string };
        deliveryDate: string | null;
        status: string;
        artDesignerId?: string;
        productionUserId?: string;
        packagingUserId?: string;
        artDesigner?: { id: string; name: string } | null;
        producer?: { id: string; name: string } | null;
        packer?: { id: string; name: string } | null;
    };
    product: { name: string };
    processStatus: ProcessStatus | null;
    processStatusId: string | null; // Added for direct ID reference
    quantity: number;
    width: number | null;
    height: number | null;
    attributes: any;
}

interface KanbanBoardProps {
    filters: {
        search?: string;
        orderId?: string;
        parentStatusId?: string;
    };
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ filters }) => {
    const [statuses, setStatuses] = useState<ProcessStatus[]>([]);
    const [items, setItems] = useState<KanbanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // For re-fetching data

    useEffect(() => {
        fetchData();
    }, [filters, refreshTrigger]); // Added refreshTrigger

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statusRes, itemsRes] = await Promise.all([
                api.get('/api/process-statuses/tree'),
                api.get('/api/production/kanban/items', { params: filters })
            ]);
            setStatuses(statusRes.data);
            // The backend returns { success: true, data: items }
            setItems(itemsRes.data.data || []);
        } catch (error) {
            console.error('Error fetching kanban data:', error);
            toast.error('Erro ao carregar dados do Kanban');
        } finally {
            setLoading(false);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Require 5px movement to start drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
        // Logic for drag over (optional if using simple lists)
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveId(null);
            return;
        }

        const activeItem = items.find(i => i.id === active.id);
        // Determine target status. 'over.id' might be an item ID or a column ID.
        // We need to map overId to statusId.
        let targetStatusId: string | null = null;

        // Check if over is a status column
        const isOverColumn = columns.some(c => c.id === over.id);
        if (isOverColumn) {
            targetStatusId = over.id as string;
        } else {
            // Over an item -> find that item's status
            const overItem = items.find(i => i.id === over.id);
            if (overItem) {
                targetStatusId = overItem.processStatusId;
            }
        }

        if (activeItem && targetStatusId && activeItem.processStatusId !== targetStatusId) {
            // Optimistic update
            const originalStatusId = activeItem.processStatusId;
            const newItem = { ...activeItem, processStatusId: targetStatusId };

            setItems(prev => prev.map(i => i.id === activeItem.id ? newItem : i));

            try {
                // If target is WAITING, we set processStatusId to null
                const finalStatusId = targetStatusId === 'WAITING' ? null : targetStatusId;
                const response = await api.patch(`/api/production/items/${activeItem.id}/status`, { processStatusId: finalStatusId });

                if (response.data?.success) {
                    const updatedItem = response.data.data;
                    setItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, ...updatedItem } : i));
                }

                toast.success('Status atualizado');
            } catch (error) {
                console.error('Failed to update status:', error);
                toast.error('Erro ao atualizar status');
                // Revert
                setItems(prev => prev.map(i => i.id === activeItem.id ? { ...activeItem, processStatusId: originalStatusId } : i));
            }
        }

        setActiveId(null);
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    const onItemClick = (item: KanbanItem) => {
        // Placeholder for item click action
        console.log('Item clicked:', item);
    };

    // Flatten logic? Or just Top Level + Children as separate columns?
    // Current requirement: "visualização de Kanban por Itens".
    // Let's assume linear workflow for now or render children next to parents.
    // We'll flatten the tree for the columns display: Parent -> [Child1, Child2] -> Next Parent
    // Actually, usually status workflow is either flat or grouped. 
    // Custom statuses might be: 
    // [Pre-Press] -> [Printing] -> [Finishing] -> [Ready]
    // Pre-Press might have [File Check, Plate Making]
    // If we show all leaf nodes, it might be safer.

    const getColumns = () => {
        const cols: ProcessStatus[] = [];
        const traverse = (nodes: ProcessStatus[]) => {
            nodes.forEach(node => {
                // Filter out delivered and cancelled statuses for production kanban
                if (node.mappedBehavior === 'DELIVERED' || node.mappedBehavior === 'CANCELLED') {
                    return;
                }

                // If filtering by parentStatusId
                if (filters.parentStatusId) {
                    // Check if this node IS the selected parent
                    if (node.id === filters.parentStatusId) {
                        // If it has children, show children. If not, show itself.
                        if (node.children && node.children.length > 0) {
                            node.children.forEach(child => cols.push(child));
                        } else {
                            cols.push(node);
                        }
                        return; // Done for this branch
                    }
                    // If not the parent, check children recursion
                    if (node.children) traverse(node.children);
                } else {
                    // No filter: Flatten all? Or just leaf nodes?
                    // Previous logic: push node and traverse children.
                    // This results in Parent AND Child columns if not careful.
                    // Let's decide: If has children, maybe don't show parent as column?
                    // Or Show all for now as per previous implementation.
                    cols.push(node);
                    if (node.children) traverse(node.children);
                }
            });
        };

        traverse(statuses);

        // If filtering and we found nothing (maybe leaf node selected?), handle it?
        // Actually, if we selected a leaf node as "Parent", logic above handles it (shows itself).

        // Remove duplicates if any (though traverse shouldn't produce them if tree is clean)
        const uniqueCols = Array.from(new Set(cols.map(c => c.id)))
            .map(id => cols.find(c => c.id === id)!);

        return uniqueCols.sort((a, b) => {
            if (a.mappedBehavior === 'DRAFT') return -1;
            if (b.mappedBehavior === 'DRAFT') return 1;
            return 0;
        });
    };

    // Flatten statuses for columns using getColumns
    const columns = useMemo(() => {
        const baseCols = getColumns();
        // Always prepend a virtual "Aguardando" column for items without status
        // unless we are specifically filtering by a parent status that doesn't include it
        if (!filters.parentStatusId || filters.parentStatusId === 'ALL') {
            const waitingCol: ProcessStatus = {
                id: 'WAITING',
                name: 'Aguardando',
                color: '#94a3b8',
                mappedBehavior: 'PENDING',
            };
            return [waitingCol, ...baseCols];
        }
        return baseCols;
    }, [statuses, filters.parentStatusId]);

    const activeItem = activeId ? items.find(i => i.id === activeId) : null;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-[calc(100vh-250px)] gap-4 pb-4">
                {columns.length === 0 ? (
                    <div className="w-full flex justify-center items-center text-gray-400">
                        Nenhum status configurado.
                    </div>
                ) : columns.map(status => (
                        <KanbanColumn
                            key={status.id}
                            status={status}
                            items={items.filter(i =>
                                status.id === 'WAITING'
                                    ? !i.processStatusId
                                    : i.processStatusId === status.id
                            )}
                            onClick={onItemClick}
                            onAssignSuccess={fetchData}
                        />
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeItem ? (
                    <div className="rotate-2 cursor-grabbing w-[260px]">
                        <Card className="shadow-xl border-blue-500/50">
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-sm">#{activeItem.order.orderNumber}</span>
                                </div>
                                <p className="text-sm font-medium">{activeItem.product.name}</p>
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default KanbanBoard;
