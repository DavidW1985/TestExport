// Prompt management system for LLM interactions
export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

// Global system prompt for all tasks
const GLOBAL_SYSTEM_PROMPT = `You are Clarity, an expert emigration consultant specializing in international relocations.
You work over multiple rounds to reach a "clear-enough" plan with minimal user effort.

CRITICAL RULE: Never ask for information that has already been clearly provided in the user's input.

Global rules (always apply):
- Output must be valid JSON matching the requested schema for the current MODE.
- NEVER ask for information already present unless unclear or contradictory.
- If destination country is clearly specified (e.g., "Italy", "Netherlands"), do NOT ask which country they're moving to.
- If moving from location is clearly specified, do NOT ask where they're moving from.
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
  systemPrompt: {
    id: "systemPrompt",
    name: "Global System Prompt",
    description: "The unified system prompt used across all Clarity modes",
    systemPrompt: "", // Not used for this meta-prompt
    userPrompt: GLOBAL_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1500,
    model: "gpt-4o",
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  globalPrompt: {
    id: "globalPrompt", 
    name: "Global Prompt Template",
    description: "Base template and rules that can be referenced by all mode-specific prompts",
    systemPrompt: "", // Not used for this meta-prompt
    userPrompt: `Global Template Variables and Rules:

Template Variables Available:
- {{destination}} - Target emigration destination
- {{companions}} - Who is moving (family composition)
- {{income}} - Income source information  
- {{housing}} - Housing plans and situation
- {{timing}} - Timeline for the move
- {{priority}} - What's most important to the user
- {{categorizedData}} - Previously categorized assessment data
- {{currentRound}} - Current follow-up round number
- {{maxRounds}} - Maximum follow-up rounds allowed
- {{previousQuestions}} - Previously asked questions
- {{existingCategories}} - Existing category data
- {{followUpAnswers}} - New follow-up answers to process

Global Completion Criteria:
- Current country & citizenship status known
- Destination country confirmed
- Timeline established
- Dependents situation clarified
- Work/visa situation understood
- Key financial information (income/assets) gathered

Priority Order for Information Gathering:
1. Current country & citizenship (CRITICAL)
2. Legal/visa requirements 
3. Timeline constraints
4. Dependents (children, elderly, etc.)
5. Work status and visa implications
6. Financial capacity (income, assets)
7. Lifestyle preferences (housing, education, etc.)`,
    temperature: 0.3,
    maxTokens: 1500,
    model: "gpt-4o",
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  placeholder_generation: {
    id: "placeholder_generation",
    name: "Placeholder Text Generation",
    description: "Generates contextual placeholder text for emigration assessment questions",
    systemPrompt: "",
    userPrompt: `You are helping create a contextual placeholder example for an emigration assessment question.

QUESTION: "{{question}}"

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

Return ONLY the placeholder text, nothing else.`,
    temperature: 0.3,
    maxTokens: 100,
    model: "gpt-4o",
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  categorization: {
    id: "categorization",
    name: "Assessment Categorization (MODE=categorize)",
    description: "Categorizes initial assessment responses into structured categories",
    systemPrompt: GLOBAL_SYSTEM_PROMPT,
    model: "gpt-4o",
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
    model: "gpt-4o",
    userPrompt: `MODE=ask_followups

Current Assessment Data:
{{categorizedData}}

Context:
- This is round {{currentRound}} of {{maxRounds}} follow-up rounds
{{previousQuestions}}

IMPORTANT: Before generating questions, check what information is already provided:
- If destination country is specified in the "goal" field, do NOT ask which country they're moving to
- If current location/citizenship is mentioned, do NOT ask where they're moving from
- Focus ONLY on missing critical information

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
    model: "gpt-4o",
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

  static getGlobalSystemPrompt(): string {
    const systemPrompt = promptsStorage.get('systemPrompt');
    return systemPrompt ? systemPrompt.userPrompt : GLOBAL_SYSTEM_PROMPT;
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