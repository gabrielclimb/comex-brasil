# Comex Brasil

Visualização interativa do comércio exterior brasileiro a partir dos dados
oficiais do [Comex Stat / MDIC](https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta),
modelados como um grafo no Neo4j.

Quatro views integradas:

1. **Globo** — projeção ortográfica em SVG puro, arcos animados saindo do
   Brasil pra cada país parceiro, lista de top parceiros à esquerda e
   detail panel à direita com o que é trocado com o país selecionado.
2. **Produto** — constelação de categorias de produto ao redor do BR;
   clique numa categoria pra ver os principais parceiros.
3. **Sankey** — fluxo UF → Categoria → País, com pickers multi-seleção
   por estado, categoria e parceiro.
4. **Cypher** — workspace estilo Neo4j Browser; queries de exemplo,
   syntax highlight e execução read-only contra o banco.

## Stack

- **Neo4j 5** (community, docker-compose)
- **ETL** Python 3.12 + [uv](https://docs.astral.sh/uv/) + DuckDB +
  neo4j-driver
- **Web** Next.js 16 + TypeScript + Tailwind 4
- **Modelo de dados** star schema com `:TradeFlow` como fact node
  agregando por (ano, direção, UF, país, capítulo NCM)

## Quickstart (do zero ao app rodando)

### 1. Pré-requisitos

- Docker (testado com colima 2GiB+ de RAM)
- Python 3.12 (via uv)
- Node 20+ + npm

### 2. Subir o Neo4j

```bash
cp .env.example .env
# Edite .env e troque NEO4J_PASSWORD se quiser

docker compose up -d neo4j
# Aguarde ~20s — health check em curso
docker compose ps
# Quando estiver "healthy", abra: http://localhost:7474
# Login: neo4j / <senha do .env>
```

### 3. Rodar o ETL

```bash
cd etl
uv sync                                    # baixa as deps Python

uv run python download.py --year 2024      # ~270 MB (CSVs + tabelas auxiliares)
uv run python transform.py --year 2024     # agrega no DuckDB → parquet
uv run python load.py --year 2024          # MERGE no Neo4j (~16s)
```

Ao final você terá:

- ~85 mil `:TradeFlow` no Neo4j para o ano de 2024
- Total exportado bate com o oficial do MDIC (~US$ 337 bi)

> Pra carregar mais anos, é só repetir os 3 comandos com outros
> `--year`. O modelo aceita 1997+.

### 4. Rodar o web app

```bash
cd ../web
npm install                                # ~2 min
npm run dev                                # localhost:3000
```

Abra http://localhost:3000 e a tela inicial mostra o globo com os
arcos pulsando.

## Diretórios

```
comex-brasil/
├── docker-compose.yml         # Neo4j 5 community, APOC plugin
├── .env.example               # NEO4J_PASSWORD/URI/USER
├── etl/
│   ├── pyproject.toml         # uv-managed
│   ├── download.py            # async httpx + truststore (cert SERPRO)
│   ├── transform.py           # DuckDB lê CSV (latin-1, ;), agrega em parquet
│   ├── load.py                # neo4j-driver UNWIND batch
│   └── cypher/
│       ├── schema.cypher      # constraints + índices
│       └── queries.cypher     # queries de exemplo
├── data/                      # gitignored
│   ├── raw/                   # CSVs do MDIC
│   └── staging/               # parquet agregado
└── web/
    ├── package.json
    ├── public/
    └── src/
        ├── app/
        │   ├── page.tsx                # entrypoint (renderiza <App/>)
        │   ├── layout.tsx              # fontes Inter + JetBrains Mono
        │   ├── globals.css
        │   └── api/
        │       ├── partners/route.ts   # GET — top parceiros + KPIs
        │       ├── dashboard/route.ts  # GET — cells (país × categoria)
        │       ├── sankey/route.ts     # GET — cells (uf × categoria × país)
        │       └── cypher/route.ts     # POST — exec read-only de Cypher
        ├── components/
        │   ├── App.tsx                 # state container + view switching
        │   ├── TopBar.tsx              # nav, EXP/IMP toggle, settings
        │   ├── KPIs.tsx                # 4 cards do topo
        │   ├── Globe.tsx               # SVG ortográfico + arcs + pulse
        │   ├── CountryList.tsx
        │   ├── DetailPanel.tsx
        │   ├── ProductView.tsx
        │   ├── SankeyView.tsx
        │   ├── CypherView.tsx
        │   ├── MultiPicker.tsx         # dropdown de filtros do Sankey
        │   ├── TweaksPanel.tsx         # paleta, sliders, toggles
        │   ├── types.ts                # Mode, View, Tweaks, palettes
        │   └── primitives.tsx          # Badge
        └── lib/
            ├── neo4j.ts                # driver singleton + readTx
            ├── categories.ts           # 10 macro-categorias PT-BR
            ├── format.ts               # formatUSD/formatTons + flag
            ├── country-coords.ts       # ISO3 → [lat, lng]
            ├── regions.ts              # ISO3 → região PT-BR
            └── land.ts                 # polígonos low-fi pro globo
```

## Modelo de dados

Star schema com `:TradeFlow` como fact node:

```cypher
(:TradeFlow {year, direction, fob_usd, kg_liquido, qty_estat})
  -[:FROM_STATE]->(:State)
  -[:TO_COUNTRY]->(:Country)
  -[:OF_CHAPTER]->(:Chapter)
  -[:IN_YEAR]->(:Year)

(:Product)-[:IN_CHAPTER]->(:Chapter)-[:IN_SECTION]->(:Section)
```

Agregação por `(ano, direção, UF, país, capítulo NCM)` — mantém o grafo
em milhões de fatos em vez de centenas de milhões. NCM-8 (`:Product`)
fica disponível pra drill-down futuro.

**Categorias em linguagem comum** (`web/src/lib/categories.ts`)
mapeiam capítulo NCM → uma das 10 macro-categorias:

| Categoria             | Capítulos NCM                          | Cor    |
|----------------------|----------------------------------------|--------|
| Grãos e soja         | 10, 12                                 | Amber  |
| Carnes e pescados    | 02, 03, 16                             | Red    |
| Café, açúcar e sucos | 09, 17, 20                             | Orange |
| Celulose e papel     | 47, 48, 49                             | Emerald |
| Minérios e metais    | 26, 72, 73, 74, 75, 76, 78, 79, 80, 81 | Slate  |
| Petróleo e combust.  | 27                                     | Violet |
| Químicos e fertiliz. | 28, 29, 30, 31, 32, 33, 38, 39, 40     | Sky    |
| Máquinas e eletrôn.  | 84, 85                                 | Cyan   |
| Veículos e aeronaves | 86, 87, 88, 89                         | Pink   |
| Outros               | resto                                  | Gray   |

## Endpoints da API

Todos retornam JSON. Sem autenticação (rodando local).

- `GET /api/partners?year=2024` — totais de exp/imp por país e os
  agregados que alimentam os KPIs.
- `GET /api/dashboard?year=2024&dir=EXP` — célula granular (país,
  categoria) com FOB e kg.
- `GET /api/sankey?year=2024&dir=EXP` — célula (UF, categoria, país)
  pro Sankey.
- `POST /api/cypher` body `{ query: string }` — executa Cypher
  read-only com timeout de 5s, máx 1000 linhas.

## Atualizando os dados

A Comex Stat publica novos meses ao longo do ano. Pra atualizar:

```bash
cd etl
uv run python download.py --year 2024 --force   # baixa de novo
uv run python transform.py --year 2024
uv run python load.py --year 2024
```

O `MERGE` é idempotente nas dimensões; os fatos (`TradeFlow`) são
recriados com `CREATE`, então recomenda-se limpar o ano antes de
recarregar:

```cypher
MATCH (tf:TradeFlow {year: 2024}) DETACH DELETE tf;
```

## Notas de implementação

- **SSL do gov.br** — o servidor SERPRO não envia a CA intermediária
  Sectigo. `truststore` faz fallback pro keychain do macOS.
- **CSVs com aspas mistas** — Comex CSV mistura colunas com/sem aspas;
  DuckDB lê com `strict_mode=false, all_varchar=true`.
- **Globo SVG ortográfico** — projeção e arcos great-circle são
  hand-rolled (`web/src/components/Globe.tsx`); zero dep além do React.
- **Cypher read-only** — o handler tem deny-list pra
  `CREATE/MERGE/SET/DELETE/...` e roda com `defaultAccessMode: READ`.

## Licença

[MIT](LICENSE)
