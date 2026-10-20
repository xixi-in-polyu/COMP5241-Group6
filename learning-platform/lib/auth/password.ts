import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;
const PASSWORD_HASH_PREFIX = "scrypt";

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return [
    PASSWORD_HASH_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedValue: string,
): Promise<boolean> {
  const parts = storedValue.split("$");
  if (
    parts.length === 6 &&
    parts[0] === PASSWORD_HASH_PREFIX &&
    parts[1] === String(SCRYPT_COST) &&
    parts[2] === String(SCRYPT_BLOCK_SIZE) &&
    parts[3] === String(SCRYPT_PARALLELIZATION) &&
    /^[a-f0-9]{32}$/.test(parts[4]) &&
    /^[a-f0-9]{128}$/.test(parts[5])
  ) {
    const expectedKey = Buffer.from(parts[5], "hex");
    const actualKey = await deriveKey(password, Buffer.from(parts[4], "hex"));
    return timingSafeEqual(actualKey, expectedKey);
  }

  if (isPasswordHash(storedValue)) {
    return false;
  }

  const expectedValue = Buffer.from(storedValue);
  const actualValue = Buffer.from(password);
  return (
    expectedValue.length === actualValue.length &&
    timingSafeEqual(actualValue, expectedValue)
  );
}
