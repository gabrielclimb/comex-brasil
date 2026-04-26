"""Download Comex Stat CSVs (per-year EXP/IMP + auxiliary tables).

Files land in ../data/raw/ relative to this script.
Retries on network errors; skips files that already exist unless --force.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import ssl

import httpx
import truststore
import typer
from rich.console import Console
from rich.progress import Progress, BarColumn, DownloadColumn, TimeRemainingColumn, TransferSpeedColumn

BASE = "https://balanca.economia.gov.br/balanca/bd"
YEARLY_PATH = "comexstat-bd/ncm"  # EXP_YYYY.csv / IMP_YYYY.csv live under this subpath
AUX_TABLES = ["NCM", "PAIS", "UF", "VIA", "URF"]

# SERPRO serves the gov.br cert without the intermediate CA in the TLS chain,
# so Python's default CA bundle can't verify it. truststore uses the OS trust
# store (macOS keychain has the Sectigo intermediate cached).
_SSL_CTX = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
console = Console()
app = typer.Typer(add_completion=False)


async def _download_one(
    client: httpx.AsyncClient,
    url: str,
    dest: Path,
    progress: Progress,
    force: bool,
) -> None:
    if dest.exists() and not force:
        console.print(f"[dim]skip[/] {dest.name} (exists)")
        return

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    async with client.stream("GET", url, follow_redirects=True) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0)) or None
        task_id = progress.add_task(f"[cyan]{dest.name}", total=total)
        with tmp.open("wb") as f:
            async for chunk in response.aiter_bytes(chunk_size=65536):
                f.write(chunk)
                progress.update(task_id, advance=len(chunk))
        progress.remove_task(task_id)

    tmp.rename(dest)


async def _download_all(years: list[int], force: bool) -> None:
    targets: list[tuple[str, Path]] = []
    for year in years:
        for direction in ("EXP", "IMP"):
            name = f"{direction}_{year}.csv"
            targets.append((f"{BASE}/{YEARLY_PATH}/{name}", DATA_DIR / name))
    for aux in AUX_TABLES:
        name = f"{aux}.csv"
        targets.append((f"{BASE}/tabelas/{name}", DATA_DIR / name))

    transport = httpx.AsyncHTTPTransport(retries=3, verify=_SSL_CTX)
    timeout = httpx.Timeout(connect=10.0, read=120.0, write=60.0, pool=10.0)
    limits = httpx.Limits(max_connections=4)

    async with httpx.AsyncClient(transport=transport, timeout=timeout, limits=limits) as client:
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            sem = asyncio.Semaphore(4)

            async def _bounded(url: str, dest: Path) -> None:
                async with sem:
                    await _download_one(client, url, dest, progress, force)

            await asyncio.gather(*[_bounded(u, d) for u, d in targets])

    console.print(f"\n[green]Done.[/] {len(targets)} files in {DATA_DIR}")


@app.command()
def main(
    year: list[int] = typer.Option(..., "--year", "-y", help="Year(s) to download. Repeatable."),
    force: bool = typer.Option(False, "--force", help="Redownload even if file exists"),
) -> None:
    """Download EXP/IMP CSVs for each year plus auxiliary tables."""
    asyncio.run(_download_all(sorted(set(year)), force))


if __name__ == "__main__":
    app()
