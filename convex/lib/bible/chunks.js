import { BOOK_BY_ID } from "./books.js";

export function chunkBibleVerses(verses, { maxVerses = 5, maxCharacters = 1800 } = {}) {
  const ordered = [...verses].sort((a, b) =>
    (BOOK_BY_ID[a.bookId]?.order ?? Number.MAX_SAFE_INTEGER) - (BOOK_BY_ID[b.bookId]?.order ?? Number.MAX_SAFE_INTEGER)
    || a.chapter - b.chapter
    || a.verse - b.verse
  );
  const chunks = [];
  let current = null;

  const flush = () => {
    if (current) chunks.push(current);
    current = null;
  };

  for (const verse of ordered) {
    const line = `${verse.verse}. ${verse.text.trim()}`;
    if (!line || line.length > maxCharacters) throw new Error(`Verset trop long pour l'indexation : ${verse.bookId} ${verse.chapter}:${verse.verse}.`);
    const sameChapter = current?.bookId === verse.bookId && current.chapter === verse.chapter;
    const isNextVerse = sameChapter && verse.verse === current.verseEnd + 1;
    const exceedsSize = current && (current.text.length + line.length + 1 > maxCharacters || current.verseEnd - current.verseStart + 1 >= maxVerses);
    if (current && (!isNextVerse || exceedsSize)) flush();

    if (!current) {
      current = {
        bookId: verse.bookId,
        chapter: verse.chapter,
        verseStart: verse.verse,
        verseEnd: verse.verse,
        text: line,
      };
    } else {
      current.verseEnd = verse.verse;
      current.text += `\n${line}`;
    }
  }
  flush();
  return chunks;
}
