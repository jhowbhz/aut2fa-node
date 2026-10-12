import { Buffer } from "node:buffer";

const DEFAULT_BASE_URL = "https://api.aut2fa.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const SEND_ID = /^[A-Za-z0-9_-]+$/u;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function headerValue(value) {
  // fetch accepts Latin-1 byte strings; the API expects UTF-8 header bytes.
  return Buffer.from(value, "utf8").toString("latin1");
}

function isProblem(value) {
  return isObject(value) && typeof value.code === "string" && value.code.trim() !== ""
    && (value.detail === undefined || typeof value.detail === "string");
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function requireId(id) {
  if (typeof id !== "string" || !SEND_ID.test(id)) {
    throw new TypeError("id must contain only letters, numbers, underscores or hyphens");
  }
}

function isSend(value) {
  return typeof value.id === "string" && value.id !== "" && typeof value.status === "string";
}

function isVerification(value) {
  return typeof value.valid === "boolean" && typeof value.verification === "string"
    && Number.isInteger(value.attempts_left) && value.attempts_left >= 0;
}

export class ApiError extends Error {
  constructor(status, problem = {}, retryAfter = null) {
    const code = typeof problem.code === "string" && problem.code !== "" ? problem.code : "http_error";
    const detail = typeof problem.detail === "string" ? problem.detail : `HTTP ${status}`;
    super(detail || code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = isObject(problem.errors)
      ? Object.fromEntries(Object.entries(problem.errors).filter(([, value]) => typeof value === "string"))
      : {};
    this.retryAfter = retryAfter;
  }
}

export class InvalidResponseError extends Error {
  constructor(status) {
    super("The API returned an invalid JSON response");
    this.name = "InvalidResponseError";
    this.status = status;
  }
}

export class Aut2fa {
  #apiKey;
  #baseUrl;
  #timeoutMs;

  constructor(apiKey, { baseUrl = DEFAULT_BASE_URL, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    requireString(apiKey, "apiKey");
    if (CONTROL_CHARACTERS.test(apiKey)) {
      throw new TypeError("apiKey must not contain control characters");
    }
    requireString(baseUrl, "baseUrl");
    let url;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new TypeError("baseUrl must be an absolute HTTP or HTTPS URL");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || baseUrl.includes("?") || baseUrl.includes("#") || CONTROL_CHARACTERS.test(baseUrl)) {
      throw new TypeError("baseUrl must be HTTP or HTTPS without credentials, query or fragment");
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
      throw new TypeError("timeoutMs must be a positive integer no greater than 2147483647");
    }
    this.#apiKey = apiKey.trim();
    this.#baseUrl = url.toString().replace(/\/+$/u, "");
    this.#timeoutMs = timeoutMs;
  }

  async send(params, { idempotencyKey } = {}) {
    if (!isObject(params)) throw new TypeError("send params must be an object");
    requireString(params.to, "to");
    const body = { to: params.to };
    for (const field of ["code", "locale"]) {
      if (params[field] !== undefined) {
        requireString(params[field], field);
        body[field] = params[field];
      }
    }
    const headers = {};
    if (idempotencyKey !== undefined) {
      if (typeof idempotencyKey !== "string" || CONTROL_CHARACTERS.test(idempotencyKey)
        || new TextEncoder().encode(idempotencyKey).length > 255) {
        throw new TypeError("idempotencyKey must be a string of at most 255 bytes without control characters");
      }
      headers["Idempotency-Key"] = headerValue(idempotencyKey);
    }
    return this.#request("POST", "/v1/send", body, headers, isSend);
  }

  async status(id) {
    requireId(id);
    return this.#request("GET", `/v1/send/${id}/status`, undefined, {}, isSend);
  }

  async verify(id, params) {
    requireId(id);
    if (!isObject(params)) throw new TypeError("verify params must be an object");
    requireString(params.code, "code");
    return this.#request("POST", `/v1/send/${id}/verify`, { code: params.code }, {}, isVerification);
  }

  async #request(method, path, body, additionalHeaders, validate) {
    const headers = { Authorization: headerValue(`Bearer ${this.#apiKey}`), Accept: "application/json", ...additionalHeaders };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual", signal: AbortSignal.timeout(this.#timeoutMs),
    });
    let payload;
    try {
      payload = JSON.parse(await response.text());
    } catch (error) {
      // A timed-out body read is a network failure, not a malformed API response.
      if (!(error instanceof SyntaxError)) throw error;
      payload = null;
    }
    if (!response.ok) {
      throw new ApiError(response.status, isProblem(payload) ? payload : {}, response.headers.get("Retry-After"));
    }
    if (!isObject(payload) || !validate(payload)) throw new InvalidResponseError(response.status);
    return payload;
  }
}
