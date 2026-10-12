# aut2fa-node

[![npm](https://img.shields.io/npm/v/@aut2fa/node)](https://www.npmjs.com/package/@aut2fa/node)

Cliente Node.js para enviar, consultar e verificar códigos 2FA pela API aut2fa. Requer Node.js 20 ou superior, inclui tipos TypeScript e usa o `fetch` nativo, sem dependências de execução.

## Instalar

O pacote está publicado no npm como [`@aut2fa/node`](https://www.npmjs.com/package/@aut2fa/node):

```sh
npm install @aut2fa/node
```

Também funciona com `pnpm add @aut2fa/node` e `yarn add @aut2fa/node`.

## Enviar, consultar e verificar

Defina `AUT2FA_API_KEY` com a chave da aplicação e execute no servidor:

```javascript
import { Aut2fa } from "@aut2fa/node";

const client = new Aut2fa(process.env.AUT2FA_API_KEY);
const send = await client.send({ to: "+5531999999999" });
const status = await client.status(send.id);
const result = await client.verify(send.id, { code: "000000" });
console.log(status.status, result.valid);
```

Use uma chave `ak_test_…` e o código `000000` para o modo de teste. As respostas preservam os nomes dos campos da API, os valores `null` e campos adicionais. Uma verificação com `valid: false` é um resultado normal, com `attempts_left` informando as tentativas restantes.

## Configurar o cliente

O endereço padrão é `https://api.aut2fa.com`, com timeout de 10 segundos para a requisição completa. Configure uma API local ou outro timeout pelo construtor:

```javascript
const client = new Aut2fa(process.env.AUT2FA_API_KEY, {
  baseUrl: "http://localhost:8080",
  timeoutMs: 5000,
});
```

`send` aceita `code` e `locale` opcionais. Para repetir um envio com segurança, escolha uma chave de idempotência por operação e mantenha-a nas repetições:

```javascript
const send = await client.send(
  { to: "+5531999999999", locale: "pt-BR" },
  { idempotencyKey: "login-request-123" },
);
```

O cliente não segue redirecionamentos nem repete requisições automaticamente. Uma nova verificação pode consumir outra tentativa.

## Tratar erros da API

Respostas HTTP fora de 2xx geram `ApiError`. Use o código estável, o status HTTP real e o cabeçalho `Retry-After`:

```javascript
import { ApiError } from "@aut2fa/node";

try {
  await client.send({ to: "+5531999999999" });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.code, error.status, error.retryAfter);
  } else {
    throw error;
  }
}
```

`ApiError` também contém `detail` e `errors`. Uma resposta 2xx inválida gera `InvalidResponseError`. Erros de rede e timeout preservam os erros nativos do `fetch`.

## Desenvolver e publicar

Execute `npm ci`, `npm run check`, `npm run typecheck` e `npm test`. Os testes usam servidores HTTP locais e não enviam mensagens. `npm pack` gera o arquivo instalável; `npm publish --dry-run --access public` verifica o pacote sem publicá-lo.

As versões são publicadas pelo workflow **Publish npm**, acionado manualmente com uma tag existente, como `v0.1.1`. Ele confere a tag contra a versão do `package.json`, executa os testes e publica com [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) via OIDC, sem token npm salvo no repositório.

Consulte a [documentação da API aut2fa](https://doc.aut2fa.com). Licença [MIT](LICENSE).
