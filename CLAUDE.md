# Comex Brasil — guia pra agentes Claude

## Propósito

Visualização do comércio exterior brasileiro em cima de um grafo Neo4j.
Dados oficiais do Comex Stat / MDIC. Quatro views integradas (Globo,
Produto, Sankey, Cypher) num único Next.js app.

## Arquitetura

```
Comex Stat CSVs ──► Python+DuckDB ETL ──► Neo4j 5 ──► Next.js (4 views)
   (gov.br)        (download/transform/load)         (App Router)
```

- **Neo4j 5** roda via docker-compose. Heap dimensionado pra colima 2GiB
  (768m heap + 256m pagecache). Bumpar se a VM crescer.
- **ETL** em `etl/` usa uv + DuckDB pra ler os CSVs (latin-1, separador
  `;`, aspas mistas) e escrever parquet, depois carrega no Neo4j com
  `neo4j-driver` em batches `UNWIND`.
- **Web** em `web/` é Next.js 16 + TypeScript + Tailwind 4. Tudo
  client-side em cima de uma única página `/` que troca de view por
  estado interno.

## Modelo de dados (Neo4j)

Star schema com `:TradeFlow` como fact node:

```cypher
(:TradeFlow {year, direction:"EXP"|"IMP", fob_usd, kg_liquido, qty_estat})
  -[:FROM_STATE]->(:State)
  -[:TO_COUNTRY]->(:Country)
  -[:OF_CHAPTER]->(:Chapter)
  -[:IN_YEAR]->(:Year)

(:Product)-[:IN_CHAPTER]->(:Chapter)-[:IN_SECTION]->(:Section)
```

Agregação fixa por `(ano, direção, UF, país, capítulo NCM-2)`. Não
pulverizar fatos por NCM-8 — cresce 100x. Drill pra NCM-8 fica nos
`:Product`, fora do `:TradeFlow`.

Volume de dados (2024 sozinho): ~85 mil `:TradeFlow`, 281 países, 97
capítulos, 34 UFs (incluindo códigos especiais ZN/EX/ND), 21 seções.

## Convenções

### Linguagem comum, nunca NCM cru

O público é leigo. Toda label visível no app usa as **10 macro-categorias
em PT-BR** definidas em `web/src/lib/categories.ts` (Grãos e soja,
Minérios e metais, Petróleo e combustíveis, Máquinas e eletrônicos,
Veículos e aeronaves, Carnes e pescados, Café/açúcar/sucos, Celulose
e papel, Químicos e fertilizantes, Outros).

`categoryIdForChapter("12") -> "graos"`. Capítulos não mapeados caem
em "outros".

**Não** mostrar "NCM 12", "Capítulo 27", "Seção II" em UI. Pode
aparecer em pre-formatado de Cypher snippet, mas não como label de
nó/eixo/badge.

### Métricas

Sempre acompanhar **valor (FOB USD) + volume (kg / toneladas)**. Volume
está em `kg_liquido` no Neo4j; o helper `formatTons()` converte pra
"Mt"/"kt"/"t" em PT-BR.

BRL ficou de fora dessa rodada (sem FX). Se for adicionar: fetch da
série SGS 3697 do Banco Central no ETL e gravar como propriedade de
`:Year`.

### Endpoints

Todos read-only, sem auth (rodando local):

- `GET /api/partners?year=2024` — totais por país + KPIs
- `GET /api/dashboard?year=2024&dir=EXP` — cells (país × categoria)
- `GET /api/sankey?year=2024&dir=EXP` — cells (UF × categoria × país)
- `POST /api/cypher` — execução Cypher read-only com deny-list
  (`CREATE/MERGE/SET/DELETE/REMOVE/DROP/...`), timeout 5s, 1k linhas

### Componentes

- `App.tsx` — state container (mode, view, selected, hovered, rotation,
  tweaks, dados). Tweaks persistidos em `localStorage`.
- `Globe.tsx` — projeção ortográfica em SVG **puro**, sem three.js,
  sem react-globe.gl, sem react-simple-maps. Toda a matemática
  (`project`, `arcPath`, `graticule`) está no próprio arquivo.
  Polígonos low-fi de terra em `lib/land.ts`.
- `MultiPicker.tsx` — dropdown de filtros usado pelo Sankey.
- `TweaksPanel.tsx` — sliders/toggles/select pras paletas OKLCH e
  parâmetros visuais.
- `primitives.tsx` — só o `Badge`. Não é um sistema de design.

### Estilo

