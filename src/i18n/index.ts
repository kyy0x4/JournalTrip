import { id, type TranslationKey } from './id';
import { en } from './en';
import { ja } from './ja';
import { DEFAULT_LANGUAGE, LANGUAGE_META, type Language } from './languages';

export * from './languages';
export { id as idDictionary };
export type { TranslationKey };

export const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { id, en, ja };

export type TranslationVars = Record<string, string | number>;

/**
 * Terjemahin `key` ke `lang`, ganti placeholder `{nama}` dari `vars`.
 * Key yang belum ada di kamus tujuan → fallback ke bahasa Indonesia biar UI
 * nggak pernah nongol kosong.
 */
export function translate(lang: Language, key: TranslationKey, vars?: TranslationVars): string {
  const text = DICTIONARIES[lang]?.[key] || id[key] || key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : match,
  );
}

export const localeOf = (lang: Language): string => LANGUAGE_META[lang].locale;

export { DEFAULT_LANGUAGE, LANGUAGE_META };
