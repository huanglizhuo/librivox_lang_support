import { BaseModel } from './BaseModel';
import { LibriVoxAuthor, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';

export class Author extends BaseModel {
  static async upsertBatch(
    authors: LibriVoxAuthor[],
    client: PoolClient
  ): Promise<void> {
    if (!authors || authors.length === 0) return;

    for (const author of authors) {
      const id = parseLibriVoxId(author.id);
      if (!id) continue;

      await this.queryWithClient(
        client,
        `INSERT INTO authors (id, first_name, last_name, dob, dod)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           dob = EXCLUDED.dob,
           dod = EXCLUDED.dod`,
        [id, author.first_name, author.last_name, author.dob, author.dod]
      );
    }
  }
}
