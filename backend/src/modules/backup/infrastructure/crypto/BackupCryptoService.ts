import crypto from 'crypto';

const SYSTEM_SECRET = (process.env.JWT_SECRET || 'artplimerp-super-safe-secretKey123').padEnd(32, '0').substring(0, 32);

export class BackupCryptoService {
  /**
   * Criptografa a senha mestra para salvar no BD de forma segura, porém reversível pelo sistema.
   */
  static encryptMasterPassword(plainText: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SYSTEM_SECRET), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decryptMasterPassword(hash: string): string {
    const parts = hash.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SYSTEM_SECRET), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  /**
   * Gera uma Chave Mestre (DEK) aleatória e o cabeçalho envolpape criptografado (Envelope).
   * Retorna também o DEK para ser usado na criptografia do fluxo (stream).
   */
  static createEncryptionEnvelope(masterPasswordPlain: string | null, userPasswordPlain?: string) {
    const DEK = crypto.randomBytes(32); // Chave usada para criptografar os dados (ZIP)
    const streamIV = crypto.randomBytes(16); // IV para o AES-256-CBC do stream

    const enveloper = (password: string) => {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encryptedDek = cipher.update(DEK);
      encryptedDek = Buffer.concat([encryptedDek, cipher.final()]);
      return {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        encryptedDek: encryptedDek.toString('hex')
      };
    };

    const headerObject: any = {
      streamIV: streamIV.toString('hex'),
      dekHash: crypto.createHash('sha256').update(DEK).digest('hex'), // Para validar a senha instantaneamente
      ownerKeys: masterPasswordPlain ? enveloper(masterPasswordPlain) : null,
      userKeys: userPasswordPlain ? enveloper(userPasswordPlain) : null
    };

    // Formata o cabeçalho como JSON de linha única seguido de quebra de linha
    const headerString = JSON.stringify(headerObject) + '\n';

    return {
      DEK,
      streamIV,
      headerString
    };
  }

  /**
   * Tenta desbloquear a Chave Mestre (DEK) usando a senha informada,
   * testando contra o cofre do Proprietário ou do Usuário.
   */
  static unlockEnvelope(headerObject: any, passwordAttempt: string) {
    const unlockData = (envelopeData: { salt: string, iv: string, encryptedDek: string }) => {
      try {
        const salt = Buffer.from(envelopeData.salt, 'hex');
        const iv = Buffer.from(envelopeData.iv, 'hex');
        const encryptedDek = Buffer.from(envelopeData.encryptedDek, 'hex');
        
        const key = crypto.pbkdf2Sync(passwordAttempt, salt, 100000, 32, 'sha256');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        // Desativa autopadding pre-emptivamente ou não, dependendo se sabermos que tem 32 bytes
        decipher.setAutoPadding(false);
        let dek = decipher.update(encryptedDek);
        dek = Buffer.concat([dek, decipher.final()]);
        
        // Verifica assinatura instantânea para garantir que a senha abriu a chave correta
        const dekHashAttempt = crypto.createHash('sha256').update(dek).digest('hex');
        if (dekHashAttempt !== headerObject.dekHash) {
          return null;
        }

        return dek;
      } catch (e) {
        return null;
      }
    };

    let DEK = null;

    if (headerObject.ownerKeys) {
      DEK = unlockData(headerObject.ownerKeys);
    }
    
    // Se ainda não abriu e tem cofre de usuário
    if (!DEK && headerObject.userKeys) {
       DEK = unlockData(headerObject.userKeys);
    }

    if (!DEK) throw new Error('Acesso negado: Senha incorreta para descriptografar o backup.');

    return {
      DEK,
      streamIV: Buffer.from(headerObject.streamIV, 'hex')
    };
  }

  /**
   * Retorna um Crypto Stream para cifrar o backup.
   */
  static getCipherStream(dek: Buffer, iv: Buffer) {
    return crypto.createCipheriv('aes-256-cbc', dek, iv);
  }

  /**
   * Retorna um Crypto Stream para decifrar o backup.
   */
  static getDecipherStream(dek: Buffer, iv: Buffer) {
    return crypto.createDecipheriv('aes-256-cbc', dek, iv);
  }
}
