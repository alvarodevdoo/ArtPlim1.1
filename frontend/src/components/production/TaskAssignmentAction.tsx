import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Palette, Settings, Package, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export type TaskType = 'art' | 'prod' | 'finish';

interface AssignedUser {
  id: string;
  name: string;
}

interface TaskAssignmentActionProps {
  orderId: string;
  variant?: 'full' | 'compact';
  tasks: {
    art: AssignedUser | null;
    prod: AssignedUser | null;
    finish: AssignedUser | null;
  };
  onAssignSuccess?: () => void;
}

export const TaskAssignmentAction: React.FC<TaskAssignmentActionProps> = ({
  orderId,
  variant = 'compact',
  tasks,
  onAssignSuccess
}) => {
  const [loadingTask, setLoadingTask] = useState<TaskType | null>(null);
  const { user } = useAuth();

  const handleAssign = async (taskType: TaskType) => {
    try {
      setLoadingTask(taskType);
      const response = await api.post('/api/production/kanban/assign-task', { orderId, taskType });
      if (response.data.success) {
        toast.success('Tarefa assumida com sucesso!');
        onAssignSuccess?.();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao assumir tarefa');
    } finally {
      setLoadingTask(null);
    }
  };

  const config = {
    art: {
      icon: Palette,
      label: 'Arte',
      assigned: tasks.art
    },
    prod: {
      icon: Settings,
      label: 'Produção',
      assigned: tasks.prod
    },
    finish: {
      icon: Package,
      label: 'Acabamento',
      assigned: tasks.finish
    }
  };

  const renderButton = (type: TaskType) => {
    const { icon: Icon, label, assigned } = config[type];
    const isAssignedToMe = assigned?.id === user?.id;
    const isAssignedToOther = assigned && !isAssignedToMe;
    const isLoading = loadingTask === type;

    if (variant === 'full') {
      return (
        <div key={type} className="flex flex-col items-center gap-1 w-full">
          <Button
            variant={assigned ? (isAssignedToMe ? "default" : "outline") : "secondary"}
            className="w-full justify-start relative h-12"
            disabled={!!assigned || isLoading}
            onClick={() => handleAssign(type)}
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
            {assigned ? (isAssignedToMe ? 'Sua Tarefa' : 'Atribuído') : `Assumir ${label}`}
            {isAssignedToMe && <CheckCircle2 className="w-4 h-4 absolute right-3 text-green-300" />}
          </Button>
          {assigned && (
            <span className="text-xs text-muted-foreground truncate w-full text-center">
              {assigned.name}
            </span>
          )}
        </div>
      );
    }

    // Compact variant
    return (
      <TooltipProvider key={type}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={assigned ? (isAssignedToMe ? "default" : "ghost") : "outline"}
              size="icon"
              className={`h-8 w-8 rounded-full ${isAssignedToOther ? 'opacity-50' : ''}`}
              disabled={!!assigned || isLoading}
              onClick={() => handleAssign(type)}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {assigned 
                ? `${label}: ${assigned.name}` 
                : `Assumir ${label}`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={`flex gap-2 ${variant === 'full' ? 'w-full justify-between' : 'items-center'}`}>
      {(Object.keys(config) as TaskType[]).map(renderButton)}
    </div>
  );
};

export default TaskAssignmentAction;
