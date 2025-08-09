import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  destination: text("destination").notNull(),
  companions: text("companions").notNull(),
  income: text("income").notNull(),
  housing: text("housing").notNull(),
  timing: text("timing").notNull(),
  priority: text("priority").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  submittedAt: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  destination: z.string().min(1, "Please specify your destination"),
  companions: z.string().min(1, "Please tell us who's moving with you"),
  income: z.string().min(1, "Please describe your income source"),
  housing: z.string().min(1, "Please describe your housing plan"),
  timing: z.string().min(1, "Please specify your timing"),
  priority: z.string().min(1, "Please share what's most important"),
  fullName: z.string().min(1, "Please enter your full name"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;
