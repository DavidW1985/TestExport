import OpenAI from "openai";

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

export async function categorizeAssessment(
  destination: string,
  companions: string,
  income: string,
  housing: string,
  timing: string,
  priority: string
): Promise<CategorizationResult> {
  const prompt = `You are an expert emigration consultant. Analyze the following emigration assessment responses and categorize the information into the specified categories. Extract relevant information from each response and place it in the most appropriate category.

User Responses:
- Destination: ${destination}
- Who's moving: ${companions}
- Income source: ${income}
- Housing plan: ${housing}
- Timing: ${timing}
- Most important: ${priority}

Please categorize this information into these exact categories and return as JSON:

{
  "goal": "The single main goal the user wants to achieve (e.g., 'Move to Portugal with family in 6 months')",
  "finance": "Income, assets, savings, or other financial situation relevant to the move",
  "family": "Household composition, ages of children, dependents, etc.",
  "housing": "Current housing situation and target housing needs in the destination country",
  "work": "Employment status, remote work, company ownership, etc.",
  "immigration": "Visa type, citizenship, special permits needed",
  "education": "Schooling requirements for children",
  "tax": "Tax residency, optimization needs, cross-border complexities",
  "healthcare": "Insurance, medical requirements, ongoing treatments",
  "other": "Miscellaneous information that doesn't fit other categories",
  "outstanding_clarifications": "Questions still unanswered that need clarification for proper emigration planning"
}

Extract specific details from the responses and place them in the most relevant categories. If information is not provided for a category, leave it empty. Focus on extracting concrete, actionable information.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert emigration consultant. Analyze emigration assessment responses and categorize information precisely. Respond only with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
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
  const prompt = `You are an expert emigration consultant conducting a detailed assessment. Based on the categorized information below, generate 3-5 targeted follow-up questions to gather critical missing information for emigration planning.

Current Assessment Data:
${JSON.stringify(categorizedData, null, 2)}

Context:
- This is round ${currentRound} of ${maxRounds} follow-up rounds
- You need to gather essential information for emigration planning and eventual pricing/package matching
- Focus on the most critical gaps that would affect legal requirements, costs, and timeline
${previousQuestions ? `- Previous questions asked: ${previousQuestions.join(', ')}` : ''}

Generate follow-up questions that will help:
1. Determine legal/visa requirements
2. Assess financial needs and costs
3. Understand timeline constraints
4. Identify potential complications or special needs
5. Gather information needed for expert handoff

Return your response as JSON with this structure:
{
  "questions": [
    {
      "question": "Specific question to ask the user",
      "category": "Which category this question helps fill",
      "reason": "Why this question is important for emigration planning"
    }
  ],
  "isComplete": boolean (true if you have enough information for basic emigration planning),
  "reasoning": "Explanation of your assessment and what's still needed"
}

Prioritize the most critical missing information first. Questions should be clear, specific, and actionable.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert emigration consultant. Generate targeted follow-up questions to gather critical emigration planning information. Respond only with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.4
  });

  const result = JSON.parse(response.choices[0].message.content!);
  return result as FollowUpResult;
}

export async function updateCategoriesWithFollowUp(
  existingCategories: CategorizationResult,
  followUpAnswers: Record<string, string>
): Promise<CategorizationResult> {
  const prompt = `You are an expert emigration consultant. Update the existing categorized emigration data with new follow-up answers.

Existing Categories:
${JSON.stringify(existingCategories, null, 2)}

New Follow-up Answers:
${JSON.stringify(followUpAnswers, null, 2)}

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
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert emigration consultant. Update categorized data with new information. Respond only with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });

  const result = JSON.parse(response.choices[0].message.content!);
  return result as CategorizationResult;
}