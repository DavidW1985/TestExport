import OpenAI from "openai";
import { storage } from "./storage";
import type { InsertLlmLog } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced logging function for LLM interactions
async function logLlmInteraction(logData: InsertLlmLog): Promise<void> {
  try {
    await storage.createLlmLog(logData);
  } catch (error) {
    console.error("Failed to log LLM interaction:", error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

export interface CategorizationResult {
  goal: string;
  finance: string;
  family: string;
  housing: string;
  work: string;
  immigration: string;
  education: string;
  tax: string;
  healthcare: string;
  other: string;
  outstanding_clarifications: string;
}

export interface FollowUpQuestion {
  question: string;
  category: string;
  reason: string;
}

export interface FollowUpResult {
  questions: FollowUpQuestion[];
  isComplete: boolean;
  reasoning: string;
}

// Helper function to render prompts with variables
function renderPrompt(template: string, variables: Record<string, any>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
  }
  return rendered;
}

export async function categorizeAssessment(
  destination: string,
  movingFrom: string,
  companions: string,
  income: string,
  housing: string,
  timing: string,
  priority: string,
  assessmentId?: string
): Promise<CategorizationResult> {
  const [promptConfig, systemPrompt] = await Promise.all([
    storage.getPrompt('categorization'),
    storage.getPrompt('systemPrompt')
  ]);
  
  if (!promptConfig) {
    throw new Error('Categorization prompt not found');
  }
  if (!systemPrompt) {
    throw new Error('System prompt not found');
  }

  const inputData = { destination, movingFrom, companions, income, housing, timing, priority };
  const userPrompt = renderPrompt(promptConfig.userPrompt, inputData);
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt.userPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.maxTokens
    });

    const responseTime = Date.now() - startTime;
    const rawResponse = response.choices[0].message.content!;
    const result = JSON.parse(rawResponse) as CategorizationResult;

    // Log the interaction
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "categorize",
        round: 1,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: rawResponse,
        parsedResult: JSON.stringify(result),
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: response.usage?.total_tokens || null,
        responseTimeMs: responseTime,
        success: "true"
      });
    }

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Log the error
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "categorize",
        round: 1,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: "",
        parsedResult: "",
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: null,
        responseTimeMs: responseTime,
        success: error instanceof Error ? error.message : "Unknown error"
      });
    }

    throw error;
  }
}

export async function generateFollowUpQuestions(
  categorizedData: CategorizationResult,
  currentRound: number,
  maxRounds: number,
  previousQuestions?: string[],
  assessmentId?: string
): Promise<FollowUpResult> {
  const [promptConfig, systemPrompt] = await Promise.all([
    storage.getPrompt('followUp'),
    storage.getPrompt('systemPrompt')
  ]);
  
  if (!promptConfig) {
    throw new Error('Follow-up prompt not found');
  }
  if (!systemPrompt) {
    throw new Error('System prompt not found');
  }

  const inputData = {
    categorizedData: JSON.stringify(categorizedData, null, 2),
    currentRound,
    maxRounds,
    previousQuestions: previousQuestions ? `- Previous questions asked: ${previousQuestions.join(', ')}` : ''
  };
  const userPrompt = renderPrompt(promptConfig.userPrompt, inputData);
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt.userPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.maxTokens
    });

    const responseTime = Date.now() - startTime;
    const rawResponse = response.choices[0].message.content!;
    let result: FollowUpResult;
    
    try {
      result = JSON.parse(rawResponse) as FollowUpResult;
      
      // Validate the structure and provide defaults
      if (!result.questions || !Array.isArray(result.questions)) {
        console.warn("LLM response missing or invalid questions array, providing fallback");
        result.questions = [];
      }
      
      if (typeof result.isComplete !== 'boolean') {
        result.isComplete = false;
      }
      
      if (!result.reasoning) {
        result.reasoning = "Follow-up questions generated successfully.";
      }
      
      console.log("Parsed LLM result:", {
        questionsCount: result.questions.length,
        isComplete: result.isComplete,
        hasReasoning: !!result.reasoning
      });
      
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError);
      console.error("Raw response:", rawResponse);
      
      // Provide fallback structure
      result = {
        questions: [],
        isComplete: true,
        reasoning: "Failed to parse LLM response. Assessment marked as complete."
      };
    }

    // Log the interaction
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "followup",
        round: currentRound,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: rawResponse,
        parsedResult: JSON.stringify(result),
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: response.usage?.total_tokens || null,
        responseTimeMs: responseTime,
        success: "true"
      });
    }

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Log the error
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "followup",
        round: currentRound,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: "",
        parsedResult: "",
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: null,
        responseTimeMs: responseTime,
        success: error instanceof Error ? error.message : "Unknown error"
      });
    }

    throw error;
  }
}

export async function updateCategoriesWithFollowUp(
  existingCategories: CategorizationResult,
  followUpAnswers: Record<string, string>,
  assessmentId?: string,
  currentRound?: number
): Promise<CategorizationResult> {
  const [promptConfig, systemPrompt] = await Promise.all([
    storage.getPrompt('updateCategories'),
    storage.getPrompt('systemPrompt')
  ]);
  
  if (!promptConfig) {
    throw new Error('Update categories prompt not found');
  }
  if (!systemPrompt) {
    throw new Error('System prompt not found');
  }

  const inputData = {
    existingCategories: JSON.stringify(existingCategories, null, 2),
    followUpAnswers: JSON.stringify(followUpAnswers, null, 2)
  };
  const userPrompt = renderPrompt(promptConfig.userPrompt, inputData);
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt.userPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.maxTokens
    });

    const responseTime = Date.now() - startTime;
    const rawResponse = response.choices[0].message.content!;
    const result = JSON.parse(rawResponse) as CategorizationResult;

    // Log the interaction
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "update",
        round: currentRound || 1,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: rawResponse,
        parsedResult: JSON.stringify(result),
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: response.usage?.total_tokens || null,
        responseTimeMs: responseTime,
        success: "true"
      });
    }

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Log the error
    if (assessmentId) {
      await logLlmInteraction({
        assessmentId,
        operation: "update",
        round: currentRound || 1,
        promptUsed: userPrompt,
        promptTemplate: promptConfig.name, // Show which specific prompt was used
        systemPrompt: systemPrompt.userPrompt,
        inputData: JSON.stringify(inputData),
        llmResponse: "",
        parsedResult: "",
        model: "gpt-4o",
        temperature: promptConfig.temperature,
        tokensUsed: null,
        responseTimeMs: responseTime,
        success: error instanceof Error ? error.message : "Unknown error"
      });
    }

    throw error;
  }
}