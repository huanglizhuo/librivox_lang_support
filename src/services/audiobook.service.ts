import { pool } from '../config/database';

export interface AudiobookListParams {
  language: string;
  page?: number;
  limit?: number;
  sort?: 'title' | 'updated_at';
  order?: 'asc' | 'desc';
}

export class AudiobookService {
  async list(params: AudiobookListParams) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sort = params.sort || 'title';
    const order = params.order || 'asc';

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM audiobooks WHERE language = $1',
      [params.language]
    );
    const total = parseInt(countResult.rows[0].total);

    const booksResult = await pool.query(
      `SELECT
        a.*,
        json_agg(
          json_build_object(
            'id', au.id,
            'first_name', au.first_name,
            'last_name', au.last_name
          )
        ) FILTER (WHERE au.id IS NOT NULL) as authors
       FROM audiobooks a
       LEFT JOIN audiobook_authors aa ON a.id = aa.audiobook_id
       LEFT JOIN authors au ON aa.author_id = au.id
       WHERE a.language = $1
       GROUP BY a.id
       ORDER BY a.${sort} ${order}
       LIMIT $2 OFFSET $3`,
      [params.language, limit, offset]
    );

    return {
      data: booksResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const bookResult = await pool.query(
      'SELECT * FROM audiobooks WHERE id = $1',
      [id]
    );

    if (bookResult.rows.length === 0) {
      return null;
    }

    const book = bookResult.rows[0];

    const authorsResult = await pool.query(
      `SELECT a.* FROM authors a
       JOIN audiobook_authors aa ON a.id = aa.author_id
       WHERE aa.audiobook_id = $1`,
      [id]
    );

    const genresResult = await pool.query(
      `SELECT g.* FROM genres g
       JOIN audiobook_genres ag ON g.id = ag.genre_id
       WHERE ag.audiobook_id = $1`,
      [id]
    );

    const translatorsResult = await pool.query(
      `SELECT t.* FROM translators t
       JOIN audiobook_translators at ON t.id = at.translator_id
       WHERE at.audiobook_id = $1`,
      [id]
    );

    const sectionsResult = await pool.query(
      `SELECT
        s.*,
        json_agg(
          json_build_object(
            'id', r.id,
            'display_name', r.display_name
          )
        ) FILTER (WHERE r.id IS NOT NULL) as readers
       FROM sections s
       LEFT JOIN section_readers sr ON s.id = sr.section_id
       LEFT JOIN readers r ON sr.reader_id = r.id
       WHERE s.audiobook_id = $1
       GROUP BY s.id
       ORDER BY s.section_number`,
      [id]
    );

    return {
      ...book,
      authors: authorsResult.rows,
      genres: genresResult.rows,
      translators: translatorsResult.rows,
      sections: sectionsResult.rows,
    };
  }
  async getLanguageStats() {
    const result = await pool.query(
      'SELECT language, COUNT(*)::int as count FROM audiobooks GROUP BY language ORDER BY count DESC'
    );
    return result.rows;
  }
}
