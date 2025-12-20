import { BaseModel } from './BaseModel';

export class SyncStatus extends BaseModel {
  static async create(syncType: 'full' | 'incremental', metadata?: any): Promise<number> {
    const result = await this.query(
      `INSERT INTO sync_status (sync_type, started_at, status, synced_books, metadata)
       VALUES ($1, NOW(), 'running', 0, $2)
       RETURNING id`,
      [syncType, metadata ? JSON.stringify(metadata) : null]
    );
    return result.rows[0].id;
  }

  static async updateProgress(
    id: number,
    syncedBooks: number,
    lastOffset: number
  ): Promise<void> {
    await this.query(
      'UPDATE sync_status SET synced_books = $1, last_offset = $2 WHERE id = $3',
      [syncedBooks, lastOffset, id]
    );
  }

  static async complete(id: number, totalBooks: number): Promise<void> {
    await this.query(
      `UPDATE sync_status
       SET status = 'completed', completed_at = NOW(), total_books = $1
       WHERE id = $2`,
      [totalBooks, id]
    );
  }

  static async fail(id: number, errorMessage: string): Promise<void> {
    await this.query(
      `UPDATE sync_status
       SET status = 'failed', completed_at = NOW(), error_message = $1
       WHERE id = $2`,
      [errorMessage, id]
    );
  }

  static async getLastSuccessful(syncType?: string): Promise<any> {
    const result = await this.query(
      `SELECT * FROM sync_status
       WHERE status = 'completed'
         ${syncType ? 'AND sync_type = $1' : ''}
       ORDER BY completed_at DESC
       LIMIT 1`,
      syncType ? [syncType] : []
    );
    return result.rows[0];
  }
}
