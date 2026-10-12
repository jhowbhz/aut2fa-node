import { ApiError, Aut2fa, type SendResponse, type VerifyResponse } from "@aut2fa/node";

async function consume(client: Aut2fa): Promise<boolean> {
  const send: SendResponse = await client.send({ to: "+5531999999999", code: "000000" }, { idempotencyKey: "login-123" });
  const status: SendResponse = await client.status(send.id);
  const result: VerifyResponse = await client.verify(status.id, { code: "000000" });
  const channel: string | null = status.channel;
  const retryAfter: string | null = new ApiError(429).retryAfter;
  void channel;
  void retryAfter;
  // @ts-expect-error Numeric codes would lose leading zeroes.
  await client.verify(send.id, { code: 123456 });
  // @ts-expect-error A recipient must preserve its full phone number.
  await client.send({ to: 123456 });
  return result.valid;
}

void consume;
