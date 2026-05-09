import { PoolClient } from 'pg';
import { LibriVoxAuthor, parseLibriVoxId } from '../types/librivox.types';
import { batchUpsert } from './utils/batchUpsert';

export class Author {
  static async upsertBatch(authors: LibriVoxAuthor[], client: PoolClient): Promise<void> {
    await batchUpsert(
      client, 'authors',
      authors.filter(a => parseLibriVoxId(a.id) !== null),
      ['id', 'first_name', 'last_name', 'dob', 'dod'],
      a => [parseLibriVoxId(a.id)!, a.first_name, a.last_name, a.dob, a.dod],
    );
  }
}
