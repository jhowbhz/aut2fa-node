import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { ApiError, Aut2fa, InvalidResponseError } from "../src/index.js";

const SEND = {
  id: "snd_123", status: "queued", verification: "pending", mode: "test",
  channel: null, from: null, expires_at: "2026-10-11T12:10:00Z",
  created_at: "2026-10-11T12:00:00Z", sent_at: null, delivered_at: null,
  read_at: null, verified_at: null, failed_at: null, failure_reason: null,
};

async function server(t, handler) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => {
    instance.closeAllConnections();
    instance.close(resolve);
  }));
  return `http://127.0.0.1:${instance.address().port}`;
}

async function requestBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

test("send preserves leading zeroes, idempotency and nullable delivery fields", async (t) => {
  let captured;
  const baseUrl = await server(t, async (request, response) => {
    captured = { method: request.method, url: request.url, headers: request.headers, body: await requestBody(request) };
    json(response, 202, { ...SEND, future_field: true });
  });
  const result = await new Aut2fa("ak_test_fixture", { baseUrl }).send(
    { to: "+5531999999999", code: "000000", locale: "pt-BR" },
    { idempotencyKey: "login-123" },
  );
  assert.equal(captured.method, "POST");
  assert.equal(captured.url, "/v1/send");
  assert.equal(captured.headers.authorization, "Bearer ak_test_fixture");
  assert.equal(captured.headers.accept, "application/json");
  assert.equal(captured.headers["content-type"], "application/json");
  assert.equal(captured.headers["idempotency-key"], "login-123");
  assert.deepEqual(JSON.parse(captured.body), { to: "+5531999999999", code: "000000", locale: "pt-BR" });
  assert.equal(result.id, "snd_123");
  assert.equal(result.channel, null);
  assert.equal(result.from, null);
  assert.equal(result.future_field, true);
});

test("status uses a GET with authentication and no JSON body", async (t) => {
  let captured;
  const baseUrl = await server(t, async (request, response) => {
    captured = { method: request.method, url: request.url, headers: request.headers, body: await requestBody(request) };
    json(response, 200, SEND);
  });
  const result = await new Aut2fa("ak_test_fixture", { baseUrl }).status("snd_123");
  assert.equal(result.id, "snd_123");
  assert.equal(captured.method, "GET");
  assert.equal(captured.url, "/v1/send/snd_123/status");
  assert.equal(captured.body, "");
  assert.equal(captured.headers.authorization, "Bearer ak_test_fixture");
  assert.equal(captured.headers["content-type"], undefined);
});

test("a rejected verification is a normal result with attempts remaining", async (t) => {
  let captured;
  const baseUrl = await server(t, async (request, response) => {
    captured = { method: request.method, url: request.url, body: await requestBody(request) };
    json(response, 200, { valid: false, verification: "pending", attempts_left: 4 });
  });
  const result = await new Aut2fa("ak_test_fixture", { baseUrl }).verify("snd_123", { code: "012345" });
  assert.deepEqual(result, { valid: false, verification: "pending", attempts_left: 4 });
  assert.equal(captured.method, "POST");
  assert.equal(captured.url, "/v1/send/snd_123/verify");
  assert.deepEqual(JSON.parse(captured.body), { code: "012345" });
});

for (const [status, code] of [[401, "invalid_api_key"], [402, "insufficient_credits"], [409, "idempotency_key_reused"], [422, "invalid_recipient"], [429, "rate_limited"], [503, "unavailable"]]) {
  test(`HTTP ${status} preserves the API code, actual status and retry advice without retrying`, async (t) => {
    let requests = 0;
    const baseUrl = await server(t, (request, response) => {
      requests += 1;
      response.writeHead(status, { "Content-Type": "application/problem+json", "Retry-After": "17" });
      response.end(JSON.stringify({ type: "https://aut2fa.com/docs/errors#fixture", title: "Failure", status: 500, code, detail: "Request rejected", errors: { to: "Invalid recipient" } }));
    });
    await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl }).send({ to: "+5531999999999" }), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.detail, "Request rejected");
      assert.deepEqual(error.errors, { to: "Invalid recipient" });
      assert.equal(error.retryAfter, "17");
      return true;
    });
    assert.equal(requests, 1);
  });
}

