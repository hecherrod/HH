import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const bids = sqliteTable('bids', {
  id: text('id').primaryKey(),
  lot: integer('lot').notNull(),
  amount: integer('amount').notNull(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('lot_amount').on(table.lot, table.amount)]);

export const participants = sqliteTable('participants', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  whatsapp: text('whatsapp').notNull(),
  whatsappConsent: integer('whatsapp_consent').notNull().default(0),
  acceptedAt: integer('accepted_at').notNull(),
});

export const offers = sqliteTable('offers', {
  id: text('id').primaryKey(),
  lot: integer('lot').notNull(),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  notifiedAt: integer('notified_at'),
  deadline: integer('deadline'),
  paidAt: integer('paid_at'),
  paymentReference: text('payment_reference'),
  mercadoPagoUrl: text('mercado_pago_url'),
  linkDisabledAt: integer('link_disabled_at'),
  emailSentAt: integer('email_sent_at'),
  whatsappSentAt: integer('whatsapp_sent_at'),
}, table => [
  uniqueIndex('one_offer_per_bidder').on(table.lot, table.userId),
  uniqueIndex('one_current_offer_per_lot').on(table.lot).where(sql`${table.status} IN ('ready', 'pending', 'paid')`),
]);
