import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), googleSubject: text("google_subject").notNull(), displayName: text("display_name").notNull(), email: text("email").notNull(), role: text("role", { enum: ["student", "teacher"] }).notNull().default("student"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("users_google_subject_unique").on(t.googleSubject), uniqueIndex("users_email_unique").on(t.email)]);

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), filename: text("filename").notNull(), r2Key: text("r2_key").notNull(), status: text("status", { enum: ["processing", "review", "published", "failed"] }).notNull().default("processing"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [index("uploads_user_created_idx").on(t.userId, t.createdAt)]);

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(), uploadId: text("upload_id").references(() => uploads.id), authorId: text("author_id").notNull().references(() => users.id), subject: text("subject").notNull(), prompt: text("prompt").notNull(), optionA: text("option_a").notNull(), optionB: text("option_b").notNull(), optionC: text("option_c").notNull(), optionD: text("option_d").notNull(), correctOption: text("correct_option", { enum: ["A", "B", "C", "D"] }).notNull(), explanation: text("explanation"), status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), publishedAt: integer("published_at", { mode: "timestamp" }),
}, (t) => [index("questions_status_subject_idx").on(t.status, t.subject), index("questions_author_status_idx").on(t.authorId, t.status)]);

export const dailyQuizzes = sqliteTable("daily_quizzes", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), localDate: text("local_date").notNull(), status: text("status", { enum: ["active", "submitted"] }).notNull().default("active"), correctCount: integer("correct_count"), completedAt: integer("completed_at", { mode: "timestamp" }), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("daily_quizzes_user_date_unique").on(t.userId, t.localDate), index("daily_quizzes_date_score_idx").on(t.localDate, t.correctCount, t.completedAt)]);

export const quizItems = sqliteTable("quiz_items", {
  id: text("id").primaryKey(), quizId: text("quiz_id").notNull().references(() => dailyQuizzes.id), questionId: text("question_id").notNull().references(() => questions.id), ordinal: integer("ordinal").notNull(), selectedOption: text("selected_option", { enum: ["A", "B", "C", "D"] }),
}, (t) => [uniqueIndex("quiz_items_quiz_order_unique").on(t.quizId, t.ordinal), index("quiz_items_question_idx").on(t.questionId)]);
