import { pool } from '../config/database';
import { PoolClient, QueryResult } from 'pg';

export class BaseModel {
  protected static pool = pool;

  protected static async query(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }

  protected static async queryWithClient(
    client: PoolClient,
    text: string,
    params?: any[]
  ): Promise<QueryResult> {
    return client.query(text, params);
  }
}
