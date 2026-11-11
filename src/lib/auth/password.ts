import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(pw: string, salt: Buffer, len: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

// scrypt N=2^16, r=8, p=1 (~64 MB por hash)
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 160 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64url");
  if (expected.length < 16) return false;
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return timingSafeEqual(key, expected);
}

/** Hash fictício para igualar o tempo de resposta quando o usuário não existe. */
export const DUMMY_HASH = ["scrypt", N, R, P, "AAAAAAAAAAAAAAAAAAAAAA", "A".repeat(43)].join("$");

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "A senha precisa ter ao menos 8 caracteres";
  if (pw.length > 128) return "Senha muito longa";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use letras e números na senha";
  return null;
}
