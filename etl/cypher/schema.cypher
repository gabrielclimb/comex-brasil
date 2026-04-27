// Uniqueness constraints (imply indexes)
CREATE CONSTRAINT country_code IF NOT EXISTS
  FOR (c:Country) REQUIRE c.code IS UNIQUE;

CREATE CONSTRAINT state_uf IF NOT EXISTS
  FOR (s:State) REQUIRE s.uf IS UNIQUE;

CREATE CONSTRAINT product_ncm IF NOT EXISTS
  FOR (p:Product) REQUIRE p.ncm IS UNIQUE;

CREATE CONSTRAINT chapter_code IF NOT EXISTS
  FOR (ch:Chapter) REQUIRE ch.code IS UNIQUE;

CREATE CONSTRAINT section_code IF NOT EXISTS
  FOR (s:Section) REQUIRE s.code IS UNIQUE;

CREATE CONSTRAINT year_value IF NOT EXISTS
  FOR (y:Year) REQUIRE y.value IS UNIQUE;

// Composite index on TradeFlow for year+direction filtering (globe slider, sankey)
CREATE INDEX tradeflow_year_direction IF NOT EXISTS
  FOR (tf:TradeFlow) ON (tf.year, tf.direction);

// Lookup by country name for the UI (partial matches, etc.)
CREATE INDEX country_name IF NOT EXISTS
  FOR (c:Country) ON (c.name);
