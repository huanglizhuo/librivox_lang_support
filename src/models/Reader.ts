import { PoolClient } from 'pg';
import { LibriVoxReader, parseLibriVoxId } from '../types/librivox.types';
import { batchUpsert } from './utils/batchUpsert';

export class Reader {
  static async upsertBatch(readers: LibriVoxReader[], client: PoolClient): Promise<void> {
    await batchUpsert(
      client, 'readers',
      readers.filter(r => parseLibriVoxId(r.reader_id) !== null),
      ['id', 'display_name'],
      r => [parseLibriVoxId(r.reader_id)!, r.display_name],
    );
  }
}
