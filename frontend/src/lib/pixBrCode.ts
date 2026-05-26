// Gerador minimalista de PIX BR Code (Copia e Cola) — EMV padrão do BACEN.
// Suficiente para QR Codes estáticos com valor opcional.

function tlv(id: string, value: string): string {
  const size = value.length.toString().padStart(2, '0');
  return `${id}${size}${value}`;
}

function crc16(input: string): string {
  const polynomial = 0x1021;
  let result = 0xffff;
  for (let i = 0; i < input.length; i++) {
    result ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      result = result & 0x8000 ? ((result << 1) ^ polynomial) & 0xffff : (result << 1) & 0xffff;
    }
  }
  return result.toString(16).toUpperCase().padStart(4, '0');
}

function normalize(s: string, maxLen: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ,.-]/g, '')
    .trim()
    .slice(0, maxLen);
}

export interface PixPayloadInput {
  key: string;
  beneficiary?: string;
  city?: string;
  amount?: number;
  txid?: string;
}

export function buildPixBrCode({ key, beneficiary, city, amount, txid }: PixPayloadInput): string {
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key.trim());

  let payload = '';
  payload += tlv('00', '01'); // payload format
  payload += tlv('26', merchantAccount);
  payload += tlv('52', '0000'); // category
  payload += tlv('53', '986'); // BRL
  if (amount && amount > 0) {
    payload += tlv('54', amount.toFixed(2));
  }
  payload += tlv('58', 'BR');
  payload += tlv('59', normalize(beneficiary || 'BENEFICIARIO', 25));
  payload += tlv('60', normalize(city || 'BRASIL', 15));
  payload += tlv('62', tlv('05', normalize(txid || '***', 25)));
  payload += '6304'; // CRC placeholder
  const crc = crc16(payload);
  return payload + crc;
}
