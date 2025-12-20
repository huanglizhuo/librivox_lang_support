import { BaseModel } from './BaseModel';
import { LibriVoxSection, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';
import { Reader } from './Reader';

export class Section extends BaseModel {
  static async upsertBatch(
    audiobookId: number,
    sections: LibriVoxSection[],
    client: PoolClient
  ): Promise<void> {
    if (!sections || sections.length === 0) return;

    // Delete existing sections (cascade will delete section_readers)
    await this.queryWithClient(
      client,
      'DELETE FROM sections WHERE audiobook_id = $1',
      [audiobookId]
    );

    // Insert new sections
    for (const section of sections) {
      const sectionId = parseLibriVoxId(section.id);
      if (!sectionId) continue;

      await this.queryWithClient(
        client,
        `INSERT INTO sections (id, audiobook_id, section_number, title, listen_url, language, playtime, file_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sectionId,
          audiobookId,
          parseLibriVoxId(section.section_number),
          section.title,
          section.listen_url,
          section.language,
          parseLibriVoxId(section.playtime),
          section.file_name
        ]
      );

      // Link readers to this section
      if (section.readers && section.readers.length > 0) {
        for (const reader of section.readers) {
          const readerId = parseLibriVoxId(reader.reader_id);
          if (!readerId) continue;

          await this.queryWithClient(
            client,
            'INSERT INTO section_readers (section_id, reader_id) VALUES ($1, $2)',
            [sectionId, readerId]
          );
        }
      }
    }
  }
}
