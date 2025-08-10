import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSchema } from "@shared/schema";
import { categorizeAssessment, generateFollowUpQuestions, updateCategoriesWithFollowUp } from "./llm";
import { PromptManager, type PromptConfig } from "./prompts";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Submit assessment form and process with LLM
  app.post("/api/assessments", async (req, res) => {
    try {
      const validatedData = insertAssessmentSchema.parse(req.body);
      
      // Step 1: Categorize the assessment data using LLM
      console.log("Categorizing assessment with LLM...");

      const categorizedData = await categorizeAssessment(
        validatedData.destination,
        validatedData.companions,
        validatedData.income,
        validatedData.housing,
        validatedData.timing,
        validatedData.priority
      );

      
      // Step 2: Generate follow-up questions
      console.log("Generating follow-up questions...");
      const followUpResult = await generateFollowUpQuestions(categorizedData, 1, 3);

      
      // Step 3: Create assessment with categorized data
      const assessmentWithCategories = {
        ...validatedData,
        goal: categorizedData.goal,
        finance: categorizedData.finance,
        family: categorizedData.family,
        housing_categorized: categorizedData.housing,
        work: categorizedData.work,
        immigration: categorizedData.immigration,
        education: categorizedData.education,
        tax: categorizedData.tax,
        healthcare: categorizedData.healthcare,
        other: categorizedData.other,
        outstanding_clarifications: categorizedData.outstanding_clarifications,
        current_round: "1",
        max_rounds: "3",
        is_complete: followUpResult.isComplete ? "true" : "false"
      };
      
      const assessment = await storage.createAssessment(assessmentWithCategories);
      
      res.status(201).json({
        success: true,
        message: "Assessment processed successfully!",
        assessmentId: assessment.id,
        categorizedData,
        followUpQuestions: followUpResult.questions,
        isComplete: followUpResult.isComplete,
        reasoning: followUpResult.reasoning
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Please check your form for errors",
          errors: error.errors.reduce((acc, err) => {
            acc[err.path[0]] = err.message;
            return acc;
          }, {} as Record<string, string>)
        });
      } else {
        console.error("Assessment submission error:", error);
        res.status(500).json({
          success: false,
          message: "Something went wrong. Please try again."
        });
      }
    }
  });

  // Submit follow-up answers
  app.post("/api/assessments/follow-up", async (req, res) => {
    try {
      const { assessmentId, answers } = req.body;
      
      if (!assessmentId || !answers) {
        return res.status(400).json({
          success: false,
          message: "Assessment ID and answers are required"
        });
      }

      // Get existing assessment
      const existingAssessment = await storage.getAssessment(assessmentId);
      if (!existingAssessment) {
        return res.status(404).json({
          success: false,
          message: "Assessment not found"
        });
      }

      // Extract current categorized data
      const currentCategories = {
        goal: existingAssessment.goal || "",
        finance: existingAssessment.finance || "",
        family: existingAssessment.family || "",
        housing: existingAssessment.housing_categorized || "",
        work: existingAssessment.work || "",
        immigration: existingAssessment.immigration || "",
        education: existingAssessment.education || "",
        tax: existingAssessment.tax || "",
        healthcare: existingAssessment.healthcare || "",
        other: existingAssessment.other || "",
        outstanding_clarifications: existingAssessment.outstanding_clarifications || ""
      };

      // Update categories with follow-up answers
      console.log("Updating categories with follow-up answers...");

      const updatedCategories = await updateCategoriesWithFollowUp(currentCategories, answers);

      
      const currentRound = parseInt(existingAssessment.current_round || "1");
      const maxRounds = parseInt(existingAssessment.max_rounds || "3");
      const nextRound = currentRound + 1;

      // Generate next round of questions if needed
      let followUpResult = { questions: [], isComplete: true, reasoning: "Assessment complete." };
      
      if (nextRound <= maxRounds) {
        console.log(`Generating follow-up questions for round ${nextRound}...`);
        followUpResult = await generateFollowUpQuestions(updatedCategories, nextRound, maxRounds);

      }

      // Update assessment in storage
      const updates = {
        goal: updatedCategories.goal,
        finance: updatedCategories.finance,
        family: updatedCategories.family,
        housing_categorized: updatedCategories.housing,
        work: updatedCategories.work,
        immigration: updatedCategories.immigration,
        education: updatedCategories.education,
        tax: updatedCategories.tax,
        healthcare: updatedCategories.healthcare,
        other: updatedCategories.other,
        outstanding_clarifications: updatedCategories.outstanding_clarifications,
        current_round: nextRound.toString(),
        is_complete: followUpResult.isComplete ? "true" : "false"
      };

      await storage.updateAssessment(assessmentId, updates);

      res.status(200).json({
        success: true,
        message: "Follow-up answers processed successfully!",
        assessmentId,
        categorizedData: updatedCategories,
        followUpQuestions: followUpResult.questions,
        isComplete: followUpResult.isComplete,
        reasoning: followUpResult.reasoning,
        currentRound: nextRound
      });
    } catch (error) {
      console.error("Follow-up submission error:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong processing your follow-up answers. Please try again."
      });
    }
  });

  // Prompt management endpoints
  app.get("/api/prompts", async (req, res) => {
    try {
      const prompts = await storage.getAllPrompts();
      res.json({ success: true, prompts });
    } catch (error) {
      console.error("Get prompts error:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve prompts" });
    }
  });

  app.get("/api/prompts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const prompt = await storage.getPrompt(id);
      
      if (!prompt) {
        return res.status(404).json({ success: false, message: "Prompt not found" });
      }
      
      res.json({ success: true, prompt });
    } catch (error) {
      console.error("Get prompt error:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve prompt" });
    }
  });

  app.put("/api/prompts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate required fields
      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        systemPrompt: z.string().optional(),
        userPrompt: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(4000).optional()
      });
      
      const validatedUpdates = updateSchema.parse(updates);
      const updatedPrompt = await storage.updatePrompt(id, validatedUpdates);
      
      res.json({ 
        success: true, 
        message: "Prompt updated successfully",
        prompt: updatedPrompt 
      });
    } catch (error) {
      console.error("Update prompt error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Invalid prompt data",
          errors: error.errors
        });
      } else {
        res.status(500).json({ success: false, message: "Failed to update prompt" });
      }
    }
  });

  app.post("/api/prompts", (req, res) => {
    try {
      const promptData = req.body;
      
      const promptSchema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        systemPrompt: z.string(),
        userPrompt: z.string(),
        temperature: z.number().min(0).max(2).default(0.3),
        maxTokens: z.number().min(1).max(4000).default(1500)
      });
      
      const validatedPrompt = promptSchema.parse(promptData);
      const newPrompt = PromptManager.createPrompt(validatedPrompt);
      
      res.status(201).json({ 
        success: true, 
        message: "Prompt created successfully",
        prompt: newPrompt 
      });
    } catch (error) {
      console.error("Create prompt error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: "Invalid prompt data",
          errors: error.errors
        });
      } else {
        res.status(500).json({ success: false, message: "Failed to create prompt" });
      }
    }
  });

  app.delete("/api/prompts/:id", (req, res) => {
    try {
      const { id } = req.params;
      const deleted = PromptManager.deletePrompt(id);
      
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Prompt not found" });
      }
      
      res.json({ success: true, message: "Prompt deleted successfully" });
    } catch (error) {
      console.error("Delete prompt error:", error);
      res.status(500).json({ success: false, message: "Failed to delete prompt" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
