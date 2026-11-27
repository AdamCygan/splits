/** Tekst do porównań bez wielkości liter i polskich znaków: „Źródło” → „zrodlo”. */
export const foldText = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

/** Liczba z zerem wiodącym do dwóch cyfr: 5 → „05”. */
export const pad2 = (n: number) => String(n).padStart(2, '0')