test("a non-JSON HTTP error keeps its status without leaking the response body", async (t) => {
  const baseUrl = await server(t, (request, response) => {
    response.writeHead(502, { "Content-Type": "text/html" });
    response.end("<h1>private upstream details</h1>");
  });
  await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl }).status("snd_123"), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.code, "http_error");
    assert.doesNotMatch(error.message, /private upstream/);
    return true;
  });
});

for (const body of ["not JSON", "[]", "null", "{}", '{"id":123,"status":"queued"}']) {
  test(`an invalid successful send response is rejected: ${body}`, async (t) => {
    const baseUrl = await server(t, (request, response) => {
      response.writeHead(202, { "Content-Type": "application/json" });
      response.end(body);
    });
    await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl }).send({ to: "+5531999999999" }), InvalidResponseError);
  });
}

test("malformed verification fields are not treated as a valid code", async (t) => {
  const baseUrl = await server(t, (request, response) => json(response, 200, { valid: "false", verification: "pending", attempts_left: "4" }));
  await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl }).verify("snd_123", { code: "012345" }), InvalidResponseError);
});

test("redirects never forward the application key to another endpoint", async (t) => {
  let forwarded = 0;
  const target = await server(t, (request, response) => {
    forwarded += 1;
    json(response, 202, SEND);
  });
  const baseUrl = await server(t, (request, response) => {
    response.writeHead(307, { Location: target });
    response.end();
  });
  await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl }).send({ to: "+5531999999999" }), (error) => error instanceof ApiError && error.status === 307);
  assert.equal(forwarded, 0);
});

test("a stalled response is aborted at the configured timeout", async (t) => {
  const baseUrl = await server(t, () => {});
  await assert.rejects(new Aut2fa("ak_test_fixture", { baseUrl, timeoutMs: 25 }).status("snd_123"), (error) => ["TimeoutError", "AbortError"].includes(error.name));
});

test("a base URL prefix and a trailing slash preserve the API route", async (t) => {
  let path;
  const baseUrl = await server(t, (request, response) => {
    path = request.url;
    json(response, 202, SEND);
  });
  await new Aut2fa("ak_test_fixture", { baseUrl: `${baseUrl}/api/` }).send({ to: "+5531999999999" });
  assert.equal(path, "/api/v1/send");
});

test("invalid credentials and configuration are rejected without exposing the key", () => {
  for (const key of ["", " ", "secret\r\nInjected: yes"]) {
    assert.throws(() => new Aut2fa(key), (error) => error instanceof TypeError && !error.message.includes("secret"));
  }
  for (const baseUrl of ["ftp://example.com", "https://user:password@example.com", "https://example.com?query=1", "https://example.com#fragment"]) {
    assert.throws(() => new Aut2fa("ak_test_fixture", { baseUrl }), TypeError);
  }
  for (const timeoutMs of [0, -1, NaN, Infinity, "10"]) {
    assert.throws(() => new Aut2fa("ak_test_fixture", { timeoutMs }), TypeError);
  }
});

test("invalid IDs and idempotency headers cannot change the HTTP route or headers", async (t) => {
  let requests = 0;
  const baseUrl = await server(t, (request, response) => {
    requests += 1;
    json(response, 202, SEND);
  });
  const client = new Aut2fa("ak_test_fixture", { baseUrl });
  for (const id of ["", "..", "snd/other", "snd?query=1", "snd#fragment"]) {
    await assert.rejects(client.status(id), TypeError);
  }
  for (const idempotencyKey of ["bad\r\nInjected: yes", "x".repeat(256), "é".repeat(128)]) {
    await assert.rejects(client.send({ to: "+5531999999999" }, { idempotencyKey }), TypeError);
  }
  await assert.rejects(client.send({ to: 123 }), TypeError);
  await assert.rejects(client.verify("snd_123", { code: 123456 }), TypeError);
  assert.equal(requests, 0);
});
