/**
 * src/lib/neo4j.ts
 * Neo4j stores the graph metadata and supports vector search for test matching.
 */

import neo4j, { Driver } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (_driver) return _driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password)
    throw new Error("Missing Neo4j env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD");
  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 10,
  });
  return _driver;
}

export async function closeDriver(): Promise<void> {
  if (_driver) { await _driver.close(); _driver = null; }
}

async function runCypher<T = unknown>(cypher: string, params?: Record<string, unknown>) {
  const session = getDriver().session();
  try {
    return await session.run(cypher, params);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Neo4j query failed: ${message}`);
  } finally {
    await session.close();
  }
}

export interface TestNode {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  nhanes_variable: string;
  label: string;
}

export interface TestLookupResult {
  test: TestNode;
  panel: string | null;
  unit: string | null;
}

/** Get all canonical test names — used to build the list for Gemini matching */
export async function getAllTestNames(): Promise<string[]> {
  const result = await runCypher(`MATCH (t:Test) RETURN t.name AS name ORDER BY t.name`);
  return result.records.map((r) => r.get("name") as string);
}

/** Exact lookup by canonical name after Gemini has matched it */
export async function getTestByName(canonicalName: string): Promise<TestLookupResult | null> {
  const result = await runCypher(
    `MATCH (t:Test {name: $name})
     OPTIONAL MATCH (t)-[:IN_PANEL]->(p:Panel)
     OPTIONAL MATCH (t)-[:HAS_UNIT]->(u:Unit)
     RETURN t, p.name AS panel, u.name AS unit`,
    { name: canonicalName }
  );
  if (!result.records.length) return null;
  const r = result.records[0];
  const t = r.get("t").properties;
  return {
    test: {
      id: t.id,
      name: t.name,
      aliases: t.aliases ?? [],
      unit: t.unit ?? "",
      nhanes_variable: t.nhanes_variable ?? "",
      label: t.label ?? "",
    },
    panel: r.get("panel") as string | null,
    unit: r.get("unit") as string | null,
  };
}

// ── Seeding helpers ───────────────────────────────────────────────────────────

export interface TestSeedData extends TestNode {
  panel: string;
}

export async function upsertTestNode(data: TestSeedData): Promise<void> {
  await runCypher(
    `MERGE (p:Panel {name: $panel})
     MERGE (u:Unit  {name: $unit})
     MERGE (t:Test  {id: $id})
     SET t.name            = $name,
         t.aliases         = $aliases,
         t.nhanes_variable = $nhanes_variable,
         t.label           = $label
     MERGE (t)-[:IN_PANEL]->(p)
     MERGE (t)-[:HAS_UNIT]->(u)`,
    { ...data }
  );
}

export async function createSchema(): Promise<void> {
  await runCypher(
    `CREATE CONSTRAINT test_id_unique IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE`
  );
  console.log("✅ Schema created (or already exists)");
}

export async function getNeo4jVersion(): Promise<string> {
  const result = await runCypher(
    `CALL dbms.components() YIELD name, versions RETURN versions[0] AS version`
  );
  const version = result.records[0]?.get("version") as string | undefined;
  if (!version) throw new Error("Unable to detect Neo4j version");
  return version;
}

export async function createVectorIndex(dimensions: number): Promise<void> {
  const version = await getNeo4jVersion();
  const major = Number(version.split(".")[0]);

  const cypherV5 =
    `CREATE VECTOR INDEX test-embeddings IF NOT EXISTS FOR (t:Test) ON (t.embedding)
     OPTIONS { indexConfig: { \`vector.dimensions\`: $dimensions, \`vector.similarity_function\`: "cosine" } }`;

  const cypherV4 =
    `CALL gds.beta.index.createNodeIndex("test-embeddings", "Test", "embedding", $dimensions, "COSINE")`;

  try {
    if (Number.isFinite(major) && major >= 5) {
      await runCypher(cypherV5, { dimensions });
      console.log(`✅ Vector index created for Neo4j ${version}`);
    } else {
      await runCypher(cypherV4, { dimensions });
      console.log(`✅ Vector index created via GDS for Neo4j ${version}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Vector index creation failed. Tried:\n${cypherV5}\n---\n${cypherV4}\nError: ${message}`
    );
  }
}

export interface VectorSearchResult {
  id: string;
  name: string;
  score: number;
}

export async function vectorSearchTest(
  embedding: number[],
  topK = 5
): Promise<VectorSearchResult[]> {
  const version = await getNeo4jVersion();
  const major = Number(version.split(".")[0]);

  if (!Number.isFinite(major) || major < 5) {
    throw new Error(
      `Vector search query requires Neo4j 5.x+ or GDS. Detected version ${version}.`
    );
  }

  const result = await runCypher(
    `CALL db.index.vector.queryNodes("test-embeddings", $k, $embedding)
     YIELD node, score
     RETURN node.id AS id, node.name AS name, score
     ORDER BY score DESC`,
    { k: topK, embedding }
  );

  return result.records.map((r) => ({
    id: r.get("id") as string,
    name: r.get("name") as string,
    score: r.get("score") as number,
  }));
}

export async function getTestEmbeddingById(id: string): Promise<number[] | null> {
  const result = await runCypher(
    `MATCH (t:Test {id: $id}) RETURN t.embedding AS embedding`,
    { id }
  );
  if (!result.records.length) return null;
  const embedding = result.records[0].get("embedding") as number[] | null;
  if (!embedding || embedding.length === 0) return null;
  return embedding;
}

export async function setTestEmbedding(id: string, embedding: number[]): Promise<void> {
  await runCypher(
    `MATCH (t:Test {id: $id}) SET t.embedding = $embedding`,
    { id, embedding }
  );
}