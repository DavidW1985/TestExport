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

// Default prompts
export const DEFAULT_PROMPTS: Record<string, PromptConfig> = {
  categorization: {
    id: "categorization",
    name: "Assessment Categorization",
    description: "Categorizes initial assessment responses into structured categories",
    systemPrompt: "You are an expert emigration consultant. Analyze emigration assessment responses and categorize information precisely. Always ask about the user's current location/citizenship if not provided. Respond only with valid JSON.",
    userPrompt: `You are an expert emigration consultant. Analyze the following emigration assessment responses and categorize the information into the specified categories. Extract relevant information from each response and place it in the most appropriate category.

User Responses:
- Destination: {{destination}}
- Who's moving: {{companions}}
- Income source: {{income}}
- Housing plan: {{housing}}
- Timing: {{timing}}
- Most important: {{priority}}

CRITICAL: Notice that the user has NOT told us where they're emigrating FROM. This is essential for:
- Tax implications and residency rules
- Visa requirements and citizenship considerations
- Legal documentation needs
- Cost calculations and timelines

Please categorize this information into these exact categories and return as JSON:

{
  "goal": "The single main goal the user wants to achieve (e.g., 'Move to Portugal with family in 6 months')",
  "finance": "Income, assets, savings, or other financial situation relevant to the move",
  "family": "Household composition, ages of children, dependents, etc.",
  "housing": "Current housing situation and target housing needs in the destination country",
  "work": "Employment status, remote work, company ownership, etc.",
  "immigration": "Visa type, citizenship, special permits needed - MUST include current citizenship/residence",
  "education": "Schooling requirements for children",
  "tax": "Tax residency, optimization needs, cross-border complexities",
  "healthcare": "Insurance, medical requirements, ongoing treatments",
  "other": "Miscellaneous information that doesn't fit other categories",
  "outstanding_clarifications": "Questions still unanswered that need clarification for proper emigration planning - ALWAYS include asking for current country/citizenship if not provided"
}

Extract specific details from the responses and place them in the most relevant categories. If information is not provided for a category, leave it empty. Focus on extracting concrete, actionable information.`,
    temperature: 0.3,
    maxTokens: 1500,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  followUp: {
    id: "followUp",
    name: "Follow-up Question Generation",
    description: "Generates targeted follow-up questions based on categorized data",
    systemPrompt: "You are an expert emigration consultant. Generate targeted follow-up questions to gather critical emigration planning information. Always prioritize asking about current location/citizenship if missing. Respond only with valid JSON.",
    userPrompt: `You are an expert emigration consultant conducting a detailed assessment. Based on the categorized information below, generate 3-5 targeted follow-up questions to gather critical missing information for emigration planning.

Current Assessment Data:
{{categorizedData}}

Context:
- This is round {{currentRound}} of {{maxRounds}} follow-up rounds
- You need to gather essential information for emigration planning and eventual pricing/package matching
- Focus on the most critical gaps that would affect legal requirements, costs, and timeline
{{previousQuestions}}

PRIORITY: If the user's current country/citizenship is unknown, this MUST be the first question.

Generate follow-up questions that will help:
1. Determine current location and citizenship status (CRITICAL if missing)
2. Assess legal/visa requirements
3. Understand financial needs and costs
4. Identify timeline constraints
5. Spot potential complications or special needs
6. Gather information needed for expert handoff

Return your response as JSON with this structure:
{
  "questions": [
    {
      "question": "Clear, direct question (keep it simple and specific)",
      "category": "Which category this question helps fill",
      "reason": "Brief reason (1 sentence max)"
    }
  ],
  "isComplete": boolean (true if you have enough information for basic emigration planning),
  "reasoning": "Brief explanation of assessment (2-3 sentences max)"
}

Requirements for questions:
- Use simple, everyday language
- Ask one thing at a time
- Keep questions under 15 words when possible
- Focus on the most critical gaps only
- Make questions actionable and specific
- ALWAYS ask about current country/citizenship if missing`,
    temperature: 0.4,
    maxTokens: 1200,
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  updateCategories: {
    id: "updateCategories", 
    name: "Category Update",
    description: "Updates existing categories with new follow-up answer information",
    systemPrompt: "You are an expert emigration consultant. Update categorized data with new information. Respond only with valid JSON.",
    userPrompt: `You are an expert emigration consultant. Update the existing categorized emigration data with new follow-up answers.

Existing Categories:
{{existingCategories}}

New Follow-up Answers:
{{followUpAnswers}}

Please update the existing categories by incorporating the new information. Merge the new answers into the appropriate categories, maintaining all existing information while adding the new details.

Return the updated categories as JSON with the same structure:
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