export interface LibriVoxApiResponse {
  books: LibriVoxBook[];
}

export interface LibriVoxBook {
  id: string;
  title: string;
  description: string;
  url_text_source: string;
  language: string;
  copyright_year: string;
  num_sections: string;
  url_rss: string;
  url_zip_file: string;
  url_project: string;
  url_librivox: string;
  url_other: string;
  url_iarchive?: string;
  totaltime: string;
  totaltimesecs: number;
  authors: LibriVoxAuthor[];
  sections?: LibriVoxSection[];
  genres?: LibriVoxGenre[];
  translators?: LibriVoxTranslator[];
}

export interface LibriVoxAuthor {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  dod: string;
}

export interface LibriVoxSection {
  id: string;
  section_number: string;
  title: string;
  listen_url: string;
  language: string;
  playtime: string;
  file_name: string | null;
  readers: LibriVoxReader[];
}

export interface LibriVoxReader {
  reader_id: string;
  display_name: string;
}

export interface LibriVoxGenre {
  id: string;
  name: string;
}

export interface LibriVoxTranslator {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  dod: string;
}

export function parseLibriVoxId(id: string | undefined): number | null {
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}
