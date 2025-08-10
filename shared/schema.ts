import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Original form responses
  destination: text("destination").notNull(),
  companions: text("companions").notNull(),
  income: text("income").notNull(),
  housing: text("housing").notNull(),
  timing: text("timing").notNull(),
  priority: text("priority").notNull(),
  
  // LLM categorized data
  goal: text("goal"),
  finance: text("finance"),
  family: text("family"),
  housing_categorized: text("housing_categorized"),
  work: text("work"),
  immigration: text("immigration"),
  education: text("education"),
  tax: text("tax"),
  healthcare: text("healthcare"),
  other: text("other"),
  outstanding_clarifications: text("outstanding_clarifications"),
  
  // Follow-up tracking
  current_round: text("current_round").default("1"),
  max_rounds: text("max_rounds").default("3"),
  is_complete: text("is_complete").default("false"),
  
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const prompts = pgTable("prompts", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userPrompt: text("user_prompt").notNull(),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(1500),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  submittedAt: true,
  goal: true,
  finance: true,
  family: true,
  housing_categorized: true,
  work: true,
  immigration: true,
  education: true,
  tax: true,
  healthcare: true,
  other: true,
  outstanding_clarifications: true,
  current_round: true,
  max_rounds: true,
  is_complete: true,
}).extend({
  destination: z.string().min(1, "Please specify your destination"),
  companions: z.string().min(1, "Please tell us who's moving with you"),
  income: z.string().min(1, "Please describe your income source"),
  housing: z.string().min(1, "Please describe your housing plan"),
  timing: z.string().min(1, "Please specify your timing"),
  priority: z.string().min(1, "Please share what's most important"),
});

export const insertPromptSchema = createInsertSchema(prompts).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof prompts.$inferSelect;
