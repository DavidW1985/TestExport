import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSchema, insertPricingPackageSchema } from "@shared/schema";
import { categorizeAssessment, generateFollowUpQuestions, updateCategoriesWithFollowUp } from "./llm";
import { PromptManager, type PromptConfig } from "./prompts";
import { seedPricingPackages } from "./seed-packages";
import { matchUserToPackage, getPackageMatchForAssessment } from "./package-matching";
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

      
      // Step 2: Create initial assessment to get ID for logging
      const initialAssessment = await storage.createAssessment({
        ...validatedData,
        current_round: "1",
        max_rounds: "3",
        is_complete: "false"
      });

      // Step 3: Generate follow-up questions (with logging)
      console.log("Generating follow-up questions...");
      const followUpResult = await generateFollowUpQuestions(categorizedData, 1, 3, [], initialAssessment.id);
      
      // Debug logging for followUpResult
      console.log("Follow-up result structure:", {
        hasQuestions: !!followUpResult.questions,
        questionsType: Array.isArray(followUpResult.questions) ? 'array' : typeof followUpResult.questions,
        questionsLength: followUpResult.questions?.length || 0,
        isComplete: followUpResult.isComplete,
        reasoning: followUpResult.reasoning ? followUpResult.reasoning.substring(0, 100) + '...' : 'No reasoning'
      });
      
      // If we get 0 questions, mark as complete to avoid infinite loops
      if (followUpResult.questions.length === 0) {
        console.log("No follow-up questions generated, marking assessment as complete");
        followUpResult.isComplete = true;
        followUpResult.reasoning = "Assessment complete - no additional questions needed.";
      }

      // Step 4: Update assessment with categorized data
      const assessment = await storage.updateAssessment(initialAssessment.id, {
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
        is_complete: followUpResult.isComplete ? "true" : "false"
      });
      
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

  // Debug endpoint to test API
  app.get("/api/debug/test", async (req, res) => {
    try {
      res.json({ success: true, message: "API is working", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Submit follow-up answers - background processing
  app.post("/api/assessments/follow-up", async (req, res) => {
    try {
      const { assessmentId, answers } = req.body;
      
      if (!assessmentId || !answers) {
        return res.status(400).json({ 
          success: false, 
          message: 'Assessment ID and answers are required' 
        });
      }

      // Mark as processing and return immediately
      await storage.updateAssessment(assessmentId, {
        processing_status: 'processing'
      });

      // Return immediately
      res.json({
        success: true,
        message: 'Processing started',
        assessmentId,
        status: 'processing'
      });

      // Process in background (no await)
      processFollowUpInBackground(assessmentId, answers);

    } catch (error) {
      console.error('Follow-up submission error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to start processing'
      });
    }
  });

  // Status check endpoint
  app.get("/api/assessments/follow-up/:assessmentId/status", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const assessment = await storage.getAssessment(assessmentId);
      
      if (!assessment) {
        return res.status(404).json({ 
          success: false, 
          message: 'Assessment not found' 
        });
      }

      const status = assessment.processing_status || 'idle';
      
      if (status === 'completed') {
        const result = JSON.parse(assessment.processing_result || '{}');
        return res.json({
          success: true,
          status: 'completed',
          ...result
        });
      } else if (status === 'error') {
        return res.json({
          success: false,
          status: 'error',
          message: assessment.processing_error || 'Processing failed'
        });
      } else {
        return res.json({
          success: true,
          status: status
        });
      }
    } catch (error) {
      console.error('Status check error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to check status'
      });
    }
  });

  // Background processing function
  async function processFollowUpInBackground(assessmentId: string, answers: any) {
    try {
      console.log('=== BACKGROUND PROCESSING STARTED ===');
      console.log('Assessment ID:', assessmentId);
      console.log('Answers:', Object.keys(answers).length, 'provided');

      const existingAssessment = await storage.getAssessment(assessmentId);
      if (!existingAssessment) {
        throw new Error('Assessment not found');
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

      const currentRound = parseInt(existingAssessment.current_round || "1");
      console.log(`Processing round ${currentRound} follow-up answers`);
      
      // Update categories with follow-up answers
      const updatedCategories = await updateCategoriesWithFollowUp(currentCategories, answers, assessmentId, currentRound);
      console.log(`Categories updated successfully for round ${currentRound}`);
      
      const maxRounds = parseInt(existingAssessment.max_rounds || "3");
      const nextRound = currentRound + 1;
      console.log(`Current: ${currentRound}, Next: ${nextRound}, Max: ${maxRounds}`);

      let followUpResult: { questions: any[], isComplete: boolean, reasoning: string } = { 
        questions: [], 
        isComplete: true, 
        reasoning: "Assessment complete." 
      };
      
      if (currentRound < maxRounds) {
        console.log(`Generating follow-up questions for round ${nextRound}`);
        followUpResult = await generateFollowUpQuestions(updatedCategories, nextRound, maxRounds, [], assessmentId);
        console.log(`Generated ${followUpResult.questions.length} questions for round ${nextRound}`);
        
        followUpResult.isComplete = false;
        followUpResult.reasoning = `Round ${currentRound} complete. Continuing to round ${nextRound} of ${maxRounds}.`;
      } else {
        console.log(`Assessment completed after round ${currentRound}`);
        followUpResult.isComplete = true;
        followUpResult.reasoning = `Assessment completed after ${currentRound} rounds.`;
        
        // Generate package recommendation when assessment is complete
        try {
          const packageMatch = await matchUserToPackage(existingAssessment, updatedCategories, assessmentId);
          console.log(`Package matched: ${packageMatch.recommendedPackageId} with score ${packageMatch.matchScore}`);
        } catch (error) {
          console.error('Error matching package:', error);
        }
      }

      // Update assessment with results
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
        is_complete: followUpResult.isComplete ? "true" : "false",
        processing_status: 'completed',
        processing_result: JSON.stringify({
          success: true,
          message: 'Follow-up answers processed successfully!',
          assessmentId,
          categorizedData: updatedCategories,
          followUpQuestions: followUpResult.questions,
          isComplete: followUpResult.isComplete,
          reasoning: followUpResult.reasoning,
          currentRound: nextRound
        })
      };

      await storage.updateAssessment(assessmentId, updates);
      console.log(`Assessment ${assessmentId} updated successfully for round ${nextRound}`);

    } catch (error) {
      console.error('Background processing error:', error);
      await storage.updateAssessment(assessmentId, {
        processing_status: 'error',
        processing_error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Original follow-up endpoint (now replaced by background processing above)
  app.post("/api/assessments/follow-up-original", async (req, res) => {
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

      const currentRound = parseInt(existingAssessment.current_round || "1");
      console.log(`Processing round ${currentRound} follow-up answers for assessment ${assessmentId}`);
      console.log(`Submitted answers:`, Object.keys(answers).length, 'answers');
      console.log(`Assessment state:`, {
        id: existingAssessment.id,
        current_round: existingAssessment.current_round,
        max_rounds: existingAssessment.max_rounds,
        is_complete: existingAssessment.is_complete
      });
      
      let updatedCategories;
      try {
        updatedCategories = await updateCategoriesWithFollowUp(currentCategories, answers, assessmentId, currentRound);
        console.log(`Categories updated successfully for round ${currentRound}`);
      } catch (error) {
        console.error(`Error updating categories for round ${currentRound}:`, error);
        throw error;
      }
      
      const maxRounds = parseInt(existingAssessment.max_rounds || "3");
      const nextRound = currentRound + 1;
      console.log(`Current: ${currentRound}, Next: ${nextRound}, Max: ${maxRounds}`);

      // Generate next round of questions if needed
      let followUpResult: { questions: any[], isComplete: boolean, reasoning: string } = { questions: [], isComplete: true, reasoning: "Assessment complete." };
      
      // FORCE exactly 3 rounds regardless of LLM response
      if (currentRound < maxRounds) {
        console.log(`Generating follow-up questions for round ${nextRound} (just completed round ${currentRound} of max ${maxRounds})...`);
        try {
          followUpResult = await generateFollowUpQuestions(updatedCategories, nextRound, maxRounds, [], assessmentId);
          console.log(`Generated ${followUpResult.questions.length} questions for round ${nextRound}`);
          
          // OVERRIDE: Force incomplete until we reach max rounds
          followUpResult.isComplete = false;
          followUpResult.reasoning = `Round ${currentRound} complete. Continuing to round ${nextRound} of ${maxRounds}.`;
          
        } catch (error) {
          console.error(`Error generating follow-up questions for round ${nextRound}:`, error);
          throw error;
        }
      } else {
        console.log(`Assessment completed! Just finished round ${currentRound} which was the final round (max: ${maxRounds})`);
        followUpResult.isComplete = true;
        followUpResult.reasoning = `Assessment completed after ${currentRound} rounds of follow-up questions.`;
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

      console.log(`Updating assessment with:`, { 
        assessmentId, 
        nextRound, 
        isComplete: followUpResult.isComplete,
        questionsGenerated: followUpResult.questions.length 
      });

      try {
        await storage.updateAssessment(assessmentId, updates);
        console.log(`Assessment ${assessmentId} updated successfully for round ${nextRound}`);
      } catch (error) {
        console.error(`Failed to update assessment ${assessmentId}:`, error);
        throw error;
      }

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
      console.error("=== FOLLOW-UP ERROR DETAILS ===");
      console.error("Error:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack available');
      console.error("Assessment ID:", assessmentId);
      console.error("Request body:", req.body);
      console.error("=== END ERROR DETAILS ===");
      
      return res.status(500).json({
        success: false,
        message: "Something went wrong processing your follow-up answers. Please try again.",
        error: error instanceof Error ? error.message : String(error)
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
        maxTokens: z.number().min(1).max(4000).default(1500),
        model: z.string().default("gpt-4o")
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

  // LLM Logging API endpoints
  app.get("/api/llm-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAllLogs(limit);
      
      res.json({
        success: true,
        logs: logs.map(log => ({
          ...log,
          inputData: JSON.parse(log.inputData),
          parsedResult: log.parsedResult ? JSON.parse(log.parsedResult) : null
        }))
      });
    } catch (error) {
      console.error("Get LLM logs error:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve logs" });
    }
  });

  app.get("/api/assessments/:id/llm-logs", async (req, res) => {
    try {
      const { id } = req.params;
      const logs = await storage.getAssessmentLogs(id);
      
      res.json({
        success: true,
        logs: logs.map(log => ({
          ...log,
          inputData: JSON.parse(log.inputData),
          parsedResult: log.parsedResult ? JSON.parse(log.parsedResult) : null
        }))
      });
    } catch (error) {
      console.error("Get assessment logs error:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve assessment logs" });
    }
  });

  // Pricing Packages API routes
  app.get("/api/pricing-packages", async (req, res) => {
    try {
      const packages = await storage.getAllPricingPackages();
      res.json({ success: true, packages });
    } catch (error) {
      console.error("Error fetching pricing packages:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to fetch pricing packages" 
      });
    }
  });

  app.get("/api/pricing-packages/:id", async (req, res) => {
    try {
      const pkg = await storage.getPricingPackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ success: false, error: "Pricing package not found" });
      }
      res.json({ success: true, package: pkg });
    } catch (error) {
      console.error("Error fetching pricing package:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to fetch pricing package" 
      });
    }
  });

  app.post("/api/pricing-packages", async (req, res) => {
    try {
      const validatedData = insertPricingPackageSchema.parse(req.body);
      const pkg = await storage.createPricingPackage(validatedData);
      res.json({ success: true, package: pkg, message: "Pricing package created successfully" });
    } catch (error) {
      console.error("Error creating pricing package:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          error: "Validation error", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : "Failed to create pricing package" 
        });
      }
    }
  });

  app.put("/api/pricing-packages/:id", async (req, res) => {
    try {
      const updates = req.body;
      const pkg = await storage.updatePricingPackage(req.params.id, updates);
      res.json({ success: true, package: pkg, message: "Pricing package updated successfully" });
    } catch (error) {
      console.error("Error updating pricing package:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update pricing package" 
      });
    }
  });

  app.delete("/api/pricing-packages/:id", async (req, res) => {
    try {
      await storage.deletePricingPackage(req.params.id);
      res.json({ success: true, message: "Pricing package deleted successfully" });
    } catch (error) {
      console.error("Error deleting pricing package:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete pricing package" 
      });
    }
  });

  // Package matching API routes
  app.get("/api/assessments/:id/package-match", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await getPackageMatchForAssessment(id);
      
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          error: "No package match found for this assessment" 
        });
      }

      res.json({ 
        success: true, 
        match: result.match,
        package: result.package
      });
    } catch (error) {
      console.error("Error getting package match:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get package match" 
      });
    }
  });

  app.post("/api/assessments/:id/match-package", async (req, res) => {
    try {
      const { id } = req.params;
      const assessment = await storage.getAssessment(id);
      
      if (!assessment) {
        return res.status(404).json({ success: false, error: "Assessment not found" });
      }

      // Extract categorized data from assessment
      const categorizedData = {
        goal: assessment.goal || "",
        finance: assessment.finance || "",
        family: assessment.family || "",
        housing: assessment.housing_categorized || "",
        work: assessment.work || "",
        immigration: assessment.immigration || "",
        education: assessment.education || "",
        tax: assessment.tax || "",
        healthcare: assessment.healthcare || "",
        other: assessment.other || "",
        outstanding_clarifications: assessment.outstanding_clarifications || ""
      };

      const matchResult = await matchUserToPackage(assessment, categorizedData, id);
      res.json({ 
        success: true, 
        recommendation: matchResult,
        message: "Package recommendation generated successfully" 
      });
    } catch (error) {
      console.error("Error matching package:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to match package" 
      });
    }
  });

  // Seed pricing packages on startup
  await seedPricingPackages();

  const httpServer = createServer(app);
  return httpServer;
}
