import { 
  type User, type InsertUser, 
  type Assessment, type InsertAssessment, 
  type Prompt, type InsertPrompt, 
  type LlmLog, type InsertLlmLog,
  type PricingPackage, type InsertPricingPackage,
  type AssessmentPackageMatch, type InsertAssessmentPackageMatch
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAssessment(assessment: any): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  updateAssessment(id: string, updates: Partial<Assessment>): Promise<Assessment>;
  // Prompt management
  getAllPrompts(): Promise<Prompt[]>;
  getPrompt(id: string): Promise<Prompt | undefined>;
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt>;
  // LLM logging
  createLlmLog(log: InsertLlmLog): Promise<LlmLog>;
  getAssessmentLogs(assessmentId: string): Promise<LlmLog[]>;
  getAllLogs(limit?: number): Promise<LlmLog[]>;
  // Pricing packages
  getAllPricingPackages(): Promise<PricingPackage[]>;
  getPricingPackage(id: string): Promise<PricingPackage | undefined>;
  createPricingPackage(pkg: InsertPricingPackage): Promise<PricingPackage>;
  updatePricingPackage(id: string, updates: Partial<PricingPackage>): Promise<PricingPackage>;
  deletePricingPackage(id: string): Promise<void>;
  // Package matching
  createPackageMatch(match: InsertAssessmentPackageMatch): Promise<AssessmentPackageMatch>;
  getAssessmentPackageMatch(assessmentId: string): Promise<AssessmentPackageMatch | undefined>;
}

// Import database functionality
import { db } from "./db";
import { users, assessments, prompts, llmLogs, pricingPackages, assessmentPackageMatches } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAssessment(insertAssessment: any): Promise<Assessment> {
    const [assessment] = await db
      .insert(assessments)
      .values(insertAssessment)
      .returning();
    return assessment;
  }

  async updateAssessment(id: string, updates: Partial<Assessment>): Promise<Assessment> {
    try {
      console.log(`Updating assessment ${id} with:`, Object.keys(updates));
      const [assessment] = await db
        .update(assessments)
        .set(updates)
        .where(eq(assessments.id, id))
        .returning();
      if (!assessment) {
        console.error(`No assessment found with id: ${id}`);
        throw new Error("Assessment not found");
      }
      console.log(`Assessment ${id} updated successfully, current round: ${assessment.current_round}`);
      return assessment;
    } catch (error) {
      console.error(`Database error updating assessment ${id}:`, error);
      throw error;
    }
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment || undefined;
  }

  // Prompt management methods
  async getAllPrompts(): Promise<Prompt[]> {
    return await db.select().from(prompts).orderBy(prompts.createdAt);
  }

  async getPrompt(id: string): Promise<Prompt | undefined> {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id));
    return prompt || undefined;
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const [prompt] = await db
      .insert(prompts)
      .values(insertPrompt)
      .returning();
    return prompt;
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    const [prompt] = await db
      .update(prompts)
      .set({ 
        ...updates, 
        updatedAt: sql`NOW()` 
      })
      .where(eq(prompts.id, id))
      .returning();
    if (!prompt) {
      throw new Error("Prompt not found");
    }
    return prompt;
  }

  // LLM logging methods
  async createLlmLog(log: InsertLlmLog): Promise<LlmLog> {
    const [llmLog] = await db
      .insert(llmLogs)
      .values(log)
      .returning();
    return llmLog;
  }

  async getAssessmentLogs(assessmentId: string): Promise<LlmLog[]> {
    return await db
      .select()
      .from(llmLogs)
      .where(eq(llmLogs.assessmentId, assessmentId))
      .orderBy(desc(llmLogs.createdAt));
  }

  async getAllLogs(limit: number = 100): Promise<LlmLog[]> {
    return await db
      .select()
      .from(llmLogs)
      .orderBy(desc(llmLogs.createdAt))
      .limit(limit);
  }

  // Pricing packages
  async getAllPricingPackages(): Promise<PricingPackage[]> {
    return await db
      .select()
      .from(pricingPackages)
      .where(eq(pricingPackages.isActive, true))
      .orderBy(pricingPackages.sortOrder);
  }

  async getPricingPackage(id: string): Promise<PricingPackage | undefined> {
    const [pkg] = await db
      .select()
      .from(pricingPackages)
      .where(eq(pricingPackages.id, id));
    return pkg || undefined;
  }

  async createPricingPackage(insertPackage: InsertPricingPackage): Promise<PricingPackage> {
    const [pkg] = await db
      .insert(pricingPackages)
      .values(insertPackage)
      .returning();
    return pkg;
  }

  async updatePricingPackage(id: string, updates: Partial<PricingPackage>): Promise<PricingPackage> {
    const [pkg] = await db
      .update(pricingPackages)
      .set({...updates, updatedAt: new Date()})
      .where(eq(pricingPackages.id, id))
      .returning();
    if (!pkg) {
      throw new Error("Pricing package not found");
    }
    return pkg;
  }

  async deletePricingPackage(id: string): Promise<void> {
    await db
      .update(pricingPackages)
      .set({isActive: false})
      .where(eq(pricingPackages.id, id));
  }

  // Package matching
  async createPackageMatch(insertMatch: InsertAssessmentPackageMatch): Promise<AssessmentPackageMatch> {
    const [match] = await db
      .insert(assessmentPackageMatches)
      .values(insertMatch)
      .returning();
    return match;
  }

  async getAssessmentPackageMatch(assessmentId: string): Promise<AssessmentPackageMatch | undefined> {
    const [match] = await db
      .select()
      .from(assessmentPackageMatches)
      .where(eq(assessmentPackageMatches.assessmentId, assessmentId))
      .orderBy(desc(assessmentPackageMatches.createdAt))
      .limit(1);
    return match || undefined;
  }
}

export const storage = new DatabaseStorage();
