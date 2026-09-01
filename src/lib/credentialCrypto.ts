import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Application-layer encryption for the portal credentials vault.
 *
 * Client logins (website hosts, CMS accounts, registrars) are encrypted here
 * before they are written to Supabase and decrypted only inside server routes,
 * so the database never holds a readable password.
 *
 * Key: PORTAL_CREDENTIALS_KEY — 32 random bytes, base64 encoded.
 * Generate one with: openssl rand -base64 32
 */

const KEY_ENV = 'PORTAL_CREDENTIALS_KEY';

function getKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) throw new Error(`${KEY_ENV} is not set — the credentials vault is disabled.`);
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be 32 bytes, base64 encoded (openssl rand -base64 32).`);
  }
  return key;
}

/** True when the encryption key is present and well formed. */
export function vaultKeyReady(): boolean {
  try { getKey(); return true; } catch { return false; }
}

/** Encrypts a value into "v1.<iv>.<authTag>.<ciphertext>", all base64. */
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/** Reverses encryptSecret. Throws if the payload was tampered with. */
export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const [version, ivB64, tagB64, ctB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Stored value is not in the expected encrypted format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
