import { z } from 'zod';

export const BackupFileSchema = z.object({
  version: z.string(),
  organizationId: z.string(),
  createdAt: z.string().optional(),
  payload: z.object({
    config: z.record(z.array(z.any())).optional(),
    profiles: z.record(z.array(z.any())).optional(),
    materials: z.record(z.array(z.any())).optional(),
    products: z.record(z.array(z.any())).optional(),
    production: z.record(z.array(z.any())).optional(),
    sales: z.record(z.array(z.any())).optional(),
    finance: z.record(z.array(z.any())).optional(),
  })
});

// Função de utilidade para o componente Configuracoes.tsx
export const validateBackupFile = async (file: File) => {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    return BackupFileSchema.safeParse(json);
  } catch (err) {
    return { success: false, error: new Error('Arquivo JSON inválido') };
  }
};
