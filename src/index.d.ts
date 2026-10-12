export interface ClientOptions {
  baseUrl?: string;
  /** Timeout for the complete HTTP request, in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
}

export interface SendParams {
  to: string;
  code?: string;
  locale?: string;
}

export interface SendOptions {
  idempotencyKey?: string;
}

export interface SendResponse {
  id: string;
  status: string;
  verification: string;
  mode: "test" | "live";
  channel: string | null;
  from: string | null;
  expires_at: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  verified_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  [field: string]: unknown;
}

export interface VerifyResponse {
  valid: boolean;
  verification: string;
  attempts_left: number;
  [field: string]: unknown;
}

export interface ApiProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(status: number, problem?: ApiProblem, retryAfter?: string | null);
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly errors: Record<string, string>;
  readonly retryAfter: string | null;
}

export class InvalidResponseError extends Error {
  constructor(status: number);
  readonly status: number;
}

export class Aut2fa {
  constructor(apiKey: string, options?: ClientOptions);
  send(params: SendParams, options?: SendOptions): Promise<SendResponse>;
  status(id: string): Promise<SendResponse>;
  verify(id: string, params: { code: string }): Promise<VerifyResponse>;
}
