import { storage } from "./storage";

// Create 3 well-designed pricing packages with good naming conventions
export async function seedPricingPackages() {
  const packages = [
    {
      id: "essentials",
      name: "Essentials",
      displayName: "Migration Essentials",
      description: "Perfect for straightforward relocations with basic guidance needs. Ideal for individuals or couples with clear destination plans and standard requirements.",
      price: 299,
      currency: "USD",
      
      // Package characteristics for matching
      targetIncomeLevel: "low",
      complexityLevel: "simple",
      familySize: "individual",
      urgencyLevel: "low",
      destinationTypes: JSON.stringify(["eu", "us"]),
      
      // Service inclusions
      includesVisaSupport: true,
      includesHousingSearch: false,
      includesTaxAdvice: false,
      includesEducationPlanning: false,
      includesHealthcareGuidance: true,
      includesWorkPermitHelp: true,
      
      // Package limits
      consultationHours: 2,
      followUpSessions: 1,
      documentReviews: 2,
      
      // Metadata
      isActive: true,
      sortOrder: 1
    },
    {
      id: "professional",
      name: "Professional",
      displayName: "Professional Relocation",
      description: "Comprehensive support for career-focused moves. Includes work authorization, housing assistance, and tax planning for working professionals and families.",
      price: 699,
      currency: "USD",
      
      // Package characteristics for matching
      targetIncomeLevel: "medium",
      complexityLevel: "moderate",
      familySize: "couple",
      urgencyLevel: "medium",
      destinationTypes: JSON.stringify(["eu", "us", "asia"]),
      
      // Service inclusions
      includesVisaSupport: true,
      includesHousingSearch: true,
      includesTaxAdvice: true,
      includesEducationPlanning: false,
      includesHealthcareGuidance: true,
      includesWorkPermitHelp: true,
      
      // Package limits
      consultationHours: 5,
      followUpSessions: 3,
      documentReviews: 5,
      
      // Metadata
      isActive: true,
      sortOrder: 2
    },
    {
      id: "premium",
      name: "Premium",
      displayName: "Premium Family Concierge",
      description: "White-glove service for complex international moves. Comprehensive support covering all aspects of family relocation including children's education and specialized requirements.",
      price: 1299,
      currency: "USD",
      
      // Package characteristics for matching
      targetIncomeLevel: "high",
      complexityLevel: "complex",
      familySize: "family",
      urgencyLevel: "high",
      destinationTypes: JSON.stringify(["eu", "us", "asia", "other"]),
      
      // Service inclusions
      includesVisaSupport: true,
      includesHousingSearch: true,
      includesTaxAdvice: true,
      includesEducationPlanning: true,
      includesHealthcareGuidance: true,
      includesWorkPermitHelp: true,
      
      // Package limits
      consultationHours: 10,
      followUpSessions: 6,
      documentReviews: 10,
      
      // Metadata
      isActive: true,
      sortOrder: 3
    }
  ];

  for (const pkg of packages) {
    try {
      const existing = await storage.getPricingPackage(pkg.id);
      if (!existing) {
        await storage.createPricingPackage(pkg);
        console.log(`Created pricing package: ${pkg.name}`);
      } else {
        console.log(`Pricing package already exists: ${pkg.name}`);
      }
    } catch (error) {
      console.error(`Error creating pricing package ${pkg.name}:`, error);
    }
  }
}