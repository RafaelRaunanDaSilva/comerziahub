/**
 * Simulação de uso real — "bots" em todos os cargos povoando a plataforma:
 * lojistas abrem lojas e cadastram produtos, vendedores entram nas equipes,
 * clientes compram/avaliam/seguem/postam, entregadores entregam.
 *
 * Rode com: npm run db:simulate   (idempotente: não roda duas vezes)
 *
 * Fotos: busca por palavra-chave no Openverse (imagens CC, sem chave), cada
 * URL verificada (HEAD 200 image/*) e cacheada em node_modules/.cache.
 * Todos os bots usam e-mail @bots.comerziahub.com e senha "senha123".
 */
import { PrismaClient, type PaymentMethod, type OrderStatus, type MeasureUnit } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { calcOrderFinance } from "../lib/finance";

try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* usa o ambiente */ }

const prisma = new PrismaClient();
const BOT_DOMAIN = "bots.comerziahub.com";
const DIA = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- aleatório determinístico ----------
let seed = 20261010;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const chance = (p: number) => rnd() < p;
const diasAtras = (max: number, min = 0) => new Date(Date.now() - between(min, max) * DIA);

// ---------- fotos por palavra-chave (Openverse + cache + verificação) ----------
const CACHE = "node_modules/.cache/simulate-photos.json";
const fotos: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const FOTO_FALLBACK = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=800&fit=crop&q=70";

async function foto(keyword: string): Promise<string> {
  if (fotos[keyword]) return fotos[keyword];
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(keyword)}&license_type=commercial&page_size=5&mature=false`,
      { headers: { "User-Agent": "ComerziaHub-seed/1.0" } },
    );
    const data = (await res.json()) as { results?: { url: string }[] };
    for (const r of data.results ?? []) {
      const head = await fetch(r.url, { method: "HEAD", signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (head?.ok && (head.headers.get("content-type") ?? "").startsWith("image/")) {
        fotos[keyword] = r.url;
        break;
      }
    }
  } catch { /* fallback abaixo */ }
  fotos[keyword] ??= FOTO_FALLBACK;
  mkdirSync("node_modules/.cache", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(fotos, null, 2));
  await new Promise((r) => setTimeout(r, 350)); // respeita o rate limit anônimo
  return fotos[keyword];
}
const avatar = (nome: string) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(nome)}`;

// ---------- nomes ----------
const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Paulo", "Rafaela", "Samuel", "Tatiane", "Vinícius", "Beatriz", "Caio", "Daniela", "Everton", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Leandro", "Letícia", "Matheus", "Natália", "Otávio", "Priscila", "Renan", "Sabrina", "Thiago", "Valentina", "William"];
const SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Ferreira", "Rodrigues", "Almeida", "Nascimento", "Araújo", "Carvalho", "Gomes", "Martins", "Ribeiro", "Barbosa", "Moreira", "Schneider", "Weber"];
const RUAS = ["Rua das Flores", "Av. Brasil", "Rua XV de Novembro", "Rua Sete de Setembro", "Av. Getúlio Vargas", "Rua Duque de Caxias", "Rua Santos Dumont", "Rua Marechal Deodoro", "Av. Willy Barth", "Rua Tiradentes"];
const BAIRROS = ["Centro", "São Luiz", "Agostini", "Jardim Peperi", "Salete", "Progresso", "São Jorge", "Santa Rita"];

let nomeSeq = 0;
function nomeCompleto() {
  nomeSeq++;
  return `${NOMES[nomeSeq % NOMES.length]} ${pick(SOBRENOMES)}`;
}
function emailDe(nome: string) {
  return `${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".")}.${nomeSeq}@${BOT_DOMAIN}`;
}

// ---------- lojas e produtos simulados ----------
type Prod = { nome: string; kw: string; preco: number; unit?: MeasureUnit; step?: number; promo?: number; destaque?: boolean };
type Loja = { nome: string; segmento: string; categoria: string; kwLogo: string; kwBanner: string; descricao: string; produtos: Prod[] };

