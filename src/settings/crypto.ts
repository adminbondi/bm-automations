import { base64ToBytes, bytesToBase64 } from "../bytes";

export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  if (!keyMaterial) throw new Error("settings_encryption_key_missing");
  const key = await aesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return `v1.${bytesToBase64(packed)}`;
}

export async function decryptSecret(payload: string, keyMaterial: string): Promise<string | null> {
  if (!keyMaterial || !payload.startsWith("v1.")) return null;
  try {
    const packed = base64ToBytes(payload.slice(3));
    if (packed.length < 13) return null;
    const key = await aesKey(keyMaterial);
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

async function aesKey(keyMaterial: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
