export const LANGUAGES = ['id', 'en', 'ja'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'id';

export interface LanguageMeta {
  /** Buat aria-label / tooltip */
  name: string;
  /** Tampil di menu bahasa */
  native: string;
  flag: string;
  /** Buat toLocaleDateString / toLocaleString */
  locale: string;
  /** Buat <html lang> */
  htmlLang: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  id: { name: 'Bahasa Indonesia', native: 'Bahasa Indonesia', flag: '🇮🇩', locale: 'id-ID', htmlLang: 'id' },
  en: { name: 'English', native: 'English', flag: '🇬🇧', locale: 'en-US', htmlLang: 'en' },
  ja: { name: '日本語', native: '日本語', flag: '🇯🇵', locale: 'ja-JP', htmlLang: 'ja' },
};

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
