export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message = "Bad request", details?: unknown) => new HttpError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") => new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have access to this resource") => new HttpError(403, "FORBIDDEN", message);
// Use notFound (not forbidden) for resources outside the caller's scope so we
// don't leak the existence of records in other centers / of other students.
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message = "Conflict", details?: unknown) => new HttpError(409, "CONFLICT", message, details);