const LOJAS: Loja[] = [
  { nome: "Padaria Pão Quente", segmento: "Padaria", categoria: "padaria", kwLogo: "bread loaf", kwBanner: "bakery interior", descricao: "Pão quentinho a toda hora, bolos e café passado na hora.", produtos: [
    { nome: "Pão Francês", kw: "french bread roll", preco: 18.9, unit: "KG", step: 0.1, destaque: true },
    { nome: "Croissant Folhado", kw: "croissant", preco: 7.5 },
    { nome: "Bolo de Cenoura com Chocolate", kw: "carrot cake", preco: 32, promo: 27.9 },
    { nome: "Pão de Queijo", kw: "cheese bread", preco: 24.9, unit: "PACOTE" },
    { nome: "Sonho de Creme", kw: "cream doughnut", preco: 6.5 },
    { nome: "Café Coado 500ml", kw: "black coffee cup", preco: 5 },
  ] },
  { nome: "Pet Mania", segmento: "Pet Shop", categoria: "pet", kwLogo: "puppy dog", kwBanner: "pet shop store", descricao: "Tudo para o seu pet: ração, brinquedos e higiene com entrega.", produtos: [
    { nome: "Ração Premium para Cães 10kg", kw: "dog food", preco: 189.9, destaque: true },
    { nome: "Ração para Gatos 3kg", kw: "cat food", preco: 79.9 },
    { nome: "Brinquedo Mordedor", kw: "dog chew toy", preco: 24.9 },
    { nome: "Coleira Ajustável", kw: "dog collar", preco: 34.9 },
    { nome: "Areia Sanitária 4kg", kw: "cat litter", preco: 29.9 },
    { nome: "Shampoo Pet 500ml", kw: "pet shampoo", preco: 22.5 },
  ] },
  { nome: "Farmácia Vida", segmento: "Farmácia", categoria: "farmacia", kwLogo: "pharmacy", kwBanner: "pharmacy shelves", descricao: "Saúde e bem-estar com atendimento rápido e entrega na sua casa.", produtos: [
    { nome: "Vitamina C 1g (30 comp.)", kw: "vitamin c tablets", preco: 29.9, destaque: true },
    { nome: "Protetor Solar FPS 50", kw: "sunscreen bottle", preco: 54.9, promo: 44.9 },
    { nome: "Termômetro Digital", kw: "digital thermometer", preco: 19.9 },
    { nome: "Álcool em Gel 500ml", kw: "hand sanitizer gel", preco: 12.9 },
    { nome: "Hidratante Corporal 400ml", kw: "body lotion", preco: 27.9 },
    { nome: "Máscara Descartável (50 un.)", kw: "surgical masks box", preco: 24.9, unit: "CAIXA" },
  ] },
  { nome: "Açougue do Zé", segmento: "Mercado", categoria: "mercado", kwLogo: "butcher shop", kwBanner: "butcher meat counter", descricao: "Carnes frescas selecionadas, cortadas na hora.", produtos: [
    { nome: "Picanha Bovina", kw: "picanha beef", preco: 79.9, unit: "KG", step: 0.1, destaque: true },
    { nome: "Frango Inteiro", kw: "whole raw chicken", preco: 14.9, unit: "KG", step: 0.1 },
    { nome: "Linguiça Toscana", kw: "sausage raw", preco: 24.9, unit: "KG", step: 0.1 },
    { nome: "Costela Bovina", kw: "beef ribs raw", preco: 39.9, unit: "KG", step: 0.1, promo: 34.9 },
    { nome: "Carne Moída", kw: "ground beef", preco: 32.9, unit: "KG", step: 0.1 },
  ] },
  { nome: "TechPoint", segmento: "Eletrônicos", categoria: "eletronicos", kwLogo: "electronics gadgets", kwBanner: "electronics store", descricao: "Acessórios e gadgets com garantia e preço justo.", produtos: [
    { nome: "Fone Bluetooth TWS", kw: "wireless earbuds", preco: 149.9, promo: 119.9, destaque: true },
    { nome: "Carregador Rápido 20W", kw: "usb charger", preco: 59.9 },
    { nome: "Mouse Sem Fio", kw: "wireless mouse", preco: 69.9 },
    { nome: "Teclado Mecânico RGB", kw: "mechanical keyboard rgb", preco: 249.9 },
    { nome: "Smartwatch Fit", kw: "smartwatch", preco: 199.9, destaque: true },
    { nome: "Caixa de Som Bluetooth", kw: "bluetooth speaker", preco: 129.9 },
  ] },
  { nome: "Livraria Página Viva", segmento: "Livraria", categoria: "livraria", kwLogo: "books stack", kwBanner: "bookstore shelves", descricao: "Livros, papelaria e um cafezinho para acompanhar a leitura.", produtos: [
    { nome: "Romance: Noites de Verão", kw: "novel book cover", preco: 49.9 },
    { nome: "Caderno Universitário 200 fls", kw: "spiral notebook", preco: 24.9, destaque: true },
    { nome: "Caneta Gel (6 un.)", kw: "gel pens", preco: 18.9, unit: "PACOTE" },
    { nome: "Agenda 2027", kw: "planner agenda", preco: 39.9 },
    { nome: "Livro Infantil Ilustrado", kw: "children picture book", preco: 34.9, promo: 29.9 },
    { nome: "Marca-texto Pastel (4 un.)", kw: "highlighter pens", preco: 14.9, unit: "PACOTE" },
  ] },
  { nome: "Floricultura Jardim", segmento: "Floricultura", categoria: "floricultura", kwLogo: "flower shop", kwBanner: "florist flowers", descricao: "Flores frescas, arranjos e plantas para presentear ou decorar.", produtos: [
    { nome: "Buquê de Rosas Vermelhas", kw: "red roses bouquet", preco: 89.9, destaque: true },
    { nome: "Orquídea Phalaenopsis", kw: "phalaenopsis orchid", preco: 59.9 },
    { nome: "Suculenta em Vaso", kw: "succulent plant pot", preco: 19.9 },
    { nome: "Girassol (3 hastes)", kw: "sunflowers", preco: 29.9 },
    { nome: "Vaso de Cerâmica", kw: "ceramic plant pot", preco: 44.9 },
  ] },
  { nome: "Hamburgueria Brasa", segmento: "Restaurante", categoria: "restaurantes", kwLogo: "burger", kwBanner: "burger restaurant", descricao: "Smash burgers na brasa, batata rústica e milkshakes.", produtos: [
    { nome: "Smash Burger Duplo", kw: "smash burger", preco: 29.9, destaque: true },
    { nome: "Bacon Burger", kw: "bacon cheeseburger", preco: 32.9 },
    { nome: "Batata Rústica", kw: "rustic potato wedges", preco: 16.9 },
    { nome: "Milkshake de Chocolate", kw: "chocolate milkshake", preco: 18.9 },
    { nome: "Onion Rings", kw: "onion rings", preco: 14.9 },
    { nome: "Refrigerante 600ml", kw: "soda bottle", preco: 7.9 },
  ] },
  { nome: "Gelato Mio", segmento: "Restaurante", categoria: "restaurantes", kwLogo: "gelato ice cream", kwBanner: "ice cream shop", descricao: "Gelato artesanal, açaí e picolés de fruta de verdade.", produtos: [
    { nome: "Gelato de Pistache", kw: "pistachio gelato", preco: 16.9, destaque: true },
    { nome: "Açaí na Tigela 500ml", kw: "acai bowl", preco: 24.9 },
    { nome: "Picolé de Manga", kw: "mango popsicle", preco: 6.9 },
    { nome: "Milkshake de Morango", kw: "strawberry milkshake", preco: 17.9, promo: 14.9 },
    { nome: "Casquinha Baunilha", kw: "vanilla ice cream cone", preco: 8.9 },
  ] },
  { nome: "Beleza Pura", segmento: "Beleza", categoria: "beleza", kwLogo: "makeup cosmetics", kwBanner: "cosmetics store", descricao: "Maquiagem, perfumaria e cuidados com a pele.", produtos: [
    { nome: "Batom Matte Vermelho", kw: "red lipstick", preco: 34.9, destaque: true },
    { nome: "Perfume Floral 50ml", kw: "perfume bottle", preco: 159.9, promo: 129.9 },
    { nome: "Esmalte Nude", kw: "nail polish", preco: 9.9 },
    { nome: "Shampoo Hidratante 300ml", kw: "shampoo bottle", preco: 29.9 },
    { nome: "Base Líquida", kw: "liquid foundation makeup", preco: 49.9 },
    { nome: "Máscara de Cílios", kw: "mascara makeup", preco: 39.9 },
  ] },
];

