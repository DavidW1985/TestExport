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

export interface PlaceholderResult {
  placeholder: string;
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
export async function generatePlaceholder(question: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are helping create a contextual placeholder example for an emigration assessment question.

QUESTION: "${question}"

Generate a realistic, specific placeholder example that shows the user exactly what kind of answer would be helpful. Follow these rules:

1. Make it specific and actionable (not vague)
2. Use realistic details (proper amounts, timeframes, locations)
3. Keep it concise (under 100 characters)
4. Start with "e.g., " 
5. Show 1-2 realistic examples separated by "or"

Examples of good placeholders:
- For "What is your current citizenship?": "e.g., 'German citizen' or 'US passport holder'"
- For "What is your monthly housing budget?": "e.g., '€1,500/month' or 'Up to $2,000'"
- For "Do you have children moving with you?": "e.g., 'Yes, ages 8 and 12' or 'No children'"

Return ONLY the placeholder text, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    });

    const placeholder = response.choices[0].message.content?.trim() || "Provide specific details...";
    
    // Log the interaction
    await logLlmInteraction({
      operation: "generate_placeholder",
      promptUsed: prompt,
      systemPrompt: "",
      inputData: question,
      llmResponse: placeholder,
      parsedResult: placeholder,
      model: "gpt-4o",
      temperature: 0.3,
      tokensUsed: response.usage?.total_tokens || 0,
      responseTimeMs: Date.now() - startTime,
      assessmentId: null,
      success: "true"
    });

    return placeholder;
  } catch (error) {
    console.error("Error generating placeholder:", error);
    
    // Log the error
    await logLlmInteraction({
      operation: "generate_placeholder",
      promptUsed: `Question: ${question}`,
      systemPrompt: "",
      inputData: question,
      llmResponse: "",
      parsedResult: "",
      model: "gpt-4o",
      temperature: 0.3,
      tokensUsed: 0,
      responseTimeMs: Date.now() - startTime,
      assessmentId: null,
      success: error instanceof Error ? error.message : "Unknown error"
    });

    return "Provide specific details about your situation...";
  }
}
