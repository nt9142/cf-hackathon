import { sql } from "drizzle-orm";
import { integer, real, text, sqliteTable, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const categories = sqliteTable("categories", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => [
  index("categories_name_idx").on(t.name),
]);

export const expenses = sqliteTable("expenses", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  currency: text("currency").notNull().default("USD"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  paymentMethod: text("payment_method"),
  receipt: text("receipt"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (t) => [
  index("expenses_category_idx").on(t.category),
  index("expenses_date_idx").on(t.date),
  index("expenses_currency_idx").on(t.currency),
]);

export const categoriesRelations = relations(categories, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  categoryRef: one(categories, {
    fields: [expenses.category],
    references: [categories.name],
  }),
}));