import { InlineKeyboard } from "grammy";
import type { Word } from "../../../domain/entities/Word.js";
import type { WordPage } from "../../../ports/IWordRepository.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { capitalizeFirst } from "../../../shared/utils/capitalizeFirst.js";

const PAGE_SIZE = 10;

export function getWordsPageSize(): number {
  return PAGE_SIZE;
}

export function wordsListKeyboard(page: WordPage): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const from = (page.page - 1) * page.pageSize + 1;

  for (const [index, word] of page.items.entries()) {
    const number = from + index;
    const label = truncate(
      `${number}. ${capitalizeFirst(word.term)} — ${capitalizeFirst(word.translation)}`,
      64,
    );
    keyboard.text(label, `w:v:${word.id}`).row();
  }

  const prevPage = Math.max(1, page.page - 1);
  const nextPage = Math.min(page.totalPages, page.page + 1);

  keyboard
    .text(page.page <= 1 ? "·" : "←", page.page <= 1 ? "w:noop" : `w:p:${prevPage}`)
    .text(`${page.page}/${page.totalPages}`, "w:noop")
    .text(page.page >= page.totalPages ? "·" : "→", page.page >= page.totalPages ? "w:noop" : `w:p:${nextPage}`)
    .row()
    .text("🗑 Выбрать для удаления", "w:bulk:on");

  return keyboard;
}

// Минимальная проекция страницы для режима выбора — только то, что нужно
// клавиатуре и подписи. Хранится в сессии (примитивы), чтобы перерисовывать
// галочки без повторного запроса списка из БД.
export type WordsPageView = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: Array<{ id: string; term: string; translation: string }>;
};

// Список в режиме массового выбора: тап по слову ставит/снимает галочку
// вместо открытия карточки. Пагинация (w:p:) общая с обычным режимом —
// showList сам решает, какую клавиатуру рисовать, по session.bulkDelete.
export function wordsSelectKeyboard(page: WordsPageView, selected: ReadonlySet<string>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const from = (page.page - 1) * page.pageSize + 1;

  for (const [index, word] of page.items.entries()) {
    const number = from + index;
    const mark = selected.has(word.id) ? "✅" : "⬜";
    const label = truncate(
      `${mark} ${number}. ${capitalizeFirst(word.term)} — ${capitalizeFirst(word.translation)}`,
      64,
    );
    keyboard.text(label, `w:bulk:t:${word.id}`).row();
  }

  const prevPage = Math.max(1, page.page - 1);
  const nextPage = Math.min(page.totalPages, page.page + 1);

  keyboard
    .text(page.page <= 1 ? "·" : "←", page.page <= 1 ? "w:noop" : `w:p:${prevPage}`)
    .text(`${page.page}/${page.totalPages}`, "w:noop")
    .text(page.page >= page.totalPages ? "·" : "→", page.page >= page.totalPages ? "w:noop" : `w:p:${nextPage}`)
    .row();

  if (selected.size > 0) {
    keyboard.text(`🗑 Удалить (${selected.size})`, "w:bulk:go").row();
  }

  return keyboard.text("✖️ Отмена", "w:bulk:off");
}

export function bulkDeleteConfirmKeyboard(count: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(`Да, удалить ${count}`, "w:bulk:ok")
    .text("← Назад", "w:bulk:back");
}

export function wordDetailKeyboard(
  wordId: string,
  listPage: number,
  hasPhoto: boolean,
): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("✏️ Слово", `w:e:term:${wordId}`)
    .text("✏️ Перевод", `w:e:tr:${wordId}`)
    .row()
    .text("✏️ Пример", `w:e:ex:${wordId}`)
    .row();

  if (hasPhoto) {
    keyboard
      .text("🖼 Показать", `w:photo:show:${wordId}`)
      .text("🔄 Заменить", `w:photo:add:${wordId}`)
      .row()
      .text("🗑 Убрать фото", `w:photo:del:${wordId}`)
      .row();
  } else {
    keyboard.text("📷 Прикрепить фото", `w:photo:add:${wordId}`).row();
  }

  return keyboard
    .text("🗑 Удалить слово", `w:del:${wordId}`)
    .row()
    .text("← К списку", `w:list:${listPage}`);
}

export function deleteConfirmKeyboard(wordId: string, listPage: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Да, удалить", `w:delok:${wordId}`)
    .text("Отмена", `w:v:${wordId}`)
    .row()
    .text("← К списку", `w:list:${listPage}`);
}

export function formatWordsPage(page: WordPage): string {
  if (page.total === 0) {
    return [
      "<b>📚 Словарь пуст</b>",
      "",
      "<i>Добавь первое слово через</i> /add",
    ].join("\n");
  }

  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);

  return [
    "<b>📚 Твой словарь</b>",
    "",
    `Показано: <b>${from}–${to}</b> из <b>${page.total}</b>`,
    "<i>Нажми на слово ниже, чтобы открыть карточку</i>",
  ].join("\n");
}

