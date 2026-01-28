import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private configService: ConfigService) {}

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param text Plain text to encrypt
   * @returns Encrypted data in format: iv:authTag:encrypted
   */
  encrypt(text: string): string {
    if (!text) return text;

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted with encrypt()
   * @param encryptedData Data in format: iv:authTag:encrypted
   * @returns Decrypted plain text
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    const key = this.getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get the encryption key from environment variables
   * @returns Buffer containing the encryption key
   */
  private getEncryptionKey(): Buffer {
    const base64Key = this.configService.get<string>('ENCRYPTION_KEY');

    if (!base64Key) {
      throw new Error(
        'ENCRYPTION_KEY not found in environment variables. Please set it in AWS Secrets Manager.',
      );
    }

    const key = Buffer.from(base64Key, 'base64');

    if (key.length !== this.keyLength) {
      throw new Error(
        `Invalid encryption key length. Expected ${this.keyLength} bytes, got ${key.length} bytes.`,
      );
    }

    return key;
  }
}
