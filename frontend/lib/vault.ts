const VAULT_DATA_KEY = "cardsense.vault.data";
const VAULT_SALT_KEY = "cardsense.vault.salt";
const PASSPHRASE_CHECK_KEY = "cardsense.vault.passphrase-check";

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const saltBuffer = new Uint8Array(salt).slice().buffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 310000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

function getSalt() {
  const existing = localStorage.getItem(VAULT_SALT_KEY);
  if (existing) {
    return new Uint8Array(base64ToBuffer(existing));
  }
  const salt = generateSalt();
  localStorage.setItem(VAULT_SALT_KEY, bufferToBase64(salt.buffer));
  return salt;
}

export async function encryptVault(passphrase: string, data: unknown) {
  const salt = getSalt();
  const key = await deriveKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const payload = {
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(encrypted),
  };
  localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(payload));
}

export async function decryptVault(passphrase: string) {
  const payloadRaw = localStorage.getItem(VAULT_DATA_KEY);
  if (!payloadRaw) return null;
  const payload = JSON.parse(payloadRaw) as { iv: string; data: string };
  const salt = getSalt();
  const key = await deriveKey(passphrase, salt);
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const encrypted = base64ToBuffer(payload.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json);
}

export async function encryptPayload(passphrase: string, data: unknown) {
  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(encrypted),
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iter: 310000,
  });
}

export async function decryptPayload(passphrase: string, payloadRaw: string) {
  const payload = JSON.parse(payloadRaw) as {
    salt: string;
    iv: string;
    data: string;
    iter?: number;
  };
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const key = await deriveKey(passphrase, salt);
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const encrypted = base64ToBuffer(payload.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json);
}

export function passphraseMarkerExists() {
  return Boolean(localStorage.getItem(PASSPHRASE_CHECK_KEY));
}

export async function setPassphraseMarker(passphrase: string) {
  const marker = await encryptPayload(passphrase, { ok: true, createdAt: new Date().toISOString() });
  localStorage.setItem(PASSPHRASE_CHECK_KEY, marker);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cardsense-passphrase"));
  }
}

export async function verifyPassphrase(passphrase: string) {
  const marker = localStorage.getItem(PASSPHRASE_CHECK_KEY);
  if (!marker) return false;
  try {
    const decoded = await decryptPayload(passphrase, marker);
    return Boolean(decoded?.ok);
  } catch {
    return false;
  }
}

export function clearPassphraseMarker() {
  localStorage.removeItem(PASSPHRASE_CHECK_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cardsense-passphrase"));
  }
}

export function vaultExists() {
  return Boolean(localStorage.getItem(VAULT_DATA_KEY));
}

export function clearVault() {
  localStorage.removeItem(VAULT_DATA_KEY);
  localStorage.removeItem(VAULT_SALT_KEY);
}

export function exportVaultBundle() {
  const data = localStorage.getItem(VAULT_DATA_KEY);
  const salt = localStorage.getItem(VAULT_SALT_KEY);
  if (!data || !salt) return null;
  return JSON.stringify({
    version: 1,
    data,
    salt,
  });
}

export function importVaultBundle(bundleRaw: string) {
  const parsed = JSON.parse(bundleRaw) as { data: string; salt: string };
  if (!parsed?.data || !parsed?.salt) {
    throw new Error("Invalid vault bundle");
  }
  localStorage.setItem(VAULT_DATA_KEY, parsed.data);
  localStorage.setItem(VAULT_SALT_KEY, parsed.salt);
}
