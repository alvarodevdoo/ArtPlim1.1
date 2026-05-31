import crypto from 'crypto';

const DEK = crypto.randomBytes(32); // Chave usada para criptografar os dados (ZIP)
const streamIV = crypto.randomBytes(16); // IV para o AES-256-CBC do stream

const password = "mysecretpassword";

const enveloper = (password) => {
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

const headerObject = {
  streamIV: streamIV.toString('hex'),
  dekHash: crypto.createHash('sha256').update(DEK).digest('hex'), // Para validar a senha instantaneamente
  ownerKeys: enveloper(password)
};

const unlockData = (envelopeData, passwordAttempt) => {
  try {
    const salt = Buffer.from(envelopeData.salt, 'hex');
    const iv = Buffer.from(envelopeData.iv, 'hex');
    const encryptedDek = Buffer.from(envelopeData.encryptedDek, 'hex');
    
    const key = crypto.pbkdf2Sync(passwordAttempt, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // COMMENTED OUT: decipher.setAutoPadding(false);
    let dek = decipher.update(encryptedDek);
    dek = Buffer.concat([dek, decipher.final()]);
    
    console.log("DEK original length:", DEK.length);
    console.log("DEK decrypted length:", dek.length);
    console.log("Original hash:", headerObject.dekHash);
    
    // Verifica assinatura instantânea para garantir que a senha abriu a chave correta
    const dekHashAttempt = crypto.createHash('sha256').update(dek).digest('hex');
    console.log("Attempt hash:", dekHashAttempt);
    
    if (dekHashAttempt !== headerObject.dekHash) {
      console.log("HASH MISMATCH!");
      return null;
    }

    return dek;
  } catch (e) {
    console.error(e);
    return null;
  }
};

const result = unlockData(headerObject.ownerKeys, password);
console.log("Result:", result ? "SUCCESS" : "FAILURE");
