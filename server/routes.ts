import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Submit assessment form
  app.post("/api/assessments", async (req, res) => {
    try {
      const validatedData = insertAssessmentSchema.parse(req.body);
      const assessment = await storage.createAssessment(validatedData);
      
      res.status(201).json({
        success: true,
        message: "Assessment submitted successfully! You'll receive your expert review within 2-3 business days.",
        assessmentId: assessment.id
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

  const httpServer = createServer(app);
  return httpServer;
}
