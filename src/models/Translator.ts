import { PoolClient } from 'pg';
import { LibriVoxTranslator, parseLibriVoxId } from '../types/librivox.types';
import { batchUpsert } from './utils/batchUpsert';

export class Translator {
  static async upsertBatch(translators: LibriVoxTranslator[], client: PoolClient): Promise<void> {
    await batchUpsert(
      client, 'translators',
      translators.filter(t => parseLibriVoxId(t.id) !== null),
      ['id', 'first_name', 'last_name', 'dob', 'dod'],
      t => [parseLibriVoxId(t.id)!, t.first_name, t.last_name, t.dob, t.dod],
    );
  }
}
