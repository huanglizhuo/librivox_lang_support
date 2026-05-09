import { PoolClient } from 'pg';
import { LibriVoxGenre, parseLibriVoxId } from '../types/librivox.types';
import { batchUpsert } from './utils/batchUpsert';

export class Genre {
  static async upsertBatch(genres: LibriVoxGenre[], client: PoolClient): Promise<void> {
    await batchUpsert(
      client, 'genres',
      genres.filter(g => parseLibriVoxId(g.id) !== null),
      ['id', 'name'],
      g => [parseLibriVoxId(g.id)!, g.name],
    );
  }
}
