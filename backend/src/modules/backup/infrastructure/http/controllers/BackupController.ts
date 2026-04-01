import { FastifyRequest, FastifyReply } from 'fastify';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { Readable } from 'stream';
import { getTenantClient } from '../../../../../shared/infrastructure/database/tenant';
import { ExportBackupUseCase } from '../../../useCases/ExportBackupUseCase';
import { ImportBackupUseCase } from '../../../useCases/ImportBackupUseCase';
import { BackupModule } from '../../../backup.types';
import { BackupCryptoService } from '../../crypto/BackupCryptoService';

export class BackupController {
  async export(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ExportBackupUseCase(prisma as any);

      // Obter módulos solicitados (padrão todos se não informado)
      const { modules, password, unencrypted } = request.query as { modules?: string, password?: string, unencrypted?: string };
      const allModules: BackupModule[] = ['config', 'profiles', 'materials', 'products', 'production', 'sales', 'finance'];
      const requestedModules = modules 
        ? (modules.split(',') as BackupModule[])
        : allModules;

      const filename = `backup-artplim-${organizationId}-${new Date().toISOString().split('T')[0]}.bdb`;

      if (unencrypted === 'true' && request.user!.role !== 'OWNER') {
        return reply.status(403).send({ error: { message: 'Apenas proprietários podem exportar backups descriptografados.' } });
      }

      // Buscar a senha mestre nas configurações
      const settings = await prisma.organizationSettings.findUnique({ where: { organizationId }}) as any;
      const masterPasswordPlain = settings?.defaultBackupPassword 
        ? BackupCryptoService.decryptMasterPassword(settings.defaultBackupPassword)
        : null;

      // Configurar headers para download binário com extensão customizada (.bdb)
      reply.raw.writeHead(200, {
        'Content-Type': 'application/octet-stream', // 'bdb' para curiosos
        'Content-Disposition': `attachment; filename="${filename}"`,
        // 'Transfer-Encoding': 'chunked', (já gerenciado pelo fastify / node http na vdd)
        'X-Content-Type-Options': 'nosniff'
      });

      // Inicializa o arquivador ZIP
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      let cipherStream: any = null;

      if (unencrypted !== 'true') {
        const { DEK, streamIV, headerString } = BackupCryptoService.createEncryptionEnvelope(
          masterPasswordPlain,
          password
        );
        cipherStream = BackupCryptoService.getCipherStream(DEK, streamIV);
        
        reply.raw.write(headerString); // Escreve o cabeçalho de chaves
        archive.pipe(cipherStream).pipe(reply.raw);
      } else {
        archive.pipe(reply.raw);
      }

      // 1. Adiciona metadados do backup (metadata.json)
      const metadata = {
        version: "2.1",
        organizationId,
        createdAt: new Date().toISOString(),
        modules: requestedModules,
        format: "modular-zip"
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      // 2. Adiciona cada módulo solicitado como um arquivo JSON independente no ZIP
      for (const module of requestedModules) {
        const moduleStream = Readable.from(useCase.generateModuleJSON(organizationId, module));
        
        // Mapeamento de nome de arquivo amigável dentro do ZIP
        const fileNameMap: Record<string, string> = {
          config: 'configuracoes.json',
          profiles: 'perfis_usuarios.json',
          materials: 'estoque_insumos.json',
          products: 'produtos_catalogo.json',
          production: 'producao.json',
          sales: 'vendas.json',
          finance: 'financeiro.json'
        };

        const internalName = fileNameMap[module] || `${module}.json`;
        archive.append(moduleStream, { name: internalName });
      }

      // Finaliza a geração do ZIP
      await archive.finalize();

      return reply;
    } catch (error: any) {
      console.error('Erro na exportação ZIP (.bdb):', error);
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ 
          success: false, 
          error: { message: 'Erro ao gerar pacote de backup modular', statusCode: 500 } 
        });
      }
    }
  }

  async import(request: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = request.user!.organizationId;
      const userId = request.user!.userId;
      const prisma = getTenantClient(organizationId);
      const useCase = new ImportBackupUseCase(prisma as any);
      
      let fileBuffer: Buffer | null = null;
      let password = '';

      // Verifica se a rota recebeu multipart form
      if (!request.isMultipart()) {
        throw new Error('Formato inválido. Use multipart/form-data.');
      }

      for await (const part of request.parts()) {
        if (part.type === 'file' && part.fieldname === 'file') {
          fileBuffer = await part.toBuffer();
        } else if (part.type === 'field' && part.fieldname === 'password') {
          password = part.value as string;
        }
      }

      if (!fileBuffer) {
        throw new Error('Nenhum arquivo de backup foi enviado.');
      }

      // Encontrar a primeira quebra de linha (que delimita o header do arquivo BDB)
      const lineEnd = fileBuffer.indexOf('\n');
      if (lineEnd === -1) {
        throw new Error('Formato de backup corrompido ou arquivo não é um ".bdb" válido.');
      }

      // Parsing do Envelope Criptográfico
      const headerString = fileBuffer.toString('utf8', 0, lineEnd);
      const archiveBuffer = fileBuffer.subarray(lineEnd + 1);

      let headerObject;
      try {
        headerObject = JSON.parse(headerString);
      } catch {
        throw new Error('Cabeçalho de segurança corrompido.');
      }

      // Descriptografia (Testa a senha contra o Envelope)
      const { DEK, streamIV } = BackupCryptoService.unlockEnvelope(headerObject, password);

      // Decifrar o conteúdo ZIP binário
      const decipher = BackupCryptoService.getDecipherStream(DEK, streamIV);
      let decryptedArchive = decipher.update(archiveBuffer);
      decryptedArchive = Buffer.concat([decryptedArchive, decipher.final()]);

      // Extração e Mapeamento dos Arquivos do ZIP Retornado
      const zip = new AdmZip(decryptedArchive);
      const zipEntries = zip.getEntries();
      
      const payload: any = { payload: {} };
      const fileNameMapRev: Record<string, string> = {
        'configuracoes.json': 'config',
        'perfis_usuarios.json': 'profiles',
        'estoque_insumos.json': 'materials',
        'produtos_catalogo.json': 'products',
        'producao.json': 'production',
        'vendas.json': 'sales',
        'financeiro.json': 'finance'
      };

      for (const zipEntry of zipEntries) {
        if (zipEntry.isDirectory || zipEntry.entryName === 'metadata.json') continue;
        
        const moduleName = fileNameMapRev[zipEntry.entryName] || zipEntry.entryName.split('.')[0];
        try {
          const jsonStr = zip.readAsText(zipEntry);
          payload.payload[moduleName] = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error(`Erro ao parsear arquivo no pacote postal: ${zipEntry.entryName}`);
        }
      }

      // Injeta payload reconstituído na engine de restore original
      const results = await useCase.execute(organizationId, userId, payload);

      return reply.send({ success: true, data: results });
    } catch (error: any) {
      console.error('Erro na restauração segregada (.bdb):', error);
      return reply.status(400).send({ 
        success: false, 
        error: { message: error.message || 'Erro inesperado', statusCode: 400 } 
      });
    }
  }
}
