// =============================================================
// Example queries — not run automatically, kept here as reference
// =============================================================

// Top 10 export destinations in 2024 (by FOB USD)
MATCH (tf:TradeFlow {year: 2024, direction: 'EXP'})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN c.name AS country, sum(tf.fob_usd) AS fob_usd
ORDER BY fob_usd DESC
LIMIT 10;

// Brazil's total export value by year
MATCH (tf:TradeFlow {direction: 'EXP'})
RETURN tf.year AS year, sum(tf.fob_usd) AS total_fob_usd
ORDER BY year;

// Top exporting UFs for a specific chapter (e.g., "12" = oil seeds/soybeans)
MATCH (tf:TradeFlow {direction: 'EXP'})-[:OF_CHAPTER]->(ch:Chapter {code: '12'})
MATCH (tf)-[:FROM_STATE]->(uf:State)
MATCH (tf)-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN uf.uf AS from_state, c.name AS to_country, sum(tf.fob_usd) AS fob_usd
ORDER BY fob_usd DESC
LIMIT 20;

// Sankey-style: UF -> Section -> Country (for a year/direction)
MATCH (tf:TradeFlow {year: 2024, direction: 'EXP'})
MATCH (tf)-[:FROM_STATE]->(uf:State)
MATCH (tf)-[:OF_CHAPTER]->(ch:Chapter)-[:IN_SECTION]->(sec:Section)
MATCH (tf)-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
RETURN uf.uf AS uf, sec.code AS section, c.name AS country, sum(tf.fob_usd) AS fob_usd;

// Graph neighborhood: countries that share >1 top chapter with Brazil
MATCH (brazil:Country {is_brazil: true})
MATCH (tf:TradeFlow {direction: 'EXP', year: 2024})-[:TO_COUNTRY]->(c:Country)
WHERE c.is_brazil = false
WITH c, collect(DISTINCT tf) AS flows
UNWIND flows AS tf
MATCH (tf)-[:OF_CHAPTER]->(ch:Chapter)
WITH c, ch, sum(tf.fob_usd) AS fob
ORDER BY fob DESC
WITH c, collect({chapter: ch.code, fob: fob})[..3] AS top3
RETURN c.name, top3
ORDER BY size(top3) DESC
LIMIT 30;
