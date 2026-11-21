import type { ZodType, ZodTypeDef } from "zod";
import { badRequest } from "./errors.js";

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      "Validation failed",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })),
    );
  }
  return result.data;
}
