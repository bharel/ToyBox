import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("planner_records", {
  userId: text("user_id").notNull(), key: text("key").notNull(),
  value: text("value").notNull(), updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.key] })]);

export const integrationSecrets = sqliteTable("integration_secrets", {
  userId: text("user_id").notNull(), name: text("name").notNull(),
  encrypted: text("encrypted").notNull(), updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({columns:[table.userId,table.name]})]);
export const syncSnapshots = sqliteTable("sync_snapshots", {
  userId:text("user_id").notNull(), key:text("key").notNull(), source:text("source").notNull(),
  payload:text("payload").notNull(), updatedAt:text("updated_at").notNull(),
}, table=>[primaryKey({columns:[table.userId,table.key]})]);
export const oauthStates = sqliteTable("oauth_states", {
  hash:text("hash").primaryKey(), userId:text("user_id").notNull(), expiresAt:text("expires_at").notNull(),
});
export const toyMetadata = sqliteTable("toy_metadata", {
  toyId:text("toy_id").primaryKey(), payload:text("payload").notNull(), updatedAt:text("updated_at").notNull(),
});
