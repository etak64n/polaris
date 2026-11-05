// Errors that map to HTTP responses.

import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;

  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string): HttpError => new HttpError(400, "bad_request", message);
export const notFound = (message: string): HttpError => new HttpError(404, "not_found", message);
