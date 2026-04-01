import { z } from 'zod';

export type BackupModule = 'config' | 'profiles' | 'materials' | 'products' | 'production' | 'sales' | 'finance';

export interface ImportResult {
  module: BackupModule;
  successCount: number;
  errorCount: number;
  details?: string;
}

export interface BackupPayload {
  version: string;
  organizationId: string;
  createdAt: string;
  payload: {
    [key in BackupModule]?: Record<string, any[]>;
  };
}
