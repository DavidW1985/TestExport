import OpenAI from "openai";
import { storage } from "./storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  companions: string,
  income: string,
  housing: string,
  timing: string,
  priority: string
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

  const userPrompt = renderPrompt(promptConfig.userPrompt, {
    destination,
    companions,
    income,
    housing,
    timing,
    priority
  });



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

  const result = JSON.parse(response.choices[0].message.content!);
  return result as CategorizationResult;
}

export async function generateFollowUpQuestions(
  categorizedData: CategorizationResult,
  currentRound: number,
  maxRounds: number,
  previousQuestions?: string[]
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

  const userPrompt = renderPrompt(promptConfig.userPrompt, {
    categorizedData: JSON.stringify(categorizedData, null, 2),
    currentRound,
    maxRounds,
    previousQuestions: previousQuestions ? `- Previous questions asked: ${previousQuestions.join(', ')}` : ''
  });



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

  const result = JSON.parse(response.choices[0].message.content!);
  return result as FollowUpResult;
}

export async function updateCategoriesWithFollowUp(
  existingCategories: CategorizationResult,
  followUpAnswers: Record<string, string>
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

  const userPrompt = renderPrompt(promptConfig.userPrompt, {
    existingCategories: JSON.stringify(existingCategories, null, 2),
    followUpAnswers: JSON.stringify(followUpAnswers, null, 2)
  });

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

  const result = JSON.parse(response.choices[0].message.content!);
  return result as CategorizationResult;
}