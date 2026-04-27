# TODO: carregar anos históricos (2015–2023)

Hoje só **2024** está no Neo4j. O ETL aceita qualquer ano (1997+),
mas precisa rodar uma vez por ano. Este TODO descreve o passo a
passo, custo aproximado e o checklist de validação.

## Por que importa

- O slider de ano no globo só faz sentido com múltiplos anos
  carregados.
- Análises de tendência (efeito da pandemia, guerra comercial,
  ascensão da China como parceiro) precisam de série histórica.
- A Cypher view ganha queries muito mais ricas com 10+ anos.

## Custo estimado (por ano)

| Etapa            | Tempo     | Tamanho                     |
|------------------|-----------|-----------------------------|
| `download.py`    | ~3 min    | ~270 MB de CSV em `data/raw/` |
| `transform.py`   | ~2 min    | ~5 MB de parquet em `data/staging/` |
| `load.py`        | ~3–5 min  | ~80 mil `:TradeFlow` no Neo4j |

**Total p/ 2015–2023 (9 anos):** ~1h30 sequencial, ~2.5 GB em
`data/raw/`, ~50 MB em `data/staging/`, ~720 mil `:TradeFlow`
adicionais no Neo4j.

## Checklist antes de começar

- [ ] **Espaço em disco:** 3 GB livres na raiz do projeto
      (`df -h .` no diretório).
- [ ] **Memória do Neo4j:** o `docker-compose.yml` usa heap 768m.
      Pra 800k+ fatos, considere bumpar pra 1.5G se a VM do Colima
      tiver folga (`colima list` mostra a memória disponível).
- [ ] **Internet estável:** o downloader é idempotente; se cair, é
      só rodar de novo sem `--force`.
- [ ] **Neo4j rodando:** `docker compose ps` deve mostrar
      `comex-neo4j` em `healthy`.

## Sequência manual (recomendada pra primeiro ano)

```bash
cd etl

# Um ano de cada vez, pra você ver os outputs:
uv run python download.py --year 2023
uv run python transform.py --year 2023

# Skip o schema e dimensões depois do primeiro load — já estão lá
uv run python load.py --year 2023 --skip-schema --skip-dimensions
```

> **Importante:** `--skip-dimensions` evita re-merge de Country/State/
> Chapter/Section/Year. Se você esquecer, não corrompe nada — só
> demora ~30s a mais.

Validação por ano:

```cypher
// No Neo4j Browser (http://localhost:7474):
MATCH (tf:TradeFlow {year: 2023}) RETURN count(tf);
// Esperado: ~80 mil

MATCH (tf:TradeFlow {year: 2023, direction: 'EXP'})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN c.name, sum(tf.fob_usd) / 1e9 AS bilhoes
ORDER BY bilhoes DESC LIMIT 5;
// Top 5 deve ter China + EUA + Argentina + Holanda
```

## Sequência em batch (depois que o fluxo de 1 ano funcionou)

```bash
cd etl

for year in 2023 2022 2021 2020 2019 2018 2017 2016 2015; do
  echo "=== $year ==="
  uv run python download.py --year $year && \
  uv run python transform.py --year $year && \
  uv run python load.py --year $year --skip-schema --skip-dimensions
done
```

Ordem decrescente (2023 → 2015) faz os anos mais relevantes
aparecerem primeiro, pra você ver progresso significativo cedo.

Tempo total: ~1h30 sem supervisão. Pode rodar em segundo plano
(`nohup ... &` ou `screen`).

## Validação final

```cypher
// Anos carregados
MATCH (y:Year) RETURN y.value ORDER BY y.value;

// Total de fatos
MATCH (tf:TradeFlow) RETURN count(tf);
// Esperado: ~720 mil pra 9 anos × 80k

// Sanity: total exportação por ano (deve crescer ao longo do tempo
// e bater com os números públicos do MDIC)
MATCH (tf:TradeFlow {direction: 'EXP'})
RETURN tf.year AS ano, sum(tf.fob_usd) / 1e9 AS bilhoes_usd
ORDER BY ano;
```

Esperado (números oficiais MDIC, USD bi):

| Ano  | EXP    |
|------|--------|
| 2015 | 191    |
| 2016 | 185    |
| 2017 | 217    |
| 2018 | 239    |
| 2019 | 221    |
| 2020 | 209    |
| 2021 | 280    |
| 2022 | 334    |
| 2023 | 339    |
| 2024 | 337    |

Se algum ano divergir mais do que 1–2%, vale revisar o CSV baixado
(o MDIC ocasionalmente revisa números antigos).

## Depois que carregar

- [ ] Atualizar `web/src/components/App.tsx` se quiser mudar o
      `YEAR` constante padrão (hoje fixo em 2024).
- [ ] Considerar adicionar um seletor de ano no TopBar (botão
      próximo ao toggle EXP/IMP). Hoje cada view tem uma constante
      `YEAR = 2024` — refatorar pra prop.
- [ ] Atualizar o `CLAUDE.md` na seção "Volume de dados" trocando
      "85 mil `:TradeFlow`" pelo novo total.
- [ ] Rodar `MATCH (n) RETURN count(n)` e ajustar o array
      `SCHEMA_NODES` em `web/src/components/CypherView.tsx`
      (números mostrados na sidebar do Schema).

## Limpando antes de recarregar (se precisar)

Se um ano específico ficou inconsistente:

```cypher
MATCH (tf:TradeFlow {year: 2020}) DETACH DELETE tf;
MATCH (y:Year {value: 2020}) DETACH DELETE y;
```

Depois rodar `load.py --year 2020 --skip-dimensions` (mas **sem**
`--skip-schema`, pra recriar o `:Year` deletado — ou usar
`MERGE (:Year {value: 2020})` à mão antes).

## Riscos & mitigações

- **OOM no Neo4j:** se cair durante o load com erro de heap, pare
  o container, bumpe `NEO4J_server_memory_heap_max__size` no
  `docker-compose.yml` pra `1500m` (precisa de pelo menos 2.5GiB
  livres na VM do Colima), e suba de novo.
- **Disco cheio em `data/raw/`:** os CSVs podem ser deletados
  depois do load — `rm -rf data/raw/EXP_201[5-9].csv data/raw/IMP_201[5-9].csv`.
  O parquet em `data/staging/` é leve (~5 MB/ano) e pode ficar.
- **MDIC fora do ar:** raro, mas o downloader tem retries e SSL
  via keychain do macOS (`truststore`). Se persistir, esperar
  algumas horas e tentar novamente.

## Quando dar como concluído

- [ ] `MATCH (y:Year) RETURN count(y)` retorna **10** (2015–2024)
- [ ] Total `:TradeFlow` ≈ 800 mil
- [ ] Globo mostra arcos diferentes ao mudar o slider de ano
      (precisa do refactor mencionado em "Depois que carregar")
- [ ] Cypher view "Top 10 destinos" mudando `2024` por `2020`
      retorna lista diferente (Argentina caiu durante COVID,
      etc.)
