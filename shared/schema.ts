import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
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
  
  // Background processing status
  processing_status: text("processing_status").default("idle"), // idle, processing, completed, error
  processing_result: text("processing_result"), // JSON result when completed
  processing_error: text("processing_error"), // Error message if failed
  
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
  model: text("model").notNull().default("gpt-4o"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// LLM interaction logs for transparency and debugging
export const llmLogs = pgTable("llm_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => assessments.id),
  operation: text("operation").notNull(), // 'categorize', 'followup', 'update'
  round: integer("round").default(1),
  
  // Request details
  promptUsed: text("prompt_used").notNull(), // Full rendered prompt
  promptTemplate: text("prompt_template"), // Name of the specific prompt template used (e.g., 'categorization', 'followUp', 'update')
  systemPrompt: text("system_prompt").notNull(),
  inputData: text("input_data").notNull(), // JSON of variables used
  
  // Response details  
  llmResponse: text("llm_response").notNull(), // Raw LLM response
  parsedResult: text("parsed_result").notNull(), // Parsed JSON result
  
  // Metadata
  model: text("model").notNull(),
  temperature: real("temperature").notNull(),
  tokensUsed: integer("tokens_used"),
  responseTimeMs: integer("response_time_ms"),
  success: text("success").notNull().default("true"), // 'true' or error message
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pricing packages that can be matched to user context
export const pricingPackages = pgTable("pricing_packages", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  
  // Package characteristics for matching
  targetIncomeLevel: text("target_income_level"), // "low", "medium", "high"
  complexityLevel: text("complexity_level").notNull(), // "simple", "moderate", "complex"
  familySize: text("family_size"), // "individual", "couple", "family"
  urgencyLevel: text("urgency_level"), // "low", "medium", "high"
  destinationTypes: text("destination_types"), // JSON array: ["eu", "us", "asia", "other"]
  
  // Service inclusions
  includesVisaSupport: boolean("includes_visa_support").notNull().default(false),
  includesHousingSearch: boolean("includes_housing_search").notNull().default(false),
  includesTaxAdvice: boolean("includes_tax_advice").notNull().default(false),
  includesEducationPlanning: boolean("includes_education_planning").notNull().default(false),
  includesHealthcareGuidance: boolean("includes_healthcare_guidance").notNull().default(false),
  includesWorkPermitHelp: boolean("includes_work_permit_help").notNull().default(false),
  
  // Package limits
  consultationHours: integer("consultation_hours").notNull().default(1),
  followUpSessions: integer("follow_up_sessions").notNull().default(0),
  documentReviews: integer("document_reviews").notNull().default(0),
  
  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Track which package was matched to each assessment
export const assessmentPackageMatches = pgTable("assessment_package_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => assessments.id).notNull(),
  packageId: varchar("package_id").references(() => pricingPackages.id).notNull(),
  matchScore: real("match_score").notNull(), // 0-1 confidence score
  matchReasoning: text("match_reasoning").notNull(), // LLM explanation
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const insertLlmLogSchema = createInsertSchema(llmLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertLlmLog = z.infer<typeof insertLlmLogSchema>;
export type LlmLog = typeof llmLogs.$inferSelect;

export const insertPricingPackageSchema = createInsertSchema(pricingPackages).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPricingPackage = z.infer<typeof insertPricingPackageSchema>;
export type PricingPackage = typeof pricingPackages.$inferSelect;

export const insertAssessmentPackageMatchSchema = createInsertSchema(assessmentPackageMatches).omit({
  id: true,
  createdAt: true,
});
export type InsertAssessmentPackageMatch = z.infer<typeof insertAssessmentPackageMatchSchema>;
export type AssessmentPackageMatch = typeof assessmentPackageMatches.$inferSelect;
