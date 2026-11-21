import argon2 from "argon2";

// OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Used to equalize timing when the email does not exist (prevents user enumeration).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= hashPassword("educore-timing-equalizer");
  await verifyPassword(await dummyHash, plain);
}

export const passwordSchemaRules = {
  min: 10,
  max: 128,
};