- Fontes: **Inter** (UI) e **JetBrains Mono** (números, código), via
  `next/font/google`. CSS vars `--font-inter` e `--font-mono`.
- Cores: paletas OKLCH parametrizadas por hue (Indigo/Violeta,
  Esmeralda/Âmbar, Ciano/Magenta, Monochrome). Verde = EXP, violeta
  = IMP.
- Tudo dark; fundo `slate-950`, painéis `slate-900/40`, bordas
  `slate-800/60`. Tabular nums + monospace pros números.

## Comandos

### Dev

```bash
# subir banco
docker compose up -d neo4j

# ETL (de dentro de etl/)
uv run python download.py --year 2024
uv run python transform.py --year 2024
uv run python load.py --year 2024

# web (de dentro de web/)
npm run dev          # localhost:3000
npm run build        # produção
npx tsc --noEmit     # type check standalone
```

### Recarregar um ano (idempotente nas dimensões)

```cypher
// Cypher — limpar antes de recarregar
MATCH (tf:TradeFlow {year: 2024}) DETACH DELETE tf;
```

```bash
# depois
uv run python load.py --year 2024
```

### Adicionar um ano novo

```bash
uv run python download.py --year 2023
uv run python transform.py --year 2023
uv run python load.py --year 2023 --skip-schema --skip-dimensions
```

`--skip-dimensions` evita re-merge dos países/capítulos quando você
sabe que já estão lá.

## Gotchas

- **TLS do gov.br** — SERPRO não envia a CA intermediária Sectigo.
  Python `ssl` falha. Solução: `truststore.SSLContext()` lê o keychain
  do macOS. Já está em `etl/download.py`. Em outras plataformas pode
  precisar de fallback pra `certifi`.
- **CSVs do MDIC** misturam aspas dentro da mesma linha (ex.: 7 colunas
  com aspas, 3 sem). DuckDB precisa de `strict_mode=false` +
  `all_varchar=true` em `read_csv`. Ver `etl/transform.py`.
- **URL da Comex Stat mudou** — anuais agora em
  `balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/EXP_YYYY.csv`,
  tabelas auxiliares ainda em `balanca.economia.gov.br/balanca/bd/tabelas/`.
- **Memória do Neo4j** vs **VM do colima** — o `docker-compose.yml` tem
  768m heap. Se a VM tem só 2GiB total, não bumpa heap sem expandir a
  VM (`colima start --memory 4`).
- **Page.tsx é client component** — `dynamic(..., { ssr: false })` exige
  `"use client"` no Next 15+. Globe/ProductView/etc. tocam `window` ou
  randomização, então tudo renderiza client-side.
- **`world-countries`** é a fonte canônica de ISO3, latlng e subregion.
  Já há crosswalk PT-BR em `lib/regions.ts`. Adicionar override em
  `lib/country-coords.ts` quando o Comex usa um código que o
  `world-countries` não tem (HKG, TWN, SCG legacy etc.).

## Direções a evitar

- **Não trazer de volta** o force-graph de produto que existia em
  iterações antigas. O usuário rejeitou explicitamente: "uma zona
  ilegível". Ranking + sankey + globo cobrem o que o force-graph
  tentava fazer, com legibilidade muito melhor.
- **Não usar react-globe.gl ou react-simple-maps** pro globo. Já foram
  testados e descartados em favor do SVG ortográfico hand-rolled
  (`Globe.tsx`). Tem 360 linhas de TS e zero peer-dep — bem mais
  manutenível.
- **Não expor NCM em UI**. Ver "Convenções → Linguagem comum".
- **Não escrever em produção via Cypher** — `/api/cypher` é read-only
  e bloqueia clauses mutating.

## TODOs conhecidos

- ETL multi-ano (2015–2025) — código aceita, mas não rodou; o year
  slider do globo só mostra 2024 hoje.
- BRL: precisa fetch FX do Banco Central + propriedade de `:Year`.
- Sankey por capítulo (drill abaixo de categoria) — está agregado
  em macro-categorias por design, mas se quiser ver "soja vs milho",
  precisa de uma view extra.
- Geometria do globo é feia em zoom alto — polígonos de
  `lib/land.ts` são propositalmente baixa-fi. Pra subir pra 50m
  topojson, mudar o renderer.

## Memória cruzada

Há feedback do usuário e contexto do projeto guardados em
`~/.claude/projects/<encoded>/memory/` quando o trabalho começou
no monorepo `homelab/`. As regras-chave (sem jargão NCM, dashboard
> force-graph, opengridworks como referência de UX) já foram
incorporadas neste app — não há nada novo lá além da história.
