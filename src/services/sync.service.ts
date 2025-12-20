import { LibriVoxBook, LibriVoxReader, parseLibriVoxId } from '../types/librivox.types';
import { PoolClient } from 'pg';
import { withTransaction } from '../config/database';
import { Author } from '../models/Author';
import { Reader } from '../models/Reader';
import { Genre } from '../models/Genre';
import { Translator } from '../models/Translator';
import { Audiobook } from '../models/Audiobook';
import { Section } from '../models/Section';
import logger from '../utils/logger';

export class SyncService {
  async syncBook(book: LibriVoxBook, client: PoolClient): Promise<void> {
    const bookId = parseLibriVoxId(book.id);
    if (!bookId) {
      logger.warn('Skipping book with invalid ID', { book });
      return;
    }

    // Note: All text fields are now TEXT (unlimited) - no length validation needed

    try {
      // Step 1: Upsert independent entities in parallel
      await Promise.all([
        Author.upsertBatch(book.authors || [], client),
        Reader.upsertBatch(this.extractReaders(book), client),
        Genre.upsertBatch(book.genres || [], client),
        Translator.upsertBatch(book.translators || [], client),
      ]);

      // Step 2: Upsert the audiobook
      await Audiobook.upsert(book, client);

      // Step 3: Link relationships
      await Promise.all([
        Audiobook.linkAuthors(bookId, book.authors || [], client),
        Audiobook.linkGenres(bookId, book.genres || [], client),
        Audiobook.linkTranslators(bookId, book.translators || [], client),
      ]);

      // Step 4: Upsert sections (this handles section_readers internally)
      if (book.sections) {
        await Section.upsertBatch(bookId, book.sections, client);
      }

      logger.debug('Successfully synced book', { bookId, title: book.title });
    } catch (error: any) {
      // Enhanced error logging for debugging
      logger.error('Failed to sync book - detailed info', {
        bookId,
        title: book.title,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetail: error.detail,
        errorHint: error.hint,
        errorPosition: error.position,
        errorWhere: error.where,
        bookData: {
          id: book.id,
          title: book.title?.substring(0, 100),
          language: book.language,
          num_sections: book.num_sections,
          authors_count: book.authors?.length || 0,
          sections_count: book.sections?.length || 0,
        }
      });
      throw error;
    }
  }

  private extractReaders(book: LibriVoxBook): LibriVoxReader[] {
    if (!book.sections) return [];

    const readerMap = new Map<string, LibriVoxReader>();

    for (const section of book.sections) {
      if (section.readers) {
        for (const reader of section.readers) {
          readerMap.set(reader.reader_id, reader);
        }
      }
    }

    return Array.from(readerMap.values());
  }

  async syncBatch(books: LibriVoxBook[]): Promise<void> {
    await withTransaction(async (client) => {
      for (const book of books) {
        await this.syncBook(book, client);
      }
    });
  }
}
