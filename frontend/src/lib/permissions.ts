export type PermissionType =
    | 'sales.view' | 'sales.create' | 'sales.edit' | 'sales.delete' | 'sales.approve'
    | 'finance.view' | 'finance.costs' | 'finance.margins' | 'finance.reports'
    | 'production.view' | 'production.manage'
    | 'inventory.view' | 'inventory.manage'
    | 'admin.users' | 'admin.settings' | 'admin.organization';

export const ROLE_PERMISSIONS: Record<string, PermissionType[]> = {
    OWNER: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins', 'finance.reports',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage',
        'admin.users', 'admin.settings', 'admin.organization'
    ],
    ADMIN: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins', 'finance.reports',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage',
        'admin.users', 'admin.settings'
    ],
    MANAGER: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage'
    ],
    OPERATOR: [
        'production.view', 'production.manage',
        'inventory.view'
    ],
    USER: [
        'sales.view', 'sales.create', 'sales.edit'
    ]
};

export const MODULE_SETTINGS_MAP: Record<PermissionType, string> = {
    'sales.view': '',
    'sales.create': '',
    'sales.edit': '',
    'sales.delete': '',
    'sales.approve': '',
    'finance.view': 'enableFinance',
    'finance.costs': 'enableFinance',
    'finance.margins': 'enableFinance',
    'finance.reports': 'enableFinanceReports',
    'production.view': 'enableProduction',
    'production.manage': 'enableProduction',
    'inventory.view': 'enableWMS',
    'inventory.manage': 'enableWMS',
    'admin.users': '',
    'admin.settings': '',
    'admin.organization': ''
};
