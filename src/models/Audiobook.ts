import { BaseModel } from './BaseModel';
import { LibriVoxBook, LibriVoxAuthor, LibriVoxGenre, LibriVoxTranslator, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';

export class Audiobook extends BaseModel {
  static async upsert(
    book: LibriVoxBook,
    client: PoolClient
  ): Promise<void> {
    const id = parseLibriVoxId(book.id);
    if (!id) throw new Error(`Invalid book id: ${book.id}`);

    await this.queryWithClient(
      client,
      `INSERT INTO audiobooks (
         id, title, description, url_text_source, language,
         copyright_year, num_sections, url_rss, url_zip_file,
         url_project, url_librivox, url_other, url_iarchive,
         totaltime, totaltimesecs, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         url_text_source = EXCLUDED.url_text_source,
         language = EXCLUDED.language,
         copyright_year = EXCLUDED.copyright_year,
         num_sections = EXCLUDED.num_sections,
         url_rss = EXCLUDED.url_rss,
         url_zip_file = EXCLUDED.url_zip_file,
         url_project = EXCLUDED.url_project,
         url_librivox = EXCLUDED.url_librivox,
         url_other = EXCLUDED.url_other,
         url_iarchive = EXCLUDED.url_iarchive,
         totaltime = EXCLUDED.totaltime,
         totaltimesecs = EXCLUDED.totaltimesecs,
         updated_at = NOW()`,
      [
        id,
        book.title,
        book.description,
        book.url_text_source,
        book.language,
        book.copyright_year,
        parseLibriVoxId(book.num_sections),
        book.url_rss,
        book.url_zip_file,
        book.url_project,
        book.url_librivox,
        book.url_other,
        book.url_iarchive,
        book.totaltime,
        book.totaltimesecs
      ]
    );
  }

  static async linkAuthors(
    audiobookId: number,
    authors: LibriVoxAuthor[],
    client: PoolClient
  ): Promise<void> {
    // Delete existing relationships
    await this.queryWithClient(
      client,
      'DELETE FROM audiobook_authors WHERE audiobook_id = $1',
      [audiobookId]
    );

    // Insert new relationships
    for (const author of authors) {
      const authorId = parseLibriVoxId(author.id);
      if (!authorId) continue;

      await this.queryWithClient(
        client,
        'INSERT INTO audiobook_authors (audiobook_id, author_id) VALUES ($1, $2)',
        [audiobookId, authorId]
      );
    }
  }

  static async linkGenres(
    audiobookId: number,
    genres: LibriVoxGenre[],
    client: PoolClient
  ): Promise<void> {
    // Delete existing relationships
    await this.queryWithClient(
      client,
      'DELETE FROM audiobook_genres WHERE audiobook_id = $1',
      [audiobookId]
    );

    // Insert new relationships
    for (const genre of genres) {
      const genreId = parseLibriVoxId(genre.id);
      if (!genreId) continue;

      await this.queryWithClient(
        client,
        'INSERT INTO audiobook_genres (audiobook_id, genre_id) VALUES ($1, $2)',
        [audiobookId, genreId]
      );
    }
  }

  static async linkTranslators(
    audiobookId: number,
    translators: LibriVoxTranslator[],
    client: PoolClient
  ): Promise<void> {
    // Delete existing relationships
    await this.queryWithClient(
      client,
      'DELETE FROM audiobook_translators WHERE audiobook_id = $1',
      [audiobookId]
    );

    // Insert new relationships
    for (const translator of translators) {
      const translatorId = parseLibriVoxId(translator.id);
      if (!translatorId) continue;

      await this.queryWithClient(
        client,
        'INSERT INTO audiobook_translators (audiobook_id, translator_id) VALUES ($1, $2)',
        [audiobookId, translatorId]
      );
    }
  }
}
