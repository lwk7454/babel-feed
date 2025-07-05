import { createHash } from 'crypto';

export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function generateArticleHash(title: string, url: string, publishedAt: Date): string {
  const combined = `${title}|${url}|${publishedAt.toISOString()}`;
  return createHash('sha256').update(combined).digest('hex');
}

export function generateTranslationHash(
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const combined = `${sourceText}|${sourceLanguage}|${targetLanguage}`;
  return createHash('sha256').update(combined).digest('hex');
}