import OpenAI from "openai";
import { storage } from "./storage";
import type { Assessment, CategorizationResult, PricingPackage, InsertAssessmentPackageMatch } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const DEFAULT_MODEL = "gpt-4o";

export interface PackageMatchResult {
  recommendedPackageId: string;
  matchScore: number; // 0-1 confidence score
  reasoning: string;
  alternativePackages?: {
    packageId: string;
    score: number;
    reason: string;
  }[];
}

export async function matchUserToPackage(
  assessment: Assessment,
  categorizedData: CategorizationResult,
  assessmentId?: string
): Promise<PackageMatchResult> {
  // Get all available pricing packages
  const packages = await storage.getAllPricingPackages();
  
  if (packages.length === 0) {
    throw new Error("No pricing packages available for matching");
  }

  // Prepare context data for the LLM
  const userContext = {
    destination: assessment.destination,
    companions: assessment.companions,
    income: assessment.income,
    housing: assessment.housing,
    timing: assessment.timing,
    priority: assessment.priority,
    categorizedData: categorizedData
  };

  const packagesContext = packages.map(pkg => ({
    id: pkg.id,
    name: pkg.name,
    displayName: pkg.displayName,
    description: pkg.description,
    price: pkg.price,
    targetIncomeLevel: pkg.targetIncomeLevel,
    complexityLevel: pkg.complexityLevel,
    familySize: pkg.familySize,
    urgencyLevel: pkg.urgencyLevel,
    destinationTypes: pkg.destinationTypes ? JSON.parse(pkg.destinationTypes) : [],
    services: {
      visaSupport: pkg.includesVisaSupport,
      housingSearch: pkg.includesHousingSearch,
      taxAdvice: pkg.includesTaxAdvice,
      educationPlanning: pkg.includesEducationPlanning,
      healthcareGuidance: pkg.includesHealthcareGuidance,
      workPermitHelp: pkg.includesWorkPermitHelp
    },
    limits: {
      consultationHours: pkg.consultationHours,
      followUpSessions: pkg.followUpSessions,
      documentReviews: pkg.documentReviews
    }
  }));

  const systemPrompt = `You are Clarity, an expert emigration consultant. Your task is to analyze a user's relocation assessment and match them to the most suitable pricing package.

Consider these factors when matching:
1. COMPLEXITY: Match the user's situation complexity to the package complexity level
2. INCOME ALIGNMENT: Consider if their income aligns with the package's target income level
3. FAMILY SITUATION: Match family size and composition needs
4. URGENCY: Consider their timeline and urgency level
5. SERVICE NEEDS: Match their specific needs (visa, housing, tax, education, etc.) to package inclusions
6. VALUE PROPOSITION: Ensure the package provides appropriate value for their situation

Scoring Guidelines:
- 0.9-1.0: Perfect match, all key factors align excellently
- 0.8-0.89: Very good match, most factors align well
- 0.7-0.79: Good match, reasonable alignment with some minor gaps
- 0.6-0.69: Fair match, acceptable but not ideal
- Below 0.6: Poor match, significant misalignment

Return your analysis in JSON format with the exact structure specified.`;

  const userPrompt = `Analyze this user's emigration assessment and recommend the best pricing package:

USER ASSESSMENT:
${JSON.stringify(userContext, null, 2)}

AVAILABLE PACKAGES:
${JSON.stringify(packagesContext, null, 2)}

Provide your recommendation in JSON format:
{
  "recommendedPackageId": "package_id",
  "matchScore": 0.85,
  "reasoning": "Detailed explanation of why this package is the best match, highlighting key alignment factors and addressing any potential concerns",
  "alternativePackages": [
    {
      "packageId": "alternative_id",
      "score": 0.75,
      "reason": "Brief explanation of why this could be an alternative"
    }
  ]
}`;

  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000
    });

    const responseTime = Date.now() - startTime;
    const rawResponse = response.choices[0].message.content!;
    const result = JSON.parse(rawResponse) as PackageMatchResult;

    // Validate that the recommended package exists
    const recommendedPackage = packages.find(pkg => pkg.id === result.recommendedPackageId);
    if (!recommendedPackage) {
      throw new Error(`Recommended package ${result.recommendedPackageId} not found`);
    }

    // Store the package match in the database
    if (assessmentId) {
      const matchData: InsertAssessmentPackageMatch = {
        assessmentId,
        packageId: result.recommendedPackageId,
        matchScore: result.matchScore,
        matchReasoning: result.reasoning
      };

      await storage.createPackageMatch(matchData);
      console.log(`Package match created for assessment ${assessmentId}: ${result.recommendedPackageId} (score: ${result.matchScore})`);
    }

    // Log the LLM interaction if we have logging setup
    // Note: We could extend this to use the same logging system as other LLM operations

    return result;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Package matching error:", error);
    
    // Fallback to a default recommendation based on simple rules
    const fallbackPackage = getFallbackPackageRecommendation(packages, categorizedData);
    
    return {
      recommendedPackageId: fallbackPackage.id,
      matchScore: 0.5,
      reasoning: `System fallback recommendation based on basic rules. ${fallbackPackage.displayName} was selected as a safe default option. For a more personalized recommendation, please try again or contact support.`,
      alternativePackages: []
    };
  }
}

// Simple fallback logic when LLM fails
function getFallbackPackageRecommendation(packages: PricingPackage[], categorizedData: CategorizationResult): PricingPackage {
  // Sort packages by price to get a reasonable middle option
  const sortedPackages = packages.sort((a, b) => a.price - b.price);
  
  // Try to pick middle package, or first if only one
  const middleIndex = Math.floor(sortedPackages.length / 2);
  return sortedPackages[middleIndex] || sortedPackages[0];
}

export async function getPackageMatchForAssessment(assessmentId: string): Promise<{
  match: any;
  package: PricingPackage | null;
} | null> {
  try {
    const match = await storage.getAssessmentPackageMatch(assessmentId);
    if (!match) {
      return null;
    }

    const pkg = await storage.getPricingPackage(match.packageId);
    return {
      match,
      package: pkg || null
    };
  } catch (error) {
    console.error("Error retrieving package match:", error);
    return null;
  }
}