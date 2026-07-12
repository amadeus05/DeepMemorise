import {
  pgTable,
  uuid,
  bigint,
  text,
  timestamp,
  integer,
  doublePrecision,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_telegram_id_uidx").on(table.telegramId)],
);

export const words = pgTable(
  "words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    translation: text("translation").notNull(),
    example: text("example"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("words_user_term_uidx").on(table.userId, table.term)],
);

export const reviewCards = pgTable(
  "review_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wordId: uuid("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    intervalMinutes: integer("interval_minutes").notNull().default(0),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
  },
  (table) => [index("review_cards_user_due_idx").on(table.userId, table.dueAt)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  methodology: text("methodology").notNull().default("sm2"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(false),
  remindAt: text("remind_at").notNull().default("18:00"),
  timezone: text("timezone").notNull().default("Europe/Moscow"),
  lastDailyReminderOn: text("last_daily_reminder_on"),
  shortRemindersEnabled: boolean("short_reminders_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start").notNull().default("23:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("08:00"),
  lastShortReminderAt: timestamp("last_short_reminder_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  kind: text("kind").notNull(),
  role: text("role"),
  fileId: text("file_id").notNull(),
  fileUniqueId: text("file_unique_id"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  uploadedBy: bigint("uploaded_by", { mode: "number" }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
