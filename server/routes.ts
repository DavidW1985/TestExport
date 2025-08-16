import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssessmentSchema, insertPricingPackageSchema } from "@shared/schema";
import { categorizeAssessment, generateFollowUpQuestions, updateCategoriesWithFollowUp } from "./llm";
import { PromptManager, type PromptConfig } from "./prompts";
import { seedPricingPackages } from "./seed-packages";
import { matchUserToPackage, getPackageMatchForAssessment } from "./package-matching";
import { z } from "zod";
import { eventLog } from "./event-log";
import { setupEventRoutes } from "./event-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Submit assessment form and process with LLM
  app.post("/api/assessments", async (req, res) => {
    try {
      const validatedData = insertAssessmentSchema.parse(req.body);
      console.log("=== NEW ASSESSMENT SUBMISSION ===");
      console.log("Raw data:", validatedData);
      
      // For new 3-question format, map to legacy format for LLM processing
      let destination, movingFrom, companions, income, housing, timing, priority;
      
      if (validatedData.movingTo && validatedData.movingFrom && validatedData.context) {
        // New format - extract from simplified questions
        destination = validatedData.movingTo;
        movingFrom = validatedData.movingFrom;
        const context = validatedData.context;
        
        // Extract information from context
        companions = extractCompanionsFromContext(context);
        income = extractIncomeFromContext(context);
        housing = extractHousingFromContext(context);
        timing = extractTimingFromContext(context);
        priority = context; // Full context becomes priority
        
        console.log("Mapped from new format:", { destination, movingFrom, companions, income, housing, timing, priority });
      } else {
        // Legacy format - use existing fields (but these properties don't exist in new schema)
        destination = validatedData.movingTo || "";
        movingFrom = validatedData.movingFrom || "";
        companions = "Not specified";
        income = "Not specified";
        housing = "Not specified";
        timing = "Flexible";
        priority = validatedData.context || "";
      }
      
      // Helper functions for context extraction
      function extractCompanionsFromContext(context: string): string {
        const companionKeywords = ['family', 'spouse', 'wife', 'husband', 'kids', 'children', 'child', 'partner', 'alone', 'myself', 'solo'];
        const matches = companionKeywords.filter(keyword => context.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          const familyMatch = context.match(/family\s+of\s+(\d+)/i);
          if (familyMatch) return `Family of ${familyMatch[1]}`;
          
          const kidsMatch = context.match(/(\d+)\s+(?:kids|children)/i);
          if (kidsMatch) return `${kidsMatch[1]} children`;
          
          if (context.toLowerCase().includes('alone') || context.toLowerCase().includes('myself') || context.toLowerCase().includes('solo')) {
            return "Moving alone";
          }
          
          if (context.toLowerCase().includes('spouse') || context.toLowerCase().includes('wife') || context.toLowerCase().includes('husband')) {
            return "Spouse/partner";
          }
          
          return "Family members mentioned";
        }
        return "Not specified";
      }

      function extractIncomeFromContext(context: string): string {
        const workKeywords = ['remote', 'job', 'work', 'business', 'startup', 'freelance', 'consultant', 'engineer', 'developer', 'salary'];
        const matches = workKeywords.filter(keyword => context.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          if (context.toLowerCase().includes('remote')) return "Remote work";
          if (context.toLowerCase().includes('startup')) return "Startup/business";
          if (context.toLowerCase().includes('engineer') || context.toLowerCase().includes('developer')) return "Tech/engineering";
          return "Work mentioned in context";
        }
        return "Not specified";
      }

      function extractHousingFromContext(context: string): string {
        const housingKeywords = ['rent', 'buy', 'house', 'apartment', 'lease', 'property', 'accommodation'];
        const matches = housingKeywords.filter(keyword => context.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          if (context.toLowerCase().includes('rent')) return "Planning to rent";
          if (context.toLowerCase().includes('buy')) return "Planning to buy";
          return "Housing mentioned in context";
        }
        return "Not specified";
      }

      function extractTimingFromContext(context: string): string {
        const timingKeywords = ['asap', 'soon', 'urgent', 'months', 'years', 'target', 'deadline', 'by'];
        const matches = timingKeywords.filter(keyword => context.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          const monthMatch = context.match(/(\w+)\s+(\d{4})/i);
          if (monthMatch) return `Target: ${monthMatch[1]} ${monthMatch[2]}`;
          
          if (context.toLowerCase().includes('asap') || context.toLowerCase().includes('soon') || context.toLowerCase().includes('urgent')) {
            return "As soon as possible";
          }
          
          return "Timing mentioned in context";
        }
        return "Flexible";
      }

      
      // Step 2: Create initial assessment to get ID for logging
      const assessment = await storage.createAssessment({
        ...validatedData,
        // Always populate legacy fields for compatibility
        destination,
        companions,
        income,
        housing,
        timing,
        priority,
        current_round: "1",
        max_rounds: "3",
        is_complete: "false"
      });

      // Step 3: Categorize the assessment data using LLM (with logging)
      console.log("Categorizing assessment with LLM...");
      const categorizedData = await categorizeAssessment(
        destination,
        movingFrom,
        companions,
        income,
        housing,
        timing,
        priority,
        assessment.id
      );

      // Step 4: Generate follow-up questions (with logging)
      console.log("Generating follow-up questions...");
      const followUpResult = await generateFollowUpQuestions(categorizedData, 1, 3, [], assessment.id);
      
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

      // Step 5: Log initial assessment in event system
      console.log("Creating event log entry for assessment:", assessment.id);
      
      // Log initial assessment event in append-only database
      await eventLog.addEvent({
        userId: assessment.id,
        eventType: 'initial_assessment',
        questionText: `Initial Assessment: Moving from ${movingFrom} to ${destination}`,
        userAnswer: `Context: ${validatedData.context}`,
        llmCategory: 'goal',
        llmTreatment: 'fact',
        llmConfidence: 1.0,
        roundNumber: 1,
        metadata: {
          movingFrom,
          movingTo: destination,
          originalFormat: 'simplified_3_questions',
          categorizedData,
          followUpQuestions: followUpResult.questions
        }
      });
      
      // Log each follow-up question as individual events
      for (let i = 0; i < followUpResult.questions.length; i++) {
        const question = followUpResult.questions[i];
        await eventLog.addEvent({
          userId: assessment.id,
          eventType: 'follow_up_question',
          questionText: question.question,
          llmCategory: question.category || 'general',
          llmTreatment: 'clarification_needed',
          llmConfidence: 0.8,
          roundNumber: 1,
          metadata: {
            questionIndex: i,
            reason: question.reason,
            questionId: `${assessment.id}-r1-q${i + 1}`
          }
        });
      }
      
      console.log("Event log entries created successfully");

      // Step 6: Update assessment with categorized data
      const updatedAssessment = await storage.updateAssessment(assessment.id, {
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
        assessmentId: updatedAssessment.id,
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

  // API endpoint to generate LLM-powered placeholder text
  app.post("/api/placeholders", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "Question is required" 
        });
      }

      const { generatePlaceholder } = await import("./llm");
      const placeholder = await generatePlaceholder(question);
      
      res.json({
        success: true,
        placeholder
      });
    } catch (error) {
      console.error("Placeholder generation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate placeholder",
        placeholder: "Provide specific details about your situation..."
      });
    }
  });

  // Debug endpoint to get list of assessments for selection
  app.get("/api/debug/assessments", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const assessments = await storage.getRecentAssessments(limit);
      
      const assessmentList = assessments.map(assessment => ({
        id: assessment.id,
        displayName: `${assessment.destination || 'Unknown'} - ${new Date(assessment.submittedAt).toLocaleString()}`,
        destination: assessment.destination,
        companions: assessment.companions,
        timing: assessment.timing,
        currentRound: assessment.current_round,
        isComplete: assessment.is_complete === "true",
        submittedAt: assessment.submittedAt,
        hasLlmLogs: true // We'll assume all assessments have logs for now
      }));
      
      res.json({ success: true, assessments: assessmentList });
    } catch (error) {
      console.error("Get assessments error:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Debug endpoint to get detailed LLM processing info for a specific assessment
  app.get("/api/debug/llm/:assessmentId", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      
      // Get assessment data
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found" });
      }

      // Get all LLM logs for this assessment
      const llmLogs = await storage.getLlmLogs(assessmentId);
      
      // Get all prompts used
      const prompts = await storage.getAllPrompts();
      
      // Build comprehensive debug info
      const debugInfo = {
        assessment: {
          id: assessment.id,
          created: assessment.submittedAt,
          currentRound: assessment.current_round,
          isComplete: assessment.is_complete === "true",
          originalInputs: {
            destination: assessment.destination,
            companions: assessment.companions,
            income: assessment.income,
            housing: assessment.housing,
            timing: assessment.timing,
            priority: assessment.priority
          },
          categorizedData: {
            goal: assessment.goal,
            finance: assessment.finance,
            family: assessment.family,
            housing: assessment.housing_categorized,
            work: assessment.work,
            immigration: assessment.immigration,
            education: assessment.education,
            tax: assessment.tax,
            healthcare: assessment.healthcare,
            other: assessment.other,
            outstanding_clarifications: assessment.outstanding_clarifications
          }
        },
        llmInteractions: llmLogs.map((log: any) => ({
          id: log.id,
          operation: log.operation,
          round: log.round,
          timestamp: log.created_at,
          promptTemplate: log.promptTemplate,
          systemPrompt: log.systemPrompt,
          userPrompt: log.promptUsed,
          inputData: JSON.parse(log.inputData || "{}"),
          rawLlmResponse: log.llmResponse,
          parsedResult: log.parsedResult ? JSON.parse(log.parsedResult) : null,
          model: log.model,
          temperature: log.temperature,
          tokensUsed: log.tokensUsed,
          responseTimeMs: log.responseTimeMs,
          success: log.success
        })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
        availablePrompts: prompts.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description
        }))
      };
      
      res.json({ success: true, data: debugInfo });
    } catch (error) {
      console.error("LLM Debug error:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
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
      
      // Log follow-up answers in event system
      console.log("Logging follow-up answers in event system");
      
      // Log each answer as a separate event
      for (const [index, answer] of Object.entries(answers)) {
        const questionIndex = parseInt(index);
        console.log(`Logging answer ${questionIndex}: "${answer}"`);
        
        // Get the original question from the initial assessment events
        const questionEvents = await eventLog.getEventsByType(assessmentId, 'follow_up_question');
        const questionEvent = questionEvents.find(event => 
          event.metadata?.questionIndex === questionIndex && event.roundNumber === currentRound
        );
        
        if (questionEvent) {
          await eventLog.addEvent({
            userId: assessmentId,
            eventType: 'follow_up_answer',
            questionText: questionEvent.questionText,
            userAnswer: answer as string,
            llmCategory: questionEvent.llmCategory,
            llmTreatment: 'fact', // Will be updated by LLM analysis
            llmConfidence: 0.9,
            roundNumber: currentRound,
            metadata: {
              questionIndex,
              originalQuestionId: questionEvent.id,
              answeredAt: new Date().toISOString()
            }
          });
          console.log(`✓ Logged answer ${questionIndex} for question: ${questionEvent.questionText.substring(0, 50)}...`);
        } else {
          console.log(`✗ No question event found for index ${questionIndex} in round ${currentRound}`);
        }
      }
      
      // Log LLM categorization event
      await eventLog.addEvent({
        userId: assessmentId,
        eventType: 'categorization',
        llmCategory: 'multiple',
        llmTreatment: 'fact',
        llmConfidence: 0.85,
        roundNumber: currentRound,
        metadata: {
          updatedCategories,
          processedAnswers: Object.keys(answers).length,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log("Event logging completed for follow-up answers");
      
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
        
        // Log new follow-up questions as events
        if (followUpResult.questions.length > 0) {
          for (let i = 0; i < followUpResult.questions.length; i++) {
            const question = followUpResult.questions[i];
            await eventLog.addEvent({
              userId: assessmentId,
              eventType: 'follow_up_question',
              questionText: question.question,
              llmCategory: question.category || 'general',
              llmTreatment: 'clarification_needed',
              llmConfidence: 0.8,
              roundNumber: nextRound,
              metadata: {
                questionIndex: i,
                reason: question.reason,
                questionId: `${assessmentId}-r${nextRound}-q${i + 1}`
              }
            });
          }
          console.log(`Logged ${followUpResult.questions.length} new questions for round ${nextRound}`);
        }
        
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
        
        // Mark assessment as complete in event system
        await eventLog.addEvent({
          userId: assessmentId,
          eventType: 'assessment_completed',
          llmCategory: 'completion',
          llmTreatment: 'fact',
          llmConfidence: 1.0,
          roundNumber: currentRound,
          metadata: {
            completedAt: new Date().toISOString(),
            totalRounds: currentRound,
            finalCategories: updatedCategories
          }
        });
        console.log("Assessment marked as complete in event system");
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

  // Case State Management API routes
  app.get("/api/case-states", async (req, res) => {
    try {
      const caseIds = await CaseState.listCaseStates();
      res.json({ success: true, caseIds });
    } catch (error) {
      console.error("Error listing case states:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to list case states" 
      });
    }
  });

  app.get("/api/case-states/:assessmentId", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const caseState = await CaseState.loadCaseState(assessmentId);
      
      if (!caseState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      res.json({ success: true, caseState });
    } catch (error) {
      console.error("Error loading case state:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to load case state" 
      });
    }
  });

  app.post("/api/case-states/:assessmentId", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { maxRounds = 3 } = req.body;
      
      // Create new case state
      const caseState = CaseState.createNewCaseState(assessmentId, maxRounds);
      await CaseState.saveCaseState(caseState);
      
      res.json({ 
        success: true, 
        caseState, 
        message: "Case state created successfully" 
      });
    } catch (error) {
      console.error("Error creating case state:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to create case state" 
      });
    }
  });

  app.put("/api/case-states/:assessmentId/snapshot", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { snapshot } = req.body;
      
      const existingState = await CaseState.loadCaseState(assessmentId);
      if (!existingState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const updatedState = CaseState.mergeSnapshot(existingState, snapshot);
      await CaseState.saveCaseState(updatedState);
      
      res.json({ 
        success: true, 
        caseState: updatedState, 
        message: "Snapshot updated successfully" 
      });
    } catch (error) {
      console.error("Error updating snapshot:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update snapshot" 
      });
    }
  });

  app.post("/api/case-states/:assessmentId/questions", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { questions } = req.body;
      
      const existingState = await CaseState.loadCaseState(assessmentId);
      if (!existingState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const updatedState = CaseState.appendQuestions(existingState, questions);
      await CaseState.saveCaseState(updatedState);
      
      res.json({ 
        success: true, 
        caseState: updatedState, 
        message: "Questions added successfully" 
      });
    } catch (error) {
      console.error("Error adding questions:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to add questions" 
      });
    }
  });

  app.put("/api/case-states/:assessmentId/answers", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { answers } = req.body;
      
      const existingState = await CaseState.loadCaseState(assessmentId);
      if (!existingState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const updatedState = CaseState.recordAnswers(existingState, answers);
      await CaseState.saveCaseState(updatedState);
      
      res.json({ 
        success: true, 
        caseState: updatedState, 
        message: "Answers recorded successfully" 
      });
    } catch (error) {
      console.error("Error recording answers:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to record answers" 
      });
    }
  });

  app.post("/api/case-states/:assessmentId/advance", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      
      const existingState = await CaseState.loadCaseState(assessmentId);
      if (!existingState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const updatedState = CaseState.advanceRound(existingState);
      await CaseState.saveCaseState(updatedState);
      
      res.json({ 
        success: true, 
        caseState: updatedState, 
        message: "Advanced to next round successfully" 
      });
    } catch (error) {
      console.error("Error advancing round:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to advance round" 
      });
    }
  });

  app.post("/api/case-states/:assessmentId/complete", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      
      const existingState = await CaseState.loadCaseState(assessmentId);
      if (!existingState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const updatedState = CaseState.markComplete(existingState);
      await CaseState.saveCaseState(updatedState);
      
      res.json({ 
        success: true, 
        caseState: updatedState, 
        message: "Case marked as complete successfully" 
      });
    } catch (error) {
      console.error("Error marking case complete:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to mark case complete" 
      });
    }
  });

  app.get("/api/case-states/:assessmentId/for-llm", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      
      const caseState = await CaseState.loadCaseState(assessmentId);
      if (!caseState) {
        return res.status(404).json({ 
          success: false, 
          error: "Case state not found" 
        });
      }
      
      const llmFormat = CaseState.formatForLLM(caseState);
      res.json({ success: true, data: llmFormat });
    } catch (error) {
      console.error("Error formatting for LLM:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to format for LLM" 
      });
    }
  });

  // Seed pricing packages on startup
  await seedPricingPackages();

  // Setup event routes for append-only database viewing
  setupEventRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
