// Prompt management system for LLM interactions
export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

// Global system prompt for all tasks
const GLOBAL_SYSTEM_PROMPT = `You are Clarity, an expert emigration consultant (initial focus: EU → other EU country, but handle other routes when present).
You work over multiple rounds to reach a "clear-enough" plan with minimal user effort.

Global rules (always apply):
- Output must be valid JSON matching the requested schema for the current MODE.
- Never ask for information already present unless unclear or contradictory.
- Prioritize legal/visa, timeline, dependents, work status, and finance before lifestyle details.
- Keep questions simple, one thing at a time, ≤ 15 words where possible.
- Be conservative: if unsure, ask a targeted clarification rather than assuming.
- Use the category names exactly as provided in the input state.
- Do not hallucinate; if unknown, mark as unknown and propose the single most useful next question.

You operate in one of these MODES per call:
- MODE=categorize: turn free text/context into a structured state
- MODE=ask_followups: generate the next 3–5 critical questions and an isComplete flag.
- MODE=update: apply user edits to the clarity_state, re-check downstream implications, and produce a refreshed state plus any new targeted questions.

Completion definition ("clear-enough"):
We know: current country & citizenship, destination, timeline, dependents, work/visa situation, key finance (income/assets).`;

// Default prompts
export const DEFAULT_PROMPTS: Record<string, PromptConfig> = {
  categorization: {
    id: "categorization",
    name: "Assessment Categorization (MODE=categorize)",
    description: "Categorizes initial assessment responses into structured categories",
    systemPrompt: GLOBAL_SYSTEM_PROMPT,
    userPrompt: `MODE=categorize

User Responses:
- Destination: {{destination}}
- Who's moving: {{companions}}
- Income source: {{income}}
- Housing plan: {{housing}}
- Timing: {{timing}}
- Most important: {{priority}}

Turn this free text into structured categories. Extract specific details and place them in the most relevant categories. If information is not provided for a category, leave it empty.

Return as JSON:
{
  "goal": "The single main goal (e.g., 'Move to Portugal with family in 6 months')",
  "finance": "Income, assets, savings, or other financial situation",
  "family": "Household composition, ages of children, dependents, etc.",
  "housing": "Current housing situation and target housing needs",
  "work": "Employment status, remote work, company ownership, etc.",
  "immigration": "Visa type, citizenship, special permits needed",
  "education": "Schooling requirements for children",
  "tax": "Tax residency, optimization needs, cross-border complexities",
  "healthcare": "Insurance, medical requirements, ongoing treatments",
  "other": "Miscellaneous information that doesn't fit other categories",
  "outstanding_clarifications": "Critical missing information for emigration planning"
}`,
    temperature: 0.3,
    maxTokens: 1500,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  followUp: {
    id: "followUp",
    name: "Follow-up Question Generation (MODE=ask_followups)",
    description: "Generates targeted follow-up questions based on categorized data",
    systemPrompt: GLOBAL_SYSTEM_PROMPT,
    userPrompt: `MODE=ask_followups

Current Assessment Data:
{{categorizedData}}

Context:
- This is round {{currentRound}} of {{maxRounds}} follow-up rounds
{{previousQuestions}}

Generate 3-5 targeted follow-up questions to reach "clear-enough" status. Focus on the most critical gaps for legal requirements, costs, and timeline.

Return as JSON:
{
  "questions": [
    {
      "question": "Clear, direct question (simple, ≤15 words)",
      "category": "Which category this question fills",
      "reason": "Brief reason (1 sentence max)"
    }
  ],
  "isComplete": boolean (true if we have current country/citizenship, destination, timeline, dependents, work/visa, key finance),
  "reasoning": "Brief assessment explanation (2-3 sentences max)"
}`,
    temperature: 0.4,
    maxTokens: 1200,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  updateCategories: {
    id: "updateCategories", 
    name: "Category Update (MODE=update)",
    description: "Updates existing categories with new follow-up answer information",
    systemPrompt: GLOBAL_SYSTEM_PROMPT,
    userPrompt: `MODE=update

Existing Categories:
{{existingCategories}}

New Follow-up Answers:
{{followUpAnswers}}

Update the existing categories by incorporating the new information. Merge new answers into appropriate categories, maintaining all existing information while adding new details.

Return updated categories as JSON with the same structure:
{
  "goal": "Updated goal information",
  "finance": "Updated finance information", 
  "family": "Updated family information",
  "housing": "Updated housing information",
  "work": "Updated work information",
  "immigration": "Updated immigration information",
  "education": "Updated education information",
  "tax": "Updated tax information",
  "healthcare": "Updated healthcare information",
  "other": "Updated other information",
  "outstanding_clarifications": "Updated outstanding clarifications"
}`,
    temperature: 0.3,
    maxTokens: 1200,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
};

// In-memory storage for prompts (replace with database in production)
let promptsStorage: Map<string, PromptConfig> = new Map();

// Initialize with defaults
Object.values(DEFAULT_PROMPTS).forEach(prompt => {
  promptsStorage.set(prompt.id, prompt);
});

export class PromptManager {
  static getAllPrompts(): PromptConfig[] {
    return Array.from(promptsStorage.values());
  }

  static getPrompt(id: string): PromptConfig | undefined {
    return promptsStorage.get(id);
  }

  static updatePrompt(id: string, updates: Partial<PromptConfig>): PromptConfig {
    const existing = promptsStorage.get(id);
    if (!existing) {
      throw new Error(`Prompt with id ${id} not found`);
    }

    const updated: PromptConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    promptsStorage.set(id, updated);
    return updated;
  }

  static createPrompt(prompt: Omit<PromptConfig, 'createdAt' | 'updatedAt'>): PromptConfig {
    const newPrompt: PromptConfig = {
      ...prompt,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    promptsStorage.set(prompt.id, newPrompt);
    return newPrompt;
  }

  static deletePrompt(id: string): boolean {
    return promptsStorage.delete(id);
  }

  static renderPrompt(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    return rendered;
  }
}