import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const bids = sqliteTable("bids", {id: text("id").primaryKey(), lot: integer("lot").notNull(), amount: integer("amount").notNull(), userId: text("user_id").notNull(), createdAt: integer("created_at").notNull()}, t=>[index("lot_amount").on(t.lot,t.amount)]);
