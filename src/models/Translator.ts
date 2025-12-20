import { BaseModel } from './BaseModel';
import { LibriVoxTranslator, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';

export class Translator extends BaseModel {
  static async upsertBatch(
    translators: LibriVoxTranslator[],
    client: PoolClient
  ): Promise<void> {
    if (!translators || translators.length === 0) return;

    for (const translator of translators) {
      const id = parseLibriVoxId(translator.id);
      if (!id) continue;

      await this.queryWithClient(
        client,
        `INSERT INTO translators (id, first_name, last_name, dob, dod)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           dob = EXCLUDED.dob,
           dod = EXCLUDED.dod`,
        [id, translator.first_name, translator.last_name, translator.dob, translator.dod]
      );
    }
  }
}
