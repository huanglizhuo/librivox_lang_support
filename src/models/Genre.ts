import { BaseModel } from './BaseModel';
import { LibriVoxGenre, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';

export class Genre extends BaseModel {
  static async upsertBatch(
    genres: LibriVoxGenre[],
    client: PoolClient
  ): Promise<void> {
    if (!genres || genres.length === 0) return;

    for (const genre of genres) {
      const id = parseLibriVoxId(genre.id);
      if (!id) continue;

      await this.queryWithClient(
        client,
        `INSERT INTO genres (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name`,
        [id, genre.name]
      );
    }
  }
}
