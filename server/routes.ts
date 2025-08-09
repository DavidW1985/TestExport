import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSchema } from "@shared/schema";
import { categorizeAssessment, generateFollowUpQuestions, updateCategoriesWithFollowUp } from "./llm";
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

  const httpServer = createServer(app);
  return httpServer;
}
