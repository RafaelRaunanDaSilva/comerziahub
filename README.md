# 🛍️ ComerziaHub

**Plataforma completa de estoque, delivery, marketplace e rede social comercial** — para lojas, vendedores, compradores e entregadores.

ComerziaHub reúne, em um só sistema, um **controle de estoque**, um **aplicativo de delivery**, um **marketplace multi-lojas**, um **painel administrativo**, uma **rede social comercial**, além de **cashback**, **fidelidade** e **acompanhamento de pedidos**.

> ⚠️ Projeto de referência / base real de um sistema completo. Vários módulos já são funcionais ponta a ponta; outros têm o modelo de dados e a estrutura prontos, com a UI completa no roadmap. Veja [Status das funcionalidades](#-status-das-funcionalidades).

---

## 📚 Sumário

- [Tecnologias](#-tecnologias)
- [Perfis de usuários](#-perfis-de-usuários)
- [Status das funcionalidades](#-status-das-funcionalidades)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Como rodar localmente](#-como-rodar-localmente)
- [Banco de dados, migrations e seed](#-banco-de-dados-migrations-e-seed)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Deploy na Vercel](#-deploy-na-vercel)
- [Credenciais de teste](#-credenciais-de-teste)
- [Roadmap](#-roadmap)

---

## 🚀 Tecnologias

- **[Next.js 15](https://nextjs.org/)** (App Router) — frontend + backend (Server Components, Server Actions, Route Handlers)
- **TypeScript**
- **[Prisma ORM](https://www.prisma.io/)** + **PostgreSQL** ([Supabase](https://supabase.com), região São Paulo — o mesmo banco serve o local e a produção)
- **[Auth.js / NextAuth v5](https://authjs.dev/)** — autenticação por credenciais com papéis (RBAC) e proteção de rotas via middleware
- **[Tailwind CSS](https://tailwindcss.com/)** — identidade visual própria, responsiva
- **[Zod](https://zod.dev/)** — validação de dados
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** — hash de senhas
- **[lucide-react](https://lucide.dev/)** — ícones
- Arquitetura organizada em módulos (`app`, `components`, `lib`, `services`, `actions`, `types`, `prisma`).

---

## 👥 Perfis de usuários

Cada papel tem permissões e painel próprios (protegidos por middleware):

Hierarquia: **ADMIN GERAL › DONO DE LOJA › VENDEDOR › ENTREGADOR › CLIENTE.**

| Papel | Acesso | Painel |
|------|--------|--------|
| **Administrador** (`ADMIN`) | Controla toda a plataforma | `/admin` |
| **Moderador** (`MODERATOR`) | Rede social / denúncias | `/admin/social` |
| **Dono de loja** (`STORE_OWNER`) | Sua loja, produtos, vendedores, pedidos, financeiro, cashback, fidelidade | `/dashboard` |
| **Vendedor** (`SELLER`) | Vendas, pedidos, produtos e estoque da loja (sem config/financeiro) | `/dashboard` |
| **Cliente** (`CUSTOMER`) | Compras, pedidos, cashback, fidelidade, mensagens, social | `/account` |
| **Entregador** (`COURIER`) | Entregas, status, localização, ganhos | `/courier` |

> *(O papel legado `STORE_EMPLOYEE` é tratado como **Vendedor**.)*

---

## ✅ Status das funcionalidades

### Funcionais (ponta a ponta)
- **Autenticação**: cadastro, login, logout, recuperação de senha (geração de token), proteção de rotas por papel, redirecionamento por perfil.
- **Marketplace**: home com destaques, busca, filtros (categoria, preço, ordenação), página pública de loja, página de produto (promoção, variações, avaliações).
- **Carrinho & checkout**: adicionar/alterar/remover itens, entrega ou retirada, seleção de endereço, método de pagamento, divisão automática por loja.
- **Pedidos**: criação, baixa de estoque, histórico de status, página pública de acompanhamento com timeline.
- **Painel da loja**: visão geral, onboarding de criação de loja, funil de pedidos (aceitar → preparar → pronto → entrega → concluir), cadastro/listagem de produtos, estoque, clientes, configuração de cashback, configurações de entrega/horário.
- **Painel admin**: dashboard com métricas, aprovação/suspensão de lojas, gestão de usuários, pedidos, planos, financeiro, denúncias, moderação de publicações.
- **Área do cliente**: visão geral, pedidos, endereços (cadastro), saldo de cashback, fidelidade/emblemas, favoritos, lojas seguidas.
- **Painel do entregador**: status online/offline, entregas disponíveis, aceite e avanço de entrega (coletei/entreguei), ganhos.
- **Rede social**: feed, publicações (texto/produto/promoção), curtidas, seguir lojas.
- **Cashback & fidelidade**: regras por loja, cashback gerado automaticamente no pedido, carteira por loja, níveis (Bronze→VIP) calculados por compras/gasto.
- **Produtos por unidade ou peso**: unidade de medida configurável (un, kg, g, L, ml, pacote, caixa, dúzia…), quantidade mínima e incremento; carrinho/checkout/estoque/pedidos exibem corretamente (ex.: 0,5 kg).
- **Financeiro do lojista**: painel de lucro/prejuízo (faturamento × custos × comissão × taxas × cashback), margem, ticket, lucro por produto e por pedido — usando preço de **custo**.
- **Simuladores**: preço de venda com margem (mostra lucro/prejuízo), comparação entre formas de pagamento (quanto você recebe e prazos) e simulador de venda (frete + desconto + cupom + cashback).
- **Mapas/Localização**: mapa da loja e área de entrega com **Leaflet + OpenStreetMap** (sem API key); distância e tempo estimado por Haversine.
- **Admin (CMS)**: configurações da plataforma (PlatformSetting), aprovar/suspender/excluir lojas e usuários, taxas por forma de pagamento.
- **Mensagens**: chat comprador × vendedor funcional.
- **Imagens com fallback**: placeholder elegante para URLs vazias/quebradas em produtos, lojas, banners e publicações.

### Estrutura pronta (modelo de dados + UI base, completar no roadmap)
- Upload real de imagens (hoje por URL), comentários aninhados, amizades/conexões, denúncias com fluxo completo, criação de cupons via UI, editor visual de níveis de fidelidade e integração com gateway de pagamento.

---

## 🗂️ Estrutura de pastas

```
.
├── app/                      # Rotas (App Router)
│   ├── (public)/             # Site público: home, marketplace, loja, produto, carrinho, checkout, feed, pedido
│   ├── (auth)/               # Login, cadastro, recuperação de senha
│   ├── admin/                # Painel do administrador
│   ├── dashboard/            # Painel da loja
│   ├── account/              # Área do cliente
│   ├── courier/              # Painel do entregador
│   └── api/auth/             # Route handler do Auth.js
├── actions/                  # Server Actions (auth, cart, orders, store, courier, account, social, admin)
├── components/               # UI, layout, commerce, social, dashboard, auth
├── lib/                      # prisma, auth, rbac, utils, validations, delivery, cashback, loyalty, constants
├── services/                 # Consultas ao banco (catalog, social, orders, cart, store, stats)
├── prisma/                   # schema.prisma + seed.ts
├── styles/                   # globals.css
├── types/                    # tipos compartilhados + augmentation do next-auth
└── middleware.ts             # Proteção de rotas por papel (Edge)
```

---

## 💻 Como rodar localmente

### Pré-requisitos
- **Node.js 18.18+** (recomendado 20 ou 22)
- Um projeto **[Supabase](https://supabase.com)** gratuito (PostgreSQL) — crie na região **South America (São Paulo)**. Não precisa instalar banco na máquina.

### Passos

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
#   edite .env e preencha DATABASE_URL e AUTH_SECRET
#   gere um segredo: npx auth secret   (ou)  openssl rand -base64 32

# 3. Crie as tabelas no banco
npm run db:push          # rápido (sem histórico de migrations)
#   ou, para gerar migrations versionadas:
npm run db:migrate

# 4. Popule com dados de exemplo
npm run db:seed

# 5. Rode em desenvolvimento
npm run dev
```

Acesse **http://localhost:3000**.

### Banco (Supabase / PostgreSQL)

1. Crie um projeto em https://supabase.com (região **South America — São Paulo**) e guarde a senha do banco.
2. No Dashboard: **Connect → aba ORMs (Prisma)** — copie as duas strings para o `.env`:
   - `DATABASE_URL` = *Transaction pooler* (porta **6543**) com `&pgbouncer=true` no final;
   - `DIRECT_URL` = conexão direta (porta **5432**).
   Se a senha tiver caracteres especiais, codifique-a na URL (ex.: `@` vira `%40`).
3. `npm run db:push` cria as tabelas e `npm run db:seed` popula os dados de exemplo —
   visíveis depois no **Table Editor** do Supabase.

> Legado: `database/comerziahub.sql` é o dump da época do MySQL/XAMPP — não é
> compatível com PostgreSQL; ficou no repositório apenas como histórico.

---

## 🗄️ Banco de dados, migrations e seed

| Comando | Descrição |
|---------|-----------|
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:push` | Sincroniza o schema com o banco (sem migrations) |
| `npm run db:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run db:deploy` | Aplica migrations em produção |
| `npm run db:seed` | Popula dados fictícios (usuários, lojas, produtos, pedidos, posts) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:reset` | **Apaga** e recria o banco + seed |

O **schema** (`prisma/schema.prisma`) cobre ~40 modelos: usuários, perfis, permissões, lojas, vendedores, produtos, categorias, variações, estoque/movimentações, carrinho, pedidos, itens, pagamentos, entregas, entregadores, endereços, avaliações, cashback (regras/transações/carteira), fidelidade (níveis/status/emblemas), cupons, publicações, comentários, curtidas, seguidores, amizades, mensagens, notificações, denúncias, planos, assinaturas e configurações.

---

## 🔐 Variáveis de ambiente

Copie `.env.example` para `.env`. Principais:

| Variável | Obrigatória | Descrição |
|----------|:----------:|-----------|
| `DATABASE_URL` | ✅ | Conexão PostgreSQL **pooled** do Supabase (porta 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | ✅ | Conexão PostgreSQL **direta** do Supabase (porta 5432) — usada por `db:push`/migrations |
| `AUTH_SECRET` | ✅ | Segredo do Auth.js (`npx auth secret`) |
| `AUTH_URL` / `NEXTAUTH_URL` | ⚠️ | URL pública (produção) |
| `NEXT_PUBLIC_APP_URL` | — | URL pública do app |
| `NEXT_PUBLIC_MAPS_*` | — | Integração futura com mapas |
| `UPLOAD_PROVIDER` | — | Provedor de upload (futuro) |
| `PAYMENT_PROVIDER` | — | Gateway de pagamento (futuro) |

> O app é resiliente: as páginas públicas renderizam mesmo sem banco configurado (mostram estados vazios), permitindo um primeiro deploy antes de conectar o banco.

---

## ▲ Deploy na Vercel

1. **Importe o repositório** do GitHub na Vercel (framework detectado automaticamente: Next.js).
2. **Banco de dados**: use o mesmo projeto **Supabase** do desenvolvimento (região São Paulo — o `vercel.json` já fixa a função em `gru1`, ao lado do banco).
3. **Variáveis de ambiente** no projeto da Vercel:
   - `DATABASE_URL` = string *pooled* do Supabase (porta 6543, `?pgbouncer=true`)
   - `DIRECT_URL` = string direta do Supabase (porta 5432)
   - `AUTH_SECRET` = segredo aleatório
   - `AUTH_URL` / `NEXTAUTH_URL` = URL do deploy (ex.: `https://comerziahub-woad.vercel.app`)
4. **Build**: o comando padrão (`prisma generate && next build`) já está em `package.json`.
5. Schema e seed são aplicados uma vez, do seu computador: `npm run db:push` e `npm run db:seed` (o `.env` já aponta para o Supabase).

---

## 🧪 Credenciais de teste

Disponíveis após rodar `npm run db:seed`. **Senha de todas:** `senha123`

| Perfil | E-mail |
|--------|--------|
| Administrador | `admin@comerziahub.com` |
| Moderador | `moderador@comerziahub.com` |
| Dono de loja | `loja@comerziahub.com` |
| Dono de loja | `loja2@comerziahub.com` |
| Vendedor | `vendedor@comerziahub.com` |
| Cliente | `cliente@comerziahub.com` |
| Cliente | `cliente2@comerziahub.com` |
| Entregador | `entregador@comerziahub.com` |

---

## 🛣️ Roadmap

- [ ] Upload real de imagens (Vercel Blob / S3 / Cloudinary)
- [ ] Integração com gateway de pagamento (Pix, cartão) — Stripe / Mercado Pago
- [ ] Mapa em tempo real para rastreio de entrega (Google Maps / Mapbox)
- [ ] Mensagens privadas em tempo real e notificações push
- [ ] Comentários aninhados, compartilhamentos e conexões/amizades
- [ ] Fluxo completo de denúncias e bloqueio de usuários
- [ ] Editor visual de níveis de fidelidade e campanhas de cupom
- [ ] OAuth (Google/Apple) — modelos do adapter já incluídos
- [ ] Relatórios financeiros avançados e exportação
- [ ] Testes automatizados (unit/e2e) e ESLint configurado
- [ ] App mobile (React Native) consumindo a mesma base

---

## 📄 Licença

Projeto de demonstração / base de referência. Use livremente como ponto de partida.

Feito com Next.js, Prisma e Tailwind CSS. 💜
