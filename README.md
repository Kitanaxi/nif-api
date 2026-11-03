# Angola NIF API

API simples para consultar dados de **NIF** no Portal do Contribuinte de Angola (AGT).

A API usa **Puppeteer** para automatizar a consulta pública disponível em:
https://portaldocontribuinte.minfin.gov.ao/consultar-nif-do-contribuinte

## Funcionalidades

- Consulta de NIF no Portal do Contribuinte
- Retry automático (3 tentativas, 2 segundos entre cada uma)
- Cache em memória de 5 minutos
- Limite de pedidos por IP (30 pedidos a cada 15 minutos)
- Resposta em JSON
- CORS restrito a `localhost` e `127.0.0.1` (ou às origens definidas em `CORS_ORIGINS`)

## Requisitos

- Node.js 22.17 ou superior (exigido pelo `@sparticuz/chromium`; está definido em `engines` no `package.json`)
- npm
- Espaço para o Chromium que o Puppeteer descarrega na instalação

## Instalação

```bash
npm install
```

## Como executar

Modo de desenvolvimento (TypeScript direto, com `tsx`):

```bash
npm run dev
```

Modo de produção (compila para `dist/` e arranca):

```bash
npm start
```

O `npm start` executa primeiro `npm run build` (através do `prestart`).

Para compilar sem arrancar:

```bash
npm run build
```

No Windows, para abrir o servidor numa janela de consola própria:

```bash
npm run start:background
```

Quando o servidor arranca, mostra:

```
API running on http://localhost:3000
```

### Variáveis de ambiente

| Variável | Predefinição | Descrição                     |
|----------|--------------|-------------------------------|
| `PORT`   | `3000`       | Porta em que o servidor escuta |
| `CORS_ORIGINS` | `http://localhost,http://localhost:3000,http://127.0.0.1,http://127.0.0.1:3000` | Origens permitidas para pedidos feitos a partir de browsers, separadas por vírgulas (ex.: `https://meu-site.ao,https://app.meu-site.ao`). Se definida, substitui a lista predefinida. |

### Deploy no Render

A pasta `dist/` não está no repositório (o `.gitignore` exclui `dist/` e `*.js`), por isso o Render tem de compilar o projeto antes de arrancar. Sem esse passo, aparece o erro `Cannot find module '.../dist/index.js'`.

Configuração no Render:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

Defina também as variáveis de ambiente (`PORT` é opcional, `CORS_ORIGINS` conforme necessário) em **Environment**.

Defina `NODE_ENV=production` (já está no `render.yaml`). É esta variável que faz a API usar o `@sparticuz/chromium` em vez do Chrome local do Puppeteer.

#### Problemas resolvidos no deploy

**1. `chromium.executablePath is not a function`**

Todas as consultas falhavam com esta resposta:

```json
{
  "success": false,
  "message": "NIF not found or portal unavailable",
  "error": "chromium.executablePath is not a function"
}
```

Causas:

- A partir da versão 153, o `@sparticuz/chromium` só é distribuído como módulo ESM. Como este projeto compila para CommonJS e o carrega com `require()`, as funções do pacote ficam dentro de `.default`. Por isso, `chromium.executablePath` era `undefined`.
- O `puppeteer-core@21` era demasiado antigo para o Chromium 153.
- O `@sparticuz/chromium` deixou de ter `chromium.headless` e `chromium.defaultViewport`, e passou a pedir `headless: "shell"`.

Solução (em `src/services/nifService.ts` e `package.json`):

```ts
const chromium = require("@sparticuz/chromium").default;
browser = await puppeteer.launch({
  args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
  executablePath: await chromium.executablePath(),
  headless: "shell",
});
```

- `puppeteer-core` atualizado para `^25.16.0`, a mesma versão do `puppeteer` usado localmente.
- `"engines": { "node": ">=22.17.0" }` no `package.json`, para o Render usar uma versão de Node compatível com o `@sparticuz/chromium`.

Ao atualizar o `@sparticuz/chromium` ou o `puppeteer-core`, mantenha as duas versões compatíveis. A versão principal do `@sparticuz/chromium` corresponde à versão do Chromium. Para saber que Chromium cada versão do Puppeteer suporta, veja https://pptr.dev/chromium-support.

**2. `ERR_ERL_PERMISSIVE_TRUST_PROXY`**

