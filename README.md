# aut2fa-node

Cliente Node.js para enviar, consultar e verificar códigos 2FA pela API aut2fa. Requer Node.js 20 ou superior, inclui tipos TypeScript e usa o `fetch` nativo, sem dependências de execução.

## Instalar pelo GitHub

A versão `0.1.0` é distribuída pelo repositório. Instale a tag:

```sh
npm install git+https://github.com/jhowbhz/aut2fa-node.git#v0.1.0
```

A publicação como `@aut2fa/node` no npm depende da criação da conta e do acesso ao escopo `@aut2fa`. Depois da publicação, a instalação será `npm install @aut2fa/node`.

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

Para a primeira publicação, crie a conta no [npm](https://www.npmjs.com/signup), obtenha acesso ao escopo `@aut2fa`, execute `npm login` e publique com `npm publish --access public`. Faça a autenticação e o segundo fator diretamente no npm.

Depois, configure um [Trusted Publisher](https://docs.npmjs.com/trusted-publishers/) com usuário GitHub `jhowbhz`, repositório `aut2fa-node`, arquivo `publish.yml` e permissão para `npm publish`. O workflow **Publish npm**, acionado manualmente com a tag, confere a versão, executa os testes e publica usando OIDC.

Consulte a [documentação da API aut2fa](https://doc.aut2fa.com). Licença [MIT](LICENSE).
