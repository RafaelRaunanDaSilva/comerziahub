# 🧩 Stack & Plataformas — ComerziaHub

> Documento vivo: **atualizado conforme o projeto evolui**. Veja o
> [Histórico de atualizações](#-histórico-de-atualizações) no fim.
>
> **Última atualização:** 2026-09-26

Plataforma de **estoque + delivery + marketplace + rede social comercial**.

---

## 🛠️ Stack (código)

| Camada | Tecnologia |
|--------|-----------|
| Framework (front + back) | **Next.js 15** — App Router, Server Components, Server Actions, Route Handlers |
| Linguagem | **TypeScript** |
| Estilização | **Tailwind CSS** (tema cibernético, claro/escuro com toggle) |
| ORM | **Prisma** (~40 modelos) |
| Autenticação | **Auth.js / NextAuth v5** — credenciais, papéis (RBAC), proteção via `middleware` |
| Segurança/validação | **bcryptjs** (hash de senha), **Zod** (validação) |
| UI/Ícones | **lucide-react**, **clsx**, **tailwind-merge**, **date-fns** |
| Mapas/Localização | **Leaflet + react-leaflet** (OpenStreetMap, sem API key) |
| Financeiro | módulo de lucro/prejuízo + simuladores (`lib/finance.ts`) |
| Produtos | venda por unidade **ou peso** (kg, g, L, un, caixa…) com preço de custo |

## 🗄️ Banco de dados — **PostgreSQL (Supabase)**

| Ambiente | Onde | Detalhe |
|----------|------|---------|
| Local + Produção | **Supabase** (São Paulo, `sa-east-1`) | mesmo banco nos dois; app usa a string *pooled* (6543, pgbouncer) e migrations a direta (5432) |

> Histórico: MySQL/XAMPP local + Aiven em produção até 2026-09-26 (Aiven ficava em Bengaluru — causa raiz do delay).

## ☁️ Plataformas / hospedagem

- **GitHub** — repositório e versionamento: `RafaelSigmaKK67/comerziahub`
- **Vercel** — deploy/hospedagem de produção (deploy automático a cada push no `main`) → **https://comerziahub.vercel.app**
- **Aiven** — banco MySQL de produção

## 🧰 Ferramentas de apoio

- **Node.js 22** (runtime) · **npm** (gerenciador de pacotes) · **Git**
- **Puppeteer + Chrome** — captura automática de screenshots (`scripts/screenshots.mjs`)
- Scripts utilitários: `scripts/sync-prod-db.mjs` (env na Vercel), `scripts/push-prod.mjs` (schema+seed no Aiven), `scripts/test-auth.mjs` (teste e2e), `scripts/screenshots.mjs`
- **Dump do banco**: `database/comerziahub.sql` (importável no XAMPP/phpMyAdmin)

## 🗂️ Arquitetura (pastas)

```
app/         # rotas e telas (público, auth, admin, dashboard, account, courier)
actions/     # Server Actions (auth, cart, orders, store, courier, account, social, messages, admin)
components/  # UI, layout, commerce, social, dashboard, auth, theme-toggle
lib/         # prisma, auth, rbac, utils, validations, delivery, cashback, loyalty, constants
services/    # consultas ao banco (catalog, social, orders, cart, store, stats, messages)
prisma/      # schema.prisma + seed.ts
styles/      # globals.css (tema)
middleware.ts# proteção de rotas por papel (RBAC)
```

## 🔐 Variáveis de ambiente principais

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | conexão MySQL (XAMPP local / Aiven em produção) |
| `AUTH_SECRET` | segredo do Auth.js |
| `AUTH_URL` / `NEXTAUTH_URL` | URL da aplicação |
| `NEXT_PUBLIC_APP_URL` | URL pública |

## ▶️ Scripts npm úteis

```bash
npm run dev          # desenvolvimento (localhost:3000)
npm run build        # build de produção (prisma generate + next build)
npm run db:push      # aplica o schema no banco
npm run db:seed      # popula dados de exemplo
npm run db:studio    # Prisma Studio
```

## ✅ Estado atual

Funcionando **local (XAMPP)** e **produção (Vercel + Aiven)**: cadastro/login, marketplace,
loja/produto, carrinho/checkout, pedidos, painéis (admin/loja/cliente/entregador),
feed social, mensagens, cashback e fidelidade. Tema cibernético com alternância claro/escuro.

---

## 📜 Histórico de atualizações

- **2026-10-10** — **Simulação de uso real** (`npm run db:simulate`, `prisma/simulate.ts`): bots em todos os cargos povoaram o Supabase — 10 lojas novas (padaria, pet, farmácia, açougue, eletrônicos, livraria, floricultura, hamburgueria, gelateria, beleza) com 57 produtos, 40 clientes, 10 vendedores, 8 entregadores, 2 moderadores; 180 pedidos nos últimos 60 dias (entrega/retirada, Pix/cartão/dinheiro, status realistas, baixa de estoque, lucro via `lib/finance`, cashback e fidelidade), 110 avaliações (médias recalculadas), 71 posts com 611 curtidas e 107 comentários, conversas e cupons. Fotos por palavra-chave via **Openverse** (CC, sem chave), cada URL verificada e cacheada. Totais: 78 usuários, 13 lojas, 69 produtos, 182 pedidos, 126 entregas. Idempotente (bots `@bots.comerziahub.com`, senha `senha123`).

- **2026-09-26** — **Migração de banco: Aiven/MySQL (Bengaluru) → Supabase/PostgreSQL (São Paulo)** + função Vercel movida para `gru1` via `vercel.json`. Motivo: o Aiven ficava na Índia e cada ida ao banco custava ~200ms (páginas de 1,7–6s). Resultado medido em produção: **TTFB 0,11–0,21s em todas as rotas**. Mudanças: `provider postgresql` + `directUrl` no schema; busca com `mode: "insensitive"` (Postgres diferencia maiúsculas); `DATABASE_URL` (pooled/pgbouncer) + `DIRECT_URL` na Vercel; login validado ponta a ponta. XAMPP/MySQL local aposentado (o local usa o mesmo Supabase); `database/comerziahub.sql` virou legado.
- **2026-09-20** — **Fix do delay em produção**: cache em memória TTL 60s (`lib/memo-cache.ts`) nas leituras públicas do catálogo + relações independentes em `Promise.all` em `getStoreBySlug`/`getProductById` (8 → ~4/3 round-trips). Navegação quente caiu de 0,9–1,9s para ~0,25s ainda no Aiven.

- **2026-07-06** — **Desempenho p/ PCs fracos + sobreposição nos cards**: removido `backdrop-filter: blur(14px)` de todos os cards/painéis do tema escuro (painéis quase opacos dão o mesmo visual) e o `background-attachment: fixed` do fundo (repintava a tela a cada rolagem); headers fixos e bottom-nav sem `backdrop-blur`; suporte a `prefers-reduced-motion`; `decoding="async"` nas imagens. Fix no `StoreCard`: fileira do logo com `relative z-10` — o logo pinta por cima do banner (antes o banner posicionado cobria a metade de cima do logo). Git do repo configurado com `http.version HTTP/1.1` + low-speed abort (pushes travavam silenciosamente).
- **2026-07-05** — **Admin em modais + fotos reais**: edição/criação no admin agora abre em **modal sobreposto com fundo desfocado** (`EditDialog`, portal + `role="dialog"`, fecha com Esc/clique fora/após salvar); botões `Editar/Suspender/Excluir` padronizados na mesma linha. Admin também **cria lojas** (com dono), **produtos** (com loja/categoria/unidade) e **publicações oficiais na rede social** (criar/editar/excluir). Fotos do seed trocadas de picsum aleatório para **URLs curadas do Unsplash que correspondem ao nome** (banana→banana, boné→boné…), aplicadas no XAMPP e no Aiven; galeria do produto usa `object-contain` (foto inteira, sem corte).
- **2026-07-05** — **Admin "REI" (CRUD total)**: o administrador agora cria/edita/exclui **tudo** — usuários (criar com papel/senha, editar nome/e-mail/papel, trocar senha, suspender/excluir), lojas (editar nome/segmento/status/aberta, aprovar/suspender/excluir), **produtos** (nova tela `/admin/products`: preço, promoção, custo, estoque, status, destaque, excluir), **categorias** (nova tela `/admin/categories`: criar/renomear/excluir com desvínculo automático), pedidos (alterar qualquer status, com carimbo de data e histórico) e planos (criar/editar/excluir). Ações protegidas por `requireAdmin`; exclusões com fallback seguro (suspende/pausa/desativa quando há vínculos). Testado ao vivo: editar preço, criar/excluir categoria e usuário, mudar status de pedido.
- **2026-07-05** — **Acessibilidade (WCAG AA)** — fecha o último item do relatório E2E: link "Pular para o conteúdo", anel de foco global (`:focus-visible`), `aria-label` nas buscas/nos botões −/+ de quantidade/nas 6 `<nav>`, labels associados (`htmlFor`/`id`) nos filtros do marketplace, hierarquia de títulos do rodapé (h4→h2), contraste dos CTAs/badges laranja (accent-500→700, 5,2:1) e `<h1>` no carrinho deslogado. **Auditoria axe-core: 0 violações** em home, marketplace, produto, login, loja, feed e carrinho.
- **2026-07-05** — **PWA**: `app/manifest.ts` (manifest.webmanifest) + ícones `public/icon-192/512/512-maskable.png` gerados de `app/icon.svg` via `scripts/gen-icons.mjs` (puppeteer-core + Chrome do sistema) + apple-touch-icon — resolve o único ⚠ do relatório E2E do browser-use. Validações que o relatório não cobriu, feitas localmente (XAMPP): **responsivo** 375×812 e 1920×1080 sem overflow (bottom nav, filtros empilhados, mapa ok no mobile) e **checkout completo** (login → carrinho → pedido `CMZ-TJTBA5`): split por loja, baixa de estoque decimal (80 → 79,9 kg), cashback e snapshot financeiro exatos (lucro R$ 0,09 conferido à mão).
- **2026-06-06** — Correção de produção: páginas **Início**, **Loja** e **Feed** retornavam 500 porque a `SmartImage` (Client Component) recebia o ícone de fallback como **componente/função** vindo de Server Components (proibido no Next.js). Agora a `SmartImage` recebe `iconName` (string serializável) e mapeia o ícone internamente. Verificado: build OK e páginas voltando **200**.
- **2026-05-31** — Evolução: **produtos por unidade/peso** (kg/g/L/un…) com preço de custo; **módulo financeiro** (lucro/prejuízo + simuladores de preço, pagamento e venda); **mapas** (Leaflet/OpenStreetMap) na loja; **imagens com fallback**; admin CMS (configurações + excluir/aprovar/suspender lojas e usuários); **paginação** no marketplace; correção de sobreposição de UI; "funcionário" → **vendedor** + hierarquia ADMIN›LOJA›VENDEDOR›ENTREGADOR›CLIENTE; **dump SQL** em `database/`.
- **2026-05-31** — Tema cibernético + alternância claro/escuro (localStorage); página de **Mensagens** (comprador × vendedor); **produção no ar** (Vercel + Aiven MySQL) com cadastro/login validados; correção de compatibilidade MySQL 8 (PK em `VerificationToken`); seed enriquecido (cupons, emblemas, cashback, conversa); 26 screenshots reais.
- **2026-05-30** — Criação do projeto: Next.js 15 + Prisma + Auth.js + Tailwind; schema com ~40 modelos; painéis e telas principais; seed inicial; repositório no GitHub + deploy inicial na Vercel; migração de PostgreSQL para **MySQL/MariaDB** (XAMPP).

> Ao adicionar/trocar tecnologias, bancos, integrações ou módulos, **registre aqui** uma nova entrada com a data.
