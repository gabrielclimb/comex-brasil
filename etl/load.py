"""Load staging parquet into Neo4j.

Order:
  1. apply schema.cypher (constraints + indexes)
  2. MERGE dim nodes (Country, State, Chapter, Section, Year, Product)
  3. MERGE Product -> Chapter -> Section taxonomy edges
  4. For each year: MERGE TradeFlow facts + relationships in batches
"""
from __future__ import annotations

import os
from pathlib import Path

import duckdb
import typer
from neo4j import GraphDatabase
from rich.console import Console
from rich.progress import Progress, BarColumn, TimeElapsedColumn

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "data" / "staging"
CYPHER = Path(__file__).resolve().parent / "cypher"

console = Console()
app = typer.Typer(add_completion=False)


def _driver():
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
    user = os.environ.get("NEO4J_USER", "neo4j")
    password = os.environ["NEO4J_PASSWORD"]
    return GraphDatabase.driver(uri, auth=(user, password))


def _apply_schema(session) -> None:
    for stmt in (CYPHER / "schema.cypher").read_text().split(";"):
        stmt = stmt.strip()
        if not stmt or stmt.startswith("//"):
            continue
        session.run(stmt)


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _load_dimensions(session, con: duckdb.DuckDBPyConnection) -> None:
    console.print("[bold]Loading dimensions[/]")

    # Country
    countries = con.execute(
        f"SELECT code, iso3, name, is_brazil FROM read_parquet('{STAGING}/dim_country.parquet')"
    ).fetchall()
    session.run(
        """
        UNWIND $rows AS row
        MERGE (c:Country {code: row.code})
        SET c.iso3 = row.iso3, c.name = row.name, c.is_brazil = row.is_brazil
        """,
        rows=[{"code": c[0], "iso3": c[1], "name": c[2], "is_brazil": c[3]} for c in countries],
    )
    console.print(f"  countries: {len(countries):,}")

    # State
    states = con.execute(
        f"SELECT uf, name, region FROM read_parquet('{STAGING}/dim_state.parquet')"
    ).fetchall()
    session.run(
        """
        UNWIND $rows AS row
        MERGE (s:State {uf: row.uf})
        SET s.name = row.name, s.region = row.region
        """,
        rows=[{"uf": s[0], "name": s[1], "region": s[2]} for s in states],
    )
    console.print(f"  states: {len(states):,}")

    # Section
    sections = con.execute(
        f"SELECT code, description, roman FROM read_parquet('{STAGING}/dim_section.parquet')"
    ).fetchall()
    session.run(
        """
        UNWIND $rows AS row
        MERGE (s:Section {code: row.code})
        SET s.description = row.description, s.roman = row.roman
        """,
        rows=[{"code": s[0], "description": s[1], "roman": s[2]} for s in sections],
    )
    console.print(f"  sections: {len(sections):,}")

    # Chapter — and link to Section via chapter code ranges
    chapters = con.execute(
        f"""
        WITH section_range(roman, ch_from, ch_to) AS (
            VALUES
            ('I','01','05'), ('II','06','14'), ('III','15','15'), ('IV','16','24'),
            ('V','25','27'), ('VI','28','38'), ('VII','39','40'), ('VIII','41','43'),
            ('IX','44','46'), ('X','47','49'), ('XI','50','63'), ('XII','64','67'),
            ('XIII','68','70'), ('XIV','71','71'), ('XV','72','83'), ('XVI','84','85'),
            ('XVII','86','89'), ('XVIII','90','92'), ('XIX','93','93'), ('XX','94','96'),
            ('XXI','97','97')
        )
        SELECT
            ch.code,
            ch.description,
            sr.roman AS section_code
        FROM read_parquet('{STAGING}/dim_chapter.parquet') ch
        LEFT JOIN section_range sr
            ON ch.code BETWEEN sr.ch_from AND sr.ch_to
        """
    ).fetchall()
    session.run(
        """
        UNWIND $rows AS row
        MERGE (ch:Chapter {code: row.code})
        SET ch.description = row.description
        WITH ch, row
        MATCH (sec:Section {code: row.section_code})
        MERGE (ch)-[:IN_SECTION]->(sec)
        """,
        rows=[{"code": c[0], "description": c[1], "section_code": c[2]} for c in chapters],
    )
    console.print(f"  chapters: {len(chapters):,} (linked to sections)")

    # Product -> Chapter edges (deferred: only load NCM-8s seen in facts to avoid 10k dangling nodes)
    # Skipped for now; re-enable by passing --with-products


def _load_facts(session, con: duckdb.DuckDBPyConnection, year: int, batch_size: int) -> None:
    parquet = STAGING / f"tradeflows_{year}.parquet"
    if not parquet.exists():
        raise typer.BadParameter(f"Missing {parquet}")

    rows = con.execute(
        f"""
        SELECT year, direction, uf, country_code, chapter, fob_usd, kg_liquido, qty_estat
        FROM read_parquet('{parquet}')
        """
    ).fetchall()
    console.print(f"[bold]Year {year}[/]: {len(rows):,} trade flows to load")

    # MERGE Year node once
    session.run("MERGE (:Year {value: $year})", year=year)

    payload = [
        {
            "year": r[0],
            "direction": r[1],
            "uf": r[2],
            "country": r[3],
            "chapter": r[4],
            "fob_usd": int(r[5] or 0),
            "kg_liquido": int(r[6] or 0),
            "qty_estat": int(r[7] or 0),
        }
        for r in rows
    ]

    cypher = """
    UNWIND $rows AS row
    MATCH (s:State {uf: row.uf})
    MATCH (c:Country {code: row.country})
    MATCH (ch:Chapter {code: row.chapter})
    MATCH (y:Year {value: row.year})
    CREATE (tf:TradeFlow {
        year: row.year,
        direction: row.direction,
        fob_usd: row.fob_usd,
        kg_liquido: row.kg_liquido,
        qty_estat: row.qty_estat
    })
    CREATE (tf)-[:FROM_STATE]->(s)
    CREATE (tf)-[:TO_COUNTRY]->(c)
    CREATE (tf)-[:OF_CHAPTER]->(ch)
    CREATE (tf)-[:IN_YEAR]->(y)
    """

    with Progress(
        "[progress.description]{task.description}",
        BarColumn(),
        "{task.completed:,}/{task.total:,}",
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task(f"load {year}", total=len(payload))
        for chunk in _chunks(payload, batch_size):
            session.run(cypher, rows=chunk)
            progress.update(task, advance=len(chunk))


@app.command()
def main(
    year: list[int] = typer.Option(..., "--year", "-y", help="Year(s) to load. Repeatable."),
    skip_schema: bool = typer.Option(False, "--skip-schema", help="Don't re-apply schema.cypher"),
    skip_dimensions: bool = typer.Option(False, "--skip-dimensions", help="Don't reload dim nodes"),
    batch_size: int = typer.Option(5000, "--batch-size", help="Rows per UNWIND chunk"),
) -> None:
    """Load parquet staging into Neo4j."""
    con = duckdb.connect(":memory:")

    with _driver() as driver:
        with driver.session() as session:
            if not skip_schema:
                console.print("[bold]Applying schema.cypher[/]")
                _apply_schema(session)
            if not skip_dimensions:
                _load_dimensions(session, con)
            for y in sorted(set(year)):
                _load_facts(session, con, y, batch_size)

    console.print("[green]Done.[/]")


if __name__ == "__main__":
    app()