export function formatWordDetail(word: Word, hasPhoto = false): string {
  const term = escapeHtml(capitalizeFirst(word.term));
  const translation = escapeHtml(capitalizeFirst(word.translation));
  const example = word.example ? escapeHtml(word.example) : "—";
  const sourceLabel = sourcePretty(word.source);
  const photoLine = hasPhoto ? "📷 <b>есть</b>" : "📷 <i>нет</i>";
  const addedAt = formatAddedAt(word.createdAt);

  return [
    `✨ <b>${term}</b>`,
    "",
    `🔤 <b>Перевод:</b> <i>${translation}</i>`,
    `💬 <b>Пример:</b> <i>${example}</i>`,
    `🏷 <b>Источник:</b> ${sourceLabel}`,
    photoLine,
    `📅 <b>Добавлено:</b> <i>${addedAt}</i>`,
  ].join("\n");
}

export function formatWordsSelectPage(page: WordsPageView, selectedCount: number): string {
  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);

  return [
    "<b>🗑 Режим выбора</b>",
    "",
    `Показано: <b>${from}–${to}</b> из <b>${page.total}</b>`,
    `Отмечено: <b>${selectedCount}</b>`,
    "<i>Тапай слова, чтобы отметить/снять отметку</i>",
  ].join("\n");
}

const MAX_BULK_CONFIRM_LINES = 30;

export function formatBulkDeleteConfirm(words: Word[]): string {
  const lines = ["⚠️ <b>Удалить выбранные слова?</b>", ""];

  for (const [index, word] of words.slice(0, MAX_BULK_CONFIRM_LINES).entries()) {
    lines.push(
      `${index + 1}. ${escapeHtml(capitalizeFirst(word.term))} — ${escapeHtml(capitalizeFirst(word.translation))}`,
    );
  }
  if (words.length > MAX_BULK_CONFIRM_LINES) {
    lines.push(`...и ещё ${words.length - MAX_BULK_CONFIRM_LINES}`);
  }

  lines.push("", `<i>Карточки и фото (${words.length}) исчезнут безвозвратно.</i>`);
  return lines.join("\n");
}

export function formatDeleteConfirm(word: Word): string {
  return [
    "⚠️ <b>Удалить слово?</b>",
    "",
    `✨ <b>${escapeHtml(capitalizeFirst(word.term))}</b> — <i>${escapeHtml(capitalizeFirst(word.translation))}</i>`,
    "",
    "<i>Карточка и фото исчезнут безвозвратно.</i>",
  ].join("\n");
}

function sourcePretty(source: string): string {
  switch (source) {
    case "manual":
      return "<i>вручную</i>";
    case "forward":
      return "<i>из сообщения</i>";
    case "import":
      return "<i>импорт</i>";
    default:
      return `<i>${escapeHtml(source)}</i>`;
  }
}

function formatAddedAt(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export function parseWordsListCallback(data: string): number | null {
  const match = /^w:list:(\d+)$/.exec(data);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]);
}

export function parseWordsPageCallback(data: string): number | null {
  const match = /^w:p:(\d+)$/.exec(data);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]);
}

export function parseWordViewCallback(data: string): string | null {
  const match = /^w:v:(.+)$/i.exec(data);
  const id = match?.[1]?.trim();
  return id || null;
}

export function parseWordDeleteCallback(data: string): string | null {
  const match = /^w:del:([0-9a-f-]{36})$/i.exec(data);
  return match?.[1] ?? null;
}

export function parseWordDeleteConfirmCallback(data: string): string | null {
  const match = /^w:delok:([0-9a-f-]{36})$/i.exec(data);
  return match?.[1] ?? null;
}

export function parseBulkToggleCallback(data: string): string | null {
  const match = /^w:bulk:t:([0-9a-f-]{36})$/i.exec(data);
  return match?.[1] ?? null;
}

export function parseWordPhotoCallback(
  data: string,
): { action: "add" | "show" | "del"; wordId: string } | null {
  const match = /^w:photo:(add|show|del):([0-9a-f-]{36})$/i.exec(data);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    action: match[1] as "add" | "show" | "del",
    wordId: match[2],
  };
}

export type EditField = "term" | "translation" | "example";

export function parseWordEditCallback(
  data: string,
): { field: EditField; wordId: string } | null {
  const match = /^w:e:(term|tr|ex):([0-9a-f-]{36})$/i.exec(data);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const fieldMap = {
    term: "term",
    tr: "translation",
    ex: "example",
  } as const;

  return {
    field: fieldMap[match[1] as keyof typeof fieldMap],
    wordId: match[2],
  };
}