O log do Render mostrava:

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.
```

Com `app.set("trust proxy", true)`, o Express confia em qualquer valor do cabeçalho `X-Forwarded-For`. Assim, qualquer pessoa podia inventar um IP e fugir ao limite de pedidos. O `express-rate-limit` deteta esta configuração e mostra o erro.

Solução (em `index.ts`): confiar apenas no primeiro proxy, que no Render é o balanceador de carga.

```ts
app.set("trust proxy", 1);
```

Depois destas alterações, faça no Render **Manual Deploy → Clear build cache & deploy** para reinstalar as dependências do zero.

## Como usar

### Consultar um NIF

```bash
POST /query
Content-Type: application/json

{
  "nif": "003519344HA042"
}
```

Exemplo com `curl`:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"nif": "003519344HA042"}'
```

O campo `nif` é obrigatório e tem de ser uma string. A API faz `trim()` e converte para maiúsculas antes de consultar, por isso `" 003519344ha042 "` e `"003519344HA042"` são tratados como o mesmo NIF.

### Resposta de sucesso

```json
{
  "success": true,
  "data": {
    "nif": "003519344HA042",
    "name": "NOME DO CONTRIBUINTE",
    "type": "SINGULAR",
    "status": "Activo",
    "vatRegime": "Sem actividade em IVA",
    "taxResidence": "Residente Fiscal"
  },
  "cached": false
}
```

O campo `cached` indica se o resultado veio da cache (`true`) ou de uma consulta nova ao portal (`false`).

### Respostas de erro

| Código | Quando acontece | Corpo |
|--------|-----------------|-------|
| `400`  | O campo `nif` não existe ou não é texto | `{ "success": false, "message": "The 'nif' field is required" }` |
| `404`  | O portal não devolveu dados para o NIF, ou o portal falhou nas 3 tentativas | `{ "success": false, "message": "NIF not found or portal unavailable", "error": "..." }` |
| `429`  | O IP excedeu 30 pedidos em 15 minutos | `{ "success": false, "message": "Too many requests from this IP, please try again later" }` |

### Verificar se a API está online

```bash
GET /
```

Resposta:

```json
{
  "status": "online",
  "message": "NIF/BI Query API - Angola",
  "endpoint": "POST /query",
  "example": { "nif": "003519344HA042" },
  "cacheTTL": "5 minutes",
  "maxRetries": 3
}
```

## Como funciona

Cada pedido a `POST /query` passa pelos seguintes passos:

1. **CORS** (`src/middleware/cors.ts`): só aceita pedidos de origens `localhost` e `127.0.0.1`, nas portas 80 ou 3000, ou as origens indicadas em `CORS_ORIGINS`. Esta restrição aplica-se a pedidos feitos a partir de browsers; pedidos feitos com `curl` ou a partir de servidores não são afetados.
2. **Rate limit** (`src/middleware/rateLimit.ts`): aplicado apenas a `/query`, com limite de 30 pedidos por IP em janelas de 15 minutos.
3. **Validação**: se `nif` não existir ou não for texto, responde com `400`.
4. **Cache** (`src/services/cache.ts`): se o NIF (já normalizado) foi consultado nos últimos 5 minutos, devolve o resultado guardado e não abre o navegador.
5. **Consulta** (`src/services/nifService.ts`): abre um Chromium em modo headless com Puppeteer, acede ao portal, preenche o campo do NIF, clica em "Pesquisar" e lê os dados da página. Imagens, CSS, fontes e vídeos são bloqueados para acelerar a consulta. O navegador fecha-se sempre no fim, mesmo em caso de erro.
6. **Retry** (`src/services/retry.ts`): se a consulta falhar, tenta de novo até 3 vezes, com 2 segundos de espera entre tentativas.
7. **Resposta**: em caso de sucesso, guarda o resultado na cache e devolve-o. Se as 3 tentativas falharem, responde com `404`.

A cache vive na memória do processo. Se o servidor reiniciar, a cache fica vazia. Com várias instâncias da API, cada uma tem a sua própria cache.

## Estrutura do projeto

```
nif-api/
├── src/
│   ├── types/
│   │   └── index.ts          # Interface NifData
│   ├── services/
│   │   ├── cache.ts          # Funções de cache (getFromCache, saveToCache)
│   │   ├── retry.ts          # Função de retry
│   │   └── nifService.ts     # Consulta NIF no Portal do Contribuinte
│   ├── middleware/
│   │   ├── cors.ts           # Configuração CORS
│   │   └── rateLimit.ts      # Rate limiting
│   └── routes/
│       └── index.ts          # Rotas (POST /query e GET /)
├── index.ts                  # Ponto de entrada (configuração do Express)
└── tsconfig.json             # Compila index.ts e src/**/*.ts para dist/
```

## Aviso

Esta API utiliza scraping de um serviço público. Use com responsabilidade e respeite os termos de uso do Portal do Contribuinte.
