import { BaseModel } from './BaseModel';
import { LibriVoxReader, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';

export class Reader extends BaseModel {
  static async upsertBatch(
    readers: LibriVoxReader[],
    client: PoolClient
  ): Promise<void> {
    if (!readers || readers.length === 0) return;

    for (const reader of readers) {
      const id = parseLibriVoxId(reader.reader_id);
      if (!id) continue;

      await this.queryWithClient(
        client,
        `INSERT INTO readers (id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name`,
        [id, reader.display_name]
      );
    }
  }
}
