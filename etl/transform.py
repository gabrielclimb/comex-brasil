"""Transform raw Comex Stat CSVs into parquet aggregated for the graph.

Produces, per year, parquet files in ../data/staging/:
  - tradeflows_<year>.parquet  (year, direction, uf, country_code, chapter, fob_usd, kg_liquido, qty_estat)
  - dim_country.parquet        (code, iso3, name, continent, is_brazil)
  - dim_state.parquet          (uf, name, region)
  - dim_chapter.parquet        (code, description, section_code)
  - dim_section.parquet        (code, description, roman)
  - dim_product.parquet        (ncm, description, chapter_code)

Source data uses `;` as separator and latin-1 encoding.
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import typer
from rich.console import Console

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
STAGING = ROOT / "data" / "staging"

console = Console()
app = typer.Typer(add_completion=False)


@app.command()
def main(
    year: list[int] = typer.Option(..., "--year", "-y", help="Year(s) to process. Repeatable."),
) -> None:
    """Aggregate raw CSVs into parquet fact + dimension tables."""
    STAGING.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")

    # ----- dimension tables (load once, same for every year) -----
    console.print("[bold]Loading dimension tables[/]")
    # Comex CSVs use ';' separator, latin-1, and mix quoted/unquoted fields.
    # strict_mode=false tolerates the inconsistency; all_varchar=true avoids
    # type-inference failures on columns that are mostly numeric but sometimes empty.
    csv_opts = (
        "delim=';', header=true, encoding='latin-1', "
        "strict_mode=false, all_varchar=true, quote='\"', escape='\"', "
        "ignore_errors=true"
    )

    con.execute(
        f"""
        CREATE TABLE ncm AS
        SELECT
            CO_NCM AS ncm,
            NO_NCM_POR AS description,
            substr(lpad(CO_NCM, 8, '0'), 1, 2) AS chapter_code
        FROM read_csv('{RAW}/NCM.csv', {csv_opts});
        """
    )
    con.execute(
        f"""
        CREATE TABLE pais AS
        SELECT
            CO_PAIS AS code,
            NO_PAIS AS name,
            CO_PAIS_ISOA3 AS iso3
        FROM read_csv('{RAW}/PAIS.csv', {csv_opts});
        """
    )
    # UF file: CO_UF, SG_UF, NO_UF, NO_REGIAO
    con.execute(
        f"""
        CREATE TABLE uf AS
        SELECT
            SG_UF AS uf,
            NO_UF AS name,
            NO_REGIAO AS region_raw
        FROM read_csv('{RAW}/UF.csv', {csv_opts});
        """
    )

    # ----- dim parquet outputs -----
    (STAGING / "dim_country.parquet").unlink(missing_ok=True)
    con.execute(
        f"""
        COPY (
          SELECT
            code,
            iso3,
            name,
            CASE WHEN iso3 = 'BRA' THEN true ELSE false END AS is_brazil
          FROM pais
          WHERE code IS NOT NULL
        ) TO '{STAGING}/dim_country.parquet' (FORMAT PARQUET);
        """
    )

    con.execute(
        f"""
        COPY (
          SELECT
            uf,
            name,
            -- Normalize "REGIAO NORTE" -> "Norte"
            CASE upper(region_raw)
              WHEN 'REGIAO NORTE' THEN 'Norte'
              WHEN 'REGIAO NORDESTE' THEN 'Nordeste'
              WHEN 'REGIAO CENTRO-OESTE' THEN 'Centro-Oeste'
              WHEN 'REGIAO SUDESTE' THEN 'Sudeste'
              WHEN 'REGIAO SUL' THEN 'Sul'
              WHEN 'REGIAO NAO DECLARADA' THEN 'Não Declarada'
              ELSE coalesce(region_raw, 'Outros')
            END AS region
          FROM uf
          WHERE uf IS NOT NULL
        ) TO '{STAGING}/dim_state.parquet' (FORMAT PARQUET);
        """
    )

    con.execute(
        f"""
        COPY (
          SELECT DISTINCT
            chapter_code AS code,
            first(description) AS description
          FROM ncm
          WHERE chapter_code IS NOT NULL
          GROUP BY chapter_code
        ) TO '{STAGING}/dim_chapter.parquet' (FORMAT PARQUET);
        """
    )

    con.execute(
        f"""
        COPY (
          SELECT
            ncm,
            description,
            chapter_code
          FROM ncm
          WHERE ncm IS NOT NULL
        ) TO '{STAGING}/dim_product.parquet' (FORMAT PARQUET);
        """
    )

    # NCM sections (I..XXI) — chapter_code → section_code mapping is standard:
    section_map_rows = [
        ("I", "01", "05", "Animais vivos e produtos do reino animal"),
        ("II", "06", "14", "Produtos do reino vegetal"),
        ("III", "15", "15", "Gorduras, óleos e ceras"),
        ("IV", "16", "24", "Alimentos, bebidas, tabaco"),
        ("V", "25", "27", "Produtos minerais"),
        ("VI", "28", "38", "Produtos químicos"),
        ("VII", "39", "40", "Plásticos e borracha"),
        ("VIII", "41", "43", "Peles, couros e artefatos"),
        ("IX", "44", "46", "Madeira, cortiça"),
        ("X", "47", "49", "Celulose, papel, impressos"),
        ("XI", "50", "63", "Têxteis e vestuário"),
        ("XII", "64", "67", "Calçados, chapéus"),
        ("XIII", "68", "70", "Pedras, cerâmica, vidro"),
        ("XIV", "71", "71", "Metais preciosos, joias"),
        ("XV", "72", "83", "Metais comuns e manufaturas"),
        ("XVI", "84", "85", "Máquinas e equipamentos elétricos"),
        ("XVII", "86", "89", "Veículos, aeronaves, embarcações"),
        ("XVIII", "90", "92", "Instrumentos de precisão"),
        ("XIX", "93", "93", "Armas e munições"),
        ("XX", "94", "96", "Mercadorias diversas"),
        ("XXI", "97", "97", "Objetos de arte e antiguidades"),
    ]
    con.execute("CREATE TABLE section_range (roman VARCHAR, ch_from VARCHAR, ch_to VARCHAR, description VARCHAR)")
    con.executemany("INSERT INTO section_range VALUES (?, ?, ?, ?)", section_map_rows)

    con.execute(
        f"""
        COPY (
          SELECT
            roman AS code,
            description,
            roman
          FROM section_range
        ) TO '{STAGING}/dim_section.parquet' (FORMAT PARQUET);
        """
    )

    console.print(f"[green]dim tables written to {STAGING}[/]")

    # ----- fact table per year -----
    years = sorted(set(year))
    for y in years:
        exp_path = RAW / f"EXP_{y}.csv"
        imp_path = RAW / f"IMP_{y}.csv"
        if not exp_path.exists() or not imp_path.exists():
            raise typer.BadParameter(f"Missing CSVs for year {y} in {RAW}")

        console.print(f"[bold]Aggregating year {y}[/]")
        out = STAGING / f"tradeflows_{y}.parquet"
        out.unlink(missing_ok=True)

        con.execute(
            f"""
            COPY (
              WITH combined AS (
                SELECT
                  CAST(CO_ANO AS INTEGER) AS year,
                  'EXP' AS direction,
                  SG_UF_NCM AS uf,
                  CO_PAIS AS country_code,
                  substr(lpad(CO_NCM, 8, '0'), 1, 2) AS chapter,
                  TRY_CAST(VL_FOB AS BIGINT)    AS fob_usd,
                  TRY_CAST(KG_LIQUIDO AS BIGINT) AS kg_liquido,
                  TRY_CAST(QT_ESTAT AS BIGINT)   AS qty_estat
                FROM read_csv('{exp_path}', {csv_opts})
                UNION ALL
                SELECT
                  CAST(CO_ANO AS INTEGER) AS year,
                  'IMP' AS direction,
                  SG_UF_NCM AS uf,
                  CO_PAIS AS country_code,
                  substr(lpad(CO_NCM, 8, '0'), 1, 2) AS chapter,
                  TRY_CAST(VL_FOB AS BIGINT)    AS fob_usd,
                  TRY_CAST(KG_LIQUIDO AS BIGINT) AS kg_liquido,
                  TRY_CAST(QT_ESTAT AS BIGINT)   AS qty_estat
                FROM read_csv('{imp_path}', {csv_opts})
              )
              SELECT
                year,
                direction,
                uf,
                country_code,
                chapter,
                sum(fob_usd)    AS fob_usd,
                sum(kg_liquido) AS kg_liquido,
                sum(qty_estat)  AS qty_estat
              FROM combined
              WHERE uf IS NOT NULL
                AND country_code IS NOT NULL
                AND chapter IS NOT NULL
              GROUP BY year, direction, uf, country_code, chapter
            ) TO '{out}' (FORMAT PARQUET);
            """
        )
        rowcount = con.execute(f"SELECT count(*) FROM read_parquet('{out}')").fetchone()[0]
        total_fob = con.execute(
            f"SELECT sum(fob_usd) FROM read_parquet('{out}') WHERE direction='EXP'"
        ).fetchone()[0]
        console.print(f"  [green]{y}[/]: {rowcount:,} trade flows written, EXP total = ${total_fob:,}")


if __name__ == "__main__":
    app()
