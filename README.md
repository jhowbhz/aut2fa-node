<p align="center">
  <a href="https://aut2fa.com">
    <img src="https://raw.githubusercontent.com/jhowbhz/aut2fa-node/main/.github/assets/banner.png" alt="aut2fa para Node.js: você envia o código, a gente entrega por WhatsApp, SMS, Telegram e e-mail" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aut2fa/node"><img src="https://img.shields.io/npm/v/@aut2fa/node?color=00cfc5&label=npm" alt="Versão no npm"></a>
  <a href="https://www.npmjs.com/package/@aut2fa/node"><img src="https://img.shields.io/npm/dm/@aut2fa/node?color=00cfc5" alt="Downloads por mês"></a>
  <a href="https://github.com/jhowbhz/aut2fa-node/actions/workflows/ci.yml"><img src="https://github.com/jhowbhz/aut2fa-node/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/dependências-0-00cfc5" alt="Zero dependências">
  <img src="https://img.shields.io/badge/TypeScript-incluso-3178c6?logo=typescript&logoColor=white" alt="Tipos TypeScript inclusos">
  <img src="https://img.shields.io/node/v/@aut2fa/node?color=339933&logo=node.js&logoColor=white" alt="Versão do Node.js">
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@aut2fa/node?color=00cfc5" alt="Licença MIT"></a>
</p>

<p align="center">
  <b>Envie códigos 2FA por WhatsApp, SMS, Telegram e e-mail com uma chamada de API.</b><br>
  <a href="https://aut2fa.com">Site</a> ·
  <a href="https://doc.aut2fa.com">Documentação</a> ·
  <a href="https://aut2fa.com">Criar conta grátis</a> ·
  <a href="https://github.com/jhowbhz/aut2fa-node/issues">Reportar problema</a>
</p>

---

## Por que usar

- **Um endpoint, quatro canais.** Você chama `send`, e a aut2fa entrega por WhatsApp, SMS, Telegram ou e-mail.
- **Sem gerar nem guardar código.** A API pode gerar o código; você só chama `verify` com o que o usuário digitou.
- **Zero dependências.** Usa o `fetch` nativo do Node.js 20+. Nada extra no seu `node_modules`.
- **TypeScript de verdade.** Tipos inclusos para respostas, opções e erros.
- **Seguro por padrão.** Não segue redirecionamentos, não repete requisições sozinho e nunca expõe a chave em mensagens de erro.
- **Modo de teste.** Com uma chave `ak_test_…` e o código `000000`, você integra sem enviar mensagens reais.

## Instalar

```sh
npm install @aut2fa/node
```

Também funciona com `pnpm add @aut2fa/node` e `yarn add @aut2fa/node`.

## Começar em 30 segundos

```javascript
import { Aut2fa } from "@aut2fa/node";

const client = new Aut2fa(process.env.AUT2FA_API_KEY);

// 1. Envia o código para o usuário
const send = await client.send({ to: "+5531999999999" });

// 2. Confere o código que o usuário digitou
const result = await client.verify(send.id, { code: "000000" });

if (result.valid) {
  console.log("Login liberado");
}
```

Crie sua conta em [aut2fa.com](https://aut2fa.com) para pegar a chave da aplicação.

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

## Outras linguagens

| Linguagem | Pacote | Repositório |
| --- | --- | --- |
| Node.js | [`@aut2fa/node`](https://www.npmjs.com/package/@aut2fa/node) | [aut2fa-node](https://github.com/jhowbhz/aut2fa-node) |
| Python | [`aut2fa`](https://pypi.org/project/aut2fa/) | [aut2fa-python](https://github.com/jhowbhz/aut2fa-python) |
| Go | [`github.com/jhowbhz/aut2fa-go`](https://pkg.go.dev/github.com/jhowbhz/aut2fa-go) | [aut2fa-go](https://github.com/jhowbhz/aut2fa-go) |

## Contribuir

Encontrou um bug ou tem uma ideia? Abra uma [issue](https://github.com/jhowbhz/aut2fa-node/issues) ou envie um pull request.

Se este SDK te ajudou, deixe uma ⭐ no repositório. Isso ajuda outros devs a encontrá-lo.

---

<p align="center">
  <a href="https://doc.aut2fa.com">Documentação da API</a> · Licença <a href="LICENSE">MIT</a> · Feito pela <a href="https://aut2fa.com">aut2fa</a>
</p>
