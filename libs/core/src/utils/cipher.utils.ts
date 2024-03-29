import { createCipheriv, createDecipheriv } from 'crypto';
import { CIPHER_ALGO_AES } from '@cmnw/core/const';

export const encrypt = (sensitive: string) => {
  const key = Buffer.from(process.env.KEY);
  const cipher = createCipheriv(CIPHER_ALGO_AES, key, null);
  const encrypted = Buffer.from(
    cipher.update(sensitive, 'utf8', 'hex') + cipher.final('hex'),
  ).toString('base64');
  return `enc:${encrypted}`;
};

export const decrypt = (sensitiveEnc: string) => {
  const key = Buffer.from(process.env.KEY);
  const [s, encryptedData] = sensitiveEnc.split(':');
  if (s !== 'enc') return sensitiveEnc;
  const buff = Buffer.from(encryptedData, 'base64');
  const decipher = createDecipheriv(CIPHER_ALGO_AES, key, null);
  return (
    decipher.update(buff.toString(), 'hex', 'utf8') + decipher.final('utf8')
  );
};