const CATEGORIAS_NOVAS = [
  { name: "Padaria", slug: "padaria", icon: "🥖" },
  { name: "Pet Shop", slug: "pet", icon: "🐶" },
  { name: "Farmácia", slug: "farmacia", icon: "💊" },
  { name: "Livraria", slug: "livraria", icon: "📚" },
  { name: "Floricultura", slug: "floricultura", icon: "🌷" },
];

const TIERS = [
  { name: "Bronze", level: 1, minOrders: 0, minSpend: 0, color: "#b45309" },
  { name: "Prata", level: 2, minOrders: 5, minSpend: 250, color: "#64748b" },
  { name: "Ouro", level: 3, minOrders: 15, minSpend: 800, color: "#ca8a04" },
  { name: "Diamante", level: 4, minOrders: 30, minSpend: 2000, color: "#0891b2" },
  { name: "VIP", level: 5, minOrders: 60, minSpend: 5000, color: "#7c3aed" },
];

const POSTS_LOJA = [
  (p: string) => `🔥 Promoção da semana: ${p} com preço especial. Corre que é por tempo limitado!`,
  (p: string) => `Chegou novidade na loja: ${p}. Vem conferir! 🛍️`,
  (p: string) => `${p} está voando aqui! Garanta o seu com entrega rápida. 🚀`,
  (p: string) => `Dica do dia: ${p} + 5% de cashback na sua carteira. 💸`,
];
const POSTS_CLIENTE = [
  (l: string) => `Pedi na ${l} e chegou antes do previsto. Recomendo demais! ⭐⭐⭐⭐⭐`,
  (l: string) => `Primeira compra na ${l} e já virei cliente. Atendimento nota 10.`,
  (l: string) => `Alguém mais vicia nas coisas da ${l}? Não consigo parar de pedir 😅`,
  (l: string) => `Cashback da ${l} caiu certinho na carteira. Plataforma redondinha. 👏`,
];
const POSTS_ENTREGADOR = [
  "Mais um dia de entregas concluído! 🏍️ Obrigado a todos que pediram hoje.",
  "Rota tranquila hoje, 12 entregas sem atraso. Bora pra mais! 📦",
  "Dica: deixem o endereço com ponto de referência, ajuda muito o entregador. 🙏",
];
const COMENTARIOS = ["Top demais!", "Vou pedir hoje mesmo 😍", "Quanto fica a entrega pro Centro?", "Já comprei, super recomendo.", "Salvando pra depois!", "Melhor da cidade 👏"];
const REVIEWS = ["Produto excelente, chegou bem embalado.", "Muito bom, como esperado.", "Ótimo custo-benefício.", "Gostei, mas a entrega demorou um pouco.", "Qualidade impecável, recomendo!", "Cumpriu o prometido.", "Superou as expectativas!"];

