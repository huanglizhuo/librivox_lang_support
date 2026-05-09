import { PoolClient } from 'pg';

export async function batchUpsert<T>(
  client: PoolClient,
  table: string,
  items: T[],
  columns: string[],
  getValues: (item: T) => (number | string | null | undefined)[],
): Promise<void> {
  if (!items || items.length === 0) return;

  const updateCols = columns.filter(c => c !== 'id');
  const setClauses = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const colList = columns.join(', ');
  const paramList = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO ${table} (${colList})
    VALUES (${paramList})
    ON CONFLICT (id) DO UPDATE SET ${setClauses}
  `;

  for (const item of items) {
    await client.query(sql, getValues(item));
  }
}
