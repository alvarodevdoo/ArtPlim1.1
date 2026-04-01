// Componente: Lista em cards dos departamentos existentes
// Princípio SRP: apenas renderiza a lista de perfis

import React from 'react';
import { Lock, Users } from 'lucide-react';
import { RoleData } from '@/features/roles/useRoles';

import { PERMISSIONS } from './PermissionMatrix';

interface RoleListProps {
  roles: RoleData[];
  selectedRoleId: string | null;
  onSelect: (role: RoleData) => void;
}

const TOTAL_PERMISSIONS = PERMISSIONS.length;

const roleColors: Record<string, string> = {
  'Proprietário': 'bg-purple-100 text-purple-800 border-purple-300',
  'Administrador': 'bg-red-100 text-red-800 border-red-300',
  'Gerente': 'bg-blue-100 text-blue-800 border-blue-300',
  'Operador': 'bg-orange-100 text-orange-800 border-orange-300',
  'Usuário': 'bg-gray-100 text-gray-800 border-gray-300',
};

export const RoleList: React.FC<RoleListProps> = ({ roles, selectedRoleId, onSelect }) => {
  // Ocultar Proprietário pois não é editável no RBAC (é fixo do sistema)
  const sortedRoles = [...roles]
    .filter(r => r.name !== 'Proprietário')
    .sort((a, b) => {
      const weights: Record<string, number> = {
        'Administrador': 1,
      };
      
      const weightA = weights[a.name] || 99;
      const weightB = weights[b.name] || 99;
      
      if (weightA !== weightB) return weightA - weightB;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-wrap gap-2">
      {sortedRoles.map((role) => {
        const colorClass = roleColors[role.name] ?? 'bg-indigo-100 text-indigo-800 border-indigo-300';
        const isSelected = selectedRoleId === role.id;
        const activeCount = role.permissions.length;
        const percentage = Math.round((activeCount / TOTAL_PERMISSIONS) * 100);

        return (
          <button
            key={role.id}
            onClick={() => onSelect(role)}
            className={`flex flex-col items-start gap-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              isSelected
                ? `${colorClass} ring-2 ring-offset-1 ring-current`
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              {role.isSystem ? (
                <Lock className="w-3 h-3 opacity-60" />
              ) : (
                <Users className="w-3 h-3 opacity-60" />
              )}
              <span className="flex-1 text-left">{role.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isSelected ? 'bg-white/30' : 'bg-gray-100'
              }`}>
                {percentage}%
              </span>
            </div>
            {!role.isSystem && (
              <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Personalizado
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
