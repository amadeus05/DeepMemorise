import type { Context, SessionFlavor } from "grammy";
import type { WordService } from "../../application/WordService.js";
import type { ReviewService } from "../../application/ReviewService.js";
import type { SettingsService } from "../../application/SettingsService.js";
import type { UploadService } from "../../application/UploadService.js";
import type { BulkImportService } from "../../application/BulkImportService.js";
import type { IUserRepository } from "../../ports/IUserRepository.js";
import type { EditField } from "./keyboards/wordsKeyboard.js";

export type AddWordSession =
  | { step: "idle" }
  | { step: "await_term" }
  | { step: "await_translation"; term: string }
  | { step: "await_example"; term: string; translation: string };

export type EditWordSession =
  | { step: "idle" }
  | {
      step: "await_value";
      wordId: string;
      field: EditField;
      listPage: number;
    };

export type PhotoWordSession =
  | { step: "idle" }
  | { step: "await_photo"; wordId: string; listPage: number };

export type ImportSession = { step: "idle" } | { step: "await_file" };

export type BulkDeleteSession =
  | { step: "idle" }
  | { step: "selecting"; selected: string[] };

// Лёгкий кеш личности пользователя, чтобы не апсертить его в базу на каждый
// клик. Хранятся только примитивы — переживает JSON-сериализацию, если сессию
// когда-нибудь вынесут во внешнее хранилище.
export type SessionUser = {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
};

export type SessionData = {
  add: AddWordSession;
  edit: EditWordSession;
  photo: PhotoWordSession;
  import: ImportSession;
  bulkDelete: BulkDeleteSession;
  cachedUser?: SessionUser;
  wordsPage: number;
};

export type BotContext = Context & SessionFlavor<SessionData>;

export type AppServices = {
  users: IUserRepository;
  words: WordService;
  reviews: ReviewService;
  settings: SettingsService;
  uploads: UploadService;
  bulkImport: BulkImportService;
};

export function initialSession(): SessionData {
  return {
    add: { step: "idle" },
    edit: { step: "idle" },
    photo: { step: "idle" },
    import: { step: "idle" },
    bulkDelete: { step: "idle" },
    wordsPage: 1,
  };
}
