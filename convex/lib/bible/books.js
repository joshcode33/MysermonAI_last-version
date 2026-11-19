// Catalogue canonique des 66 livres (ordre protestant). Les nombres de chapitres sont
// indicatifs : la navigation réelle repose sur les versets effectivement importés.
// Champs : id (code stable), name (français), abbr (abréviation usuelle), chapters, testament.
export const BOOKS = [
  ["GEN", "Genèse", "Gn", 50, "AT"], ["EXO", "Exode", "Ex", 40, "AT"],
  ["LEV", "Lévitique", "Lv", 27, "AT"], ["NUM", "Nombres", "Nb", 36, "AT"],
  ["DEU", "Deutéronome", "Dt", 34, "AT"], ["JOS", "Josué", "Jos", 24, "AT"],
  ["JDG", "Juges", "Jg", 21, "AT"], ["RUT", "Ruth", "Rt", 4, "AT"],
  ["1SA", "1 Samuel", "1 S", 31, "AT"], ["2SA", "2 Samuel", "2 S", 24, "AT"],
  ["1KI", "1 Rois", "1 R", 22, "AT"], ["2KI", "2 Rois", "2 R", 25, "AT"],
  ["1CH", "1 Chroniques", "1 Ch", 29, "AT"], ["2CH", "2 Chroniques", "2 Ch", 36, "AT"],
  ["EZR", "Esdras", "Esd", 10, "AT"], ["NEH", "Néhémie", "Né", 13, "AT"],
  ["EST", "Esther", "Est", 10, "AT"], ["JOB", "Job", "Job", 42, "AT"],
  ["PSA", "Psaumes", "Ps", 150, "AT"], ["PRO", "Proverbes", "Pr", 31, "AT"],
  ["ECC", "Ecclésiaste", "Ec", 12, "AT"], ["SNG", "Cantique des cantiques", "Ct", 8, "AT"],
  ["ISA", "Ésaïe", "Es", 66, "AT"], ["JER", "Jérémie", "Jé", 52, "AT"],
  ["LAM", "Lamentations", "Lm", 5, "AT"], ["EZK", "Ézéchiel", "Éz", 48, "AT"],
  ["DAN", "Daniel", "Da", 12, "AT"], ["HOS", "Osée", "Os", 14, "AT"],
  ["JOL", "Joël", "Jl", 3, "AT"], ["AMO", "Amos", "Am", 9, "AT"],
  ["OBA", "Abdias", "Ab", 1, "AT"], ["JON", "Jonas", "Jon", 4, "AT"],
  ["MIC", "Michée", "Mi", 7, "AT"], ["NAM", "Nahum", "Na", 3, "AT"],
  ["HAB", "Habacuc", "Ha", 3, "AT"], ["ZEP", "Sophonie", "So", 3, "AT"],
  ["HAG", "Aggée", "Ag", 2, "AT"], ["ZEC", "Zacharie", "Za", 14, "AT"],
  ["MAL", "Malachie", "Mal", 4, "AT"],
  ["MAT", "Matthieu", "Mt", 28, "NT"], ["MRK", "Marc", "Mc", 16, "NT"],
  ["LUK", "Luc", "Lc", 24, "NT"], ["JHN", "Jean", "Jn", 21, "NT"],
  ["ACT", "Actes", "Ac", 28, "NT"], ["ROM", "Romains", "Rm", 16, "NT"],
  ["1CO", "1 Corinthiens", "1 Co", 16, "NT"], ["2CO", "2 Corinthiens", "2 Co", 13, "NT"],
  ["GAL", "Galates", "Ga", 6, "NT"], ["EPH", "Éphésiens", "Ép", 6, "NT"],
  ["PHP", "Philippiens", "Ph", 4, "NT"], ["COL", "Colossiens", "Col", 4, "NT"],
  ["1TH", "1 Thessaloniciens", "1 Th", 5, "NT"], ["2TH", "2 Thessaloniciens", "2 Th", 3, "NT"],
  ["1TI", "1 Timothée", "1 Ti", 6, "NT"], ["2TI", "2 Timothée", "2 Ti", 4, "NT"],
  ["TIT", "Tite", "Tt", 3, "NT"], ["PHM", "Philémon", "Phm", 1, "NT"],
  ["HEB", "Hébreux", "Hé", 13, "NT"], ["JAS", "Jacques", "Jc", 5, "NT"],
  ["1PE", "1 Pierre", "1 P", 5, "NT"], ["2PE", "2 Pierre", "2 P", 3, "NT"],
  ["1JN", "1 Jean", "1 Jn", 5, "NT"], ["2JN", "2 Jean", "2 Jn", 1, "NT"],
  ["3JN", "3 Jean", "3 Jn", 1, "NT"], ["JUD", "Jude", "Jud", 1, "NT"],
  ["REV", "Apocalypse", "Ap", 22, "NT"],
].map(([id, name, abbr, chapters, testament], index) => ({ id, name, abbr, chapters, testament, order: index + 1 }));

export const BOOK_BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const isBookId = (id) => Object.hasOwn(BOOK_BY_ID, id);