async function main() {
  if (await prisma.user.count({ where: { email: { endsWith: `@${BOT_DOMAIN}` } } })) {
    console.log("Simulação já existe (usuários @bots). Nada feito.");
    return;
  }
  const passwordHash = await bcrypt.hash("senha123", 10);

  console.log("→ Categorias novas");
  for (const c of CATEGORIAS_NOVAS) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  const categorias = Object.fromEntries(
    (await prisma.category.findMany({ where: { storeId: null }, select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  console.log("→ Usuários bots (clientes, lojistas, vendedores, entregadores, moderadores)");
  const mkUser = async (role: "CUSTOMER" | "STORE_OWNER" | "SELLER" | "COURIER" | "MODERATOR") => {
    const name = nomeCompleto();
    return prisma.user.create({
      data: { name, email: emailDe(name), role, passwordHash, status: "ACTIVE", image: avatar(name), phone: `(49) 9${Math.floor(between(8000, 9999))}-${Math.floor(between(1000, 9999))}`, createdAt: diasAtras(90, 20) },
    });
  };
  const clientes = await Promise.all(Array.from({ length: 40 }, () => mkUser("CUSTOMER")));
  const donos = await Promise.all(LOJAS.map(() => mkUser("STORE_OWNER")));
  const vendedores = await Promise.all(LOJAS.map(() => mkUser("SELLER")));
  const entregadores = await Promise.all(Array.from({ length: 8 }, () => mkUser("COURIER")));
  await Promise.all(Array.from({ length: 2 }, () => mkUser("MODERATOR")));

  const enderecosCliente: Record<string, string> = {};
  for (const c of clientes) {
    const a = await prisma.address.create({
      data: {
        userId: c.id, label: pick(["Casa", "Trabalho", "Apartamento"]), recipientName: c.name, zip: "89900-000",
        street: pick(RUAS), number: String(Math.floor(between(10, 2500))), district: pick(BAIRROS),
        city: "São Miguel do Oeste", state: "SC", lat: -26.725 + between(-0.02, 0.02), lng: -53.518 + between(-0.02, 0.02), isDefault: true,
      },
    });
    enderecosCliente[c.id] = a.id;
  }

  const couriers = [];
  for (const u of entregadores) {
    couriers.push(await prisma.courierProfile.create({
      data: { userId: u.id, status: "APPROVED", isOnline: chance(0.6), vehicleType: pick(["MOTORCYCLE", "MOTORCYCLE", "BIKE", "CAR"]), documentsApproved: true, pixKey: u.email, currentLat: -26.725, currentLng: -53.518 },
    }));
  }

  console.log("→ Lojas e produtos (buscando fotos reais por palavra-chave)");
  type ProdCriado = { id: string; storeId: string; nome: string; preco: number; custo: number; unit: MeasureUnit; step: number };
  const produtos: ProdCriado[] = [];
  const lojas: { id: string; nome: string; ownerId: string }[] = [];
  for (let i = 0; i < LOJAS.length; i++) {
    const L = LOJAS[i];
    const slug = L.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const store = await prisma.store.create({
      data: {
        slug, name: L.nome, segment: L.segmento, description: L.descricao, ownerId: donos[i].id, status: "ACTIVE", isOpen: true,
        logoUrl: await foto(L.kwLogo), bannerUrl: await foto(L.kwBanner),
        lat: -26.725 + between(-0.03, 0.03), lng: -53.518 + between(-0.03, 0.03), createdAt: diasAtras(80, 15),
        settings: { create: { cashbackEnabled: true, loyaltyEnabled: true, acceptsDelivery: true, acceptsPickup: true, deliveryFeeBase: 5, deliveryFeePerKm: 1.5, freeDeliveryThreshold: 80, prepTimeMinutes: Math.floor(between(15, 45)), minOrderValue: 10 } },
        businessHours: { create: Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt: "08:00", closesAt: weekday >= 5 ? "23:00" : "21:00", isClosed: false })) },
        address: { create: { street: pick(RUAS), number: String(Math.floor(between(10, 2000))), district: pick(BAIRROS), city: "São Miguel do Oeste", state: "SC", zip: "89900-000", lat: -26.725, lng: -53.518 } },
        loyaltyTiers: { create: TIERS },
        cashbackRules: { create: { name: "Cashback padrão", type: "PERCENT", value: 5, releaseAfterDays: 7, validityDays: 90, active: true } },
        members: { create: [{ userId: donos[i].id, role: "OWNER" }, { userId: vendedores[i].id, role: "SELLER" }] },
      },
    });
    lojas.push({ id: store.id, nome: L.nome, ownerId: donos[i].id });
    for (const p of L.produtos) {
      const custo = r2(p.preco * between(0.5, 0.7));
      const created = await prisma.product.create({
        data: {
          storeId: store.id, categoryId: categorias[L.categoria] ?? null, name: p.nome,
          slug: p.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          description: `${p.nome} — ${L.nome}.`, basePrice: p.preco, promoPrice: p.promo ?? null, costPrice: custo,
          stock: p.unit === "KG" ? Math.floor(between(30, 120)) : Math.floor(between(20, 200)), unit: p.unit ?? "UN",
          minQuantity: p.unit === "KG" ? 0.1 : 1, unitStep: p.step ?? 1, isFeatured: p.destaque ?? false, createdAt: diasAtras(70, 10),
          images: { create: { url: await foto(p.kw), isPrimary: true } },
        },
      });
      produtos.push({ id: created.id, storeId: store.id, nome: p.nome, preco: p.promo ?? p.preco, custo, unit: p.unit ?? "UN", step: p.step ?? 1 });
    }
    process.stdout.write(`   ${L.nome} (${L.produtos.length} produtos)\n`);
  }
  // Produtos já existentes (seed original) também entram na simulação de compras
  for (const p of await prisma.product.findMany({ where: { status: "ACTIVE", storeId: { notIn: lojas.map((l) => l.id) } }, select: { id: true, storeId: true, name: true, basePrice: true, promoPrice: true, costPrice: true, unit: true, unitStep: true } })) {
    produtos.push({ id: p.id, storeId: p.storeId, nome: p.name, preco: Number(p.promoPrice ?? p.basePrice), custo: Number(p.costPrice ?? 0), unit: p.unit, step: Number(p.unitStep) });
  }
  const todasLojas = await prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, ownerId: true } });

  console.log("→ Seguidores e favoritos");
  const seguidores: Record<string, number> = {};
  for (const c of clientes) {
    const seguir = [...todasLojas].sort(() => rnd() - 0.5).slice(0, Math.floor(between(1, 5)));
    await prisma.storeFollow.createMany({ data: seguir.map((s) => ({ userId: c.id, storeId: s.id })), skipDuplicates: true });
    for (const s of seguir) seguidores[s.id] = (seguidores[s.id] ?? 0) + 1;
    const favs = [...produtos].sort(() => rnd() - 0.5).slice(0, Math.floor(between(0, 4)));
    await prisma.productFavorite.createMany({ data: favs.map((p) => ({ userId: c.id, productId: p.id })), skipDuplicates: true });
  }
  for (const [storeId, n] of Object.entries(seguidores)) {
    await prisma.store.update({ where: { id: storeId }, data: { followerCount: { increment: n } } });
  }

  console.log("→ Pedidos, entregas, estoque, cashback e fidelidade");
  const METODOS: PaymentMethod[] = ["PIX", "PIX", "PIX", "CREDIT_CARD", "CREDIT_CARD", "DEBIT_CARD", "CASH_ON_DELIVERY"];
  const FLUXO: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"];
  const porLoja = Object.groupBy(produtos, (p) => p.storeId);
  const vendas: Record<string, number> = {};
  const fidelidade: Record<string, { totalOrders: number; totalSpend: number; cashback: number }> = {};
  const pedidosConcluidos: { id: string; customerId: string; storeId: string; itens: ProdCriado[]; createdAt: Date }[] = [];
  let codigoSeq = 1000;

  for (let n = 0; n < 180; n++) {
    const cliente = pick(clientes);
    const loja = pick(todasLojas);
    const catalogo = porLoja[loja.id] ?? [];
    if (!catalogo.length) continue;
    const itens = [...catalogo].sort(() => rnd() - 0.5).slice(0, Math.floor(between(1, 4)));
    const criadoEm = diasAtras(60);
    const idadeDias = (Date.now() - criadoEm.getTime()) / DIA;
    const entrega = chance(0.7);
    const metodo = pick(METODOS);

    let status: OrderStatus;
    if (idadeDias < 0.3) status = pick(["PENDING", "ACCEPTED", "PREPARING"]);
    else if (idadeDias < 1) status = pick(["READY", "OUT_FOR_DELIVERY", "DELIVERED"]);
    else status = chance(0.06) ? "CANCELLED" : chance(0.7) ? "COMPLETED" : "DELIVERED";
    if (!entrega && status === "OUT_FOR_DELIVERY") status = "READY";

    const linhas = itens.map((p) => {
      const qtd = p.unit === "KG" ? r2(Math.round(between(0.3, 2) / p.step) * p.step) : Math.floor(between(1, 4));
      return { p, qtd, total: r2(p.preco * qtd) };
    });
    const subtotal = r2(linhas.reduce((s, l) => s + l.total, 0));
    const costTotal = r2(linhas.reduce((s, l) => s + l.p.custo * l.qtd, 0));
    const km = entrega ? r2(between(0.8, 7)) : 0;
    const deliveryFee = entrega ? (subtotal >= 80 ? 0 : r2(5 + 1.5 * km)) : 0;
    const cashbackEarned = status === "CANCELLED" ? 0 : r2(subtotal * 0.05);
    const fin = calcOrderFinance({ subtotal, costTotal, deliveryFee, discount: 0, cashbackEarned, commissionPct: 8, method: metodo });
    const total = r2(subtotal + deliveryFee);
    const concluido = status === "DELIVERED" || status === "COMPLETED";
    const etapas = status === "CANCELLED" ? (["PENDING", "CANCELLED"] as OrderStatus[]) : FLUXO.slice(0, FLUXO.indexOf(status) + 1).filter((s) => entrega || s !== "OUT_FOR_DELIVERY");
    const passo = (i: number) => new Date(criadoEm.getTime() + i * between(8, 20) * 60_000);
    const entregueEm = concluido ? passo(etapas.length) : null;

    const pedido = await prisma.order.create({
      data: {
        code: `CMZ-${(codigoSeq++).toString(36).toUpperCase().padStart(6, "0")}`,
        customerId: cliente.id, storeId: loja.id, status, fulfillmentType: entrega ? "DELIVERY" : "PICKUP",
        subtotal, deliveryFee, total, cashbackEarned, costTotal, commissionFee: fin.commissionFee, paymentFee: fin.paymentFee, netProfit: fin.netProfit,
        addressId: entrega ? enderecosCliente[cliente.id] : null, placedAt: criadoEm, createdAt: criadoEm,
        acceptedAt: etapas.includes("ACCEPTED") ? passo(1) : null, readyAt: etapas.includes("READY") ? passo(3) : null,
        deliveredAt: entregueEm, cancelledAt: status === "CANCELLED" ? passo(1) : null,
        items: { create: linhas.map((l) => ({ productId: l.p.id, name: l.p.nome, unitPrice: l.p.preco, quantity: l.qtd, total: l.total, costPrice: l.p.custo, cashbackPercent: 5 })) },
        payment: { create: { method: metodo, status: status === "CANCELLED" ? "REFUNDED" : concluido || metodo !== "CASH_ON_DELIVERY" ? "PAID" : "PENDING", amount: total, paidAt: concluido ? entregueEm : criadoEm } },
        statusHistory: { create: etapas.map((s, i) => ({ status: s, createdAt: passo(i) })) },
        ...(entrega ? { delivery: { create: {
          courierId: status === "PENDING" ? null : pick(couriers).id,
          status: status === "CANCELLED" ? "CANCELLED" : concluido ? "DELIVERED" : status === "OUT_FOR_DELIVERY" ? "IN_TRANSIT" : status === "PENDING" ? "PENDING" : "ACCEPTED",
          distanceKm: km, fee: deliveryFee, courierEarnings: r2(deliveryFee * 0.8), platformFee: r2(deliveryFee * 0.2), estimatedMinutes: Math.floor(20 + km * 4),
          acceptedAt: status === "PENDING" ? null : passo(1), pickedUpAt: etapas.includes("OUT_FOR_DELIVERY") ? passo(4) : null, deliveredAt: entregueEm,
        } } } : {}),
      },
    });

    if (status !== "CANCELLED") {
      for (const l of linhas) {
        await prisma.product.update({ where: { id: l.p.id }, data: { stock: { decrement: l.qtd }, salesCount: { increment: Math.max(1, Math.round(l.qtd)) } } });
        await prisma.stockMovement.create({ data: { storeId: loja.id, productId: l.p.id, type: "SALE", quantity: l.qtd, reason: "Venda", reference: pedido.id, createdAt: criadoEm } });
        vendas[l.p.id] = (vendas[l.p.id] ?? 0) + 1;
      }
    }
    if (concluido) {
      pedidosConcluidos.push({ id: pedido.id, customerId: cliente.id, storeId: loja.id, itens: itens, createdAt: criadoEm });
      const k = `${cliente.id}:${loja.id}`;
      fidelidade[k] ??= { totalOrders: 0, totalSpend: 0, cashback: 0 };
      fidelidade[k].totalOrders++;
      fidelidade[k].totalSpend = r2(fidelidade[k].totalSpend + total);
      const liberado = idadeDias >= 7;
      if (liberado) fidelidade[k].cashback = r2(fidelidade[k].cashback + cashbackEarned);
      await prisma.cashbackTransaction.create({ data: {
        userId: cliente.id, storeId: loja.id, orderId: pedido.id, type: "EARNED", status: liberado ? "AVAILABLE" : "PENDING", amount: cashbackEarned,
        availableAt: new Date(criadoEm.getTime() + 7 * DIA), expiresAt: new Date(criadoEm.getTime() + 97 * DIA), createdAt: criadoEm,
      } });
      await prisma.courierProfile.updateMany({ where: { deliveries: { some: { orderId: pedido.id } } }, data: { deliveriesCount: { increment: 1 } } });
    }
    if (n % 30 === 29) process.stdout.write(`   ${n + 1} pedidos...\n`);
  }
  // Evita estoque negativo em produtos muito vendidos
  await prisma.$executeRawUnsafe(`UPDATE "Product" SET stock = 0 WHERE stock < 0`);

  for (const [k, f] of Object.entries(fidelidade)) {
    const [userId, storeId] = k.split(":");
    const tiers = await prisma.loyaltyTier.findMany({ where: { storeId }, orderBy: { level: "desc" } });
    const tier = tiers.find((t) => f.totalOrders >= t.minOrders && f.totalSpend >= Number(t.minSpend));
    await prisma.loyaltyStatus.create({ data: { userId, storeId, tierId: tier?.id ?? null, totalOrders: f.totalOrders, totalSpend: f.totalSpend, points: f.totalOrders * 10 } });
    if (f.cashback > 0) await prisma.cashbackWallet.create({ data: { userId, storeId, balance: f.cashback } });
  }

  console.log("→ Avaliações (produtos, lojas e entregadores)");
  for (const ped of pedidosConcluidos) {
    if (!chance(0.55)) continue;
    const nota = pick([3, 4, 4, 5, 5, 5]);
    await prisma.review.create({ data: { authorId: ped.customerId, type: "PRODUCT", rating: nota, comment: pick(REVIEWS), productId: pick(ped.itens).id, storeId: ped.storeId, orderId: ped.id, createdAt: new Date(ped.createdAt.getTime() + DIA) } });
    if (chance(0.4)) await prisma.review.create({ data: { authorId: ped.customerId, type: "STORE", rating: pick([4, 4, 5, 5]), comment: pick(["Loja nota 10!", "Atendimento rápido e educado.", "Sempre compro aqui.", "Entrega no prazo."]), storeId: ped.storeId, orderId: ped.id, createdAt: new Date(ped.createdAt.getTime() + DIA) } });
  }
  // Recalcula médias a partir das avaliações reais
  for (const p of produtos) {
    const agg = await prisma.review.aggregate({ where: { productId: p.id, type: "PRODUCT" }, _avg: { rating: true }, _count: true });
    if (agg._count) await prisma.product.update({ where: { id: p.id }, data: { ratingAvg: r2(agg._avg.rating ?? 0), ratingCount: agg._count } });
  }
  for (const s of todasLojas) {
    const agg = await prisma.review.aggregate({ where: { storeId: s.id }, _avg: { rating: true }, _count: true });
    if (agg._count) await prisma.store.update({ where: { id: s.id }, data: { ratingAvg: r2(agg._avg.rating ?? 0), ratingCount: agg._count } });
  }

  console.log("→ Rede social: publicações, curtidas e comentários");
  const posts: string[] = [];
  for (const loja of todasLojas) {
    for (let i = 0; i < 3; i++) {
      const prod = pick(porLoja[loja.id] ?? produtos);
      const comFoto = chance(0.5);
      const post = await prisma.post.create({ data: {
        authorId: loja.ownerId, storeId: loja.id, type: pick(["PROMOTION", "PRODUCT", "NEWS"]), content: pick(POSTS_LOJA)(prod.nome), productId: chance(0.5) ? prod.id : null, createdAt: diasAtras(45),
        ...(comFoto ? { images: { create: { url: (await prisma.productImage.findFirst({ where: { productId: prod.id } }))?.url ?? FOTO_FALLBACK } } } : {}),
      } });
      posts.push(post.id);
    }
  }
  for (const c of clientes.slice(0, 25)) {
    const post = await prisma.post.create({ data: { authorId: c.id, type: "TEXT", content: pick(POSTS_CLIENTE)(pick(todasLojas).name), createdAt: diasAtras(40) } });
    posts.push(post.id);
  }
  for (const e of entregadores.slice(0, 4)) {
    const post = await prisma.post.create({ data: { authorId: e.id, type: "TEXT", content: pick(POSTS_ENTREGADOR), createdAt: diasAtras(30) } });
    posts.push(post.id);
  }
  for (const postId of posts) {
    const curtidores = [...clientes].sort(() => rnd() - 0.5).slice(0, Math.floor(between(0, 18)));
    await prisma.postLike.createMany({ data: curtidores.map((u) => ({ userId: u.id, postId })), skipDuplicates: true });
    const comentarios = Math.floor(between(0, 4));
    for (let i = 0; i < comentarios; i++) {
      await prisma.comment.create({ data: { postId, authorId: pick(clientes).id, content: pick(COMENTARIOS) } });
    }
    await prisma.post.update({ where: { id: postId }, data: { likeCount: curtidores.length, commentCount: comentarios } });
  }

  console.log("→ Conversas e cupons");
  for (let i = 0; i < 10; i++) {
    const c = pick(clientes), l = pick(todasLojas), prod = pick(porLoja[l.id] ?? produtos);
    const t0 = diasAtras(20).getTime();
    await prisma.conversation.create({ data: {
      participants: { create: [{ userId: c.id }, { userId: l.ownerId }] },
      messages: { create: [
        { senderId: c.id, content: `Oi! ${prod.nome} tem pra entrega hoje?`, createdAt: new Date(t0) },
        { senderId: l.ownerId, content: "Olá! Tem sim, saindo em até 40 min. 😊", createdAt: new Date(t0 + 3 * 60_000) },
        { senderId: c.id, content: "Perfeito, vou fechar o pedido agora. Obrigado!", createdAt: new Date(t0 + 5 * 60_000) },
      ] },
    } });
  }
  await prisma.coupon.createMany({
    data: lojas.map((l, i) => ({ storeId: l.id, code: `${l.nome.split(" ")[0].toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${10 + i}`, description: "Desconto especial de lançamento", type: pick(["PERCENT", "FIXED"]) as "PERCENT" | "FIXED", value: pick([10, 15, 20]), minOrderValue: 40, active: true })),
    skipDuplicates: true,
  });

  const resumo = {
    usuarios: await prisma.user.count(), lojas: await prisma.store.count(), produtos: await prisma.product.count(),
    pedidos: await prisma.order.count(), entregas: await prisma.delivery.count(), avaliacoes: await prisma.review.count(),
    posts: await prisma.post.count(), curtidas: await prisma.postLike.count(), comentarios: await prisma.comment.count(),
  };
  console.log("✔ Simulação concluída:", resumo);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
