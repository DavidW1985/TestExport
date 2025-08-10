// Script to initialize the database with default prompts
import { db } from "./db";
import { prompts } from "@shared/schema";
import { DEFAULT_PROMPTS } from "./prompts";
import { eq } from "drizzle-orm";

async function initializePrompts() {
  console.log("Initializing default prompts in database...");
  
  try {
    for (const [promptId, promptConfig] of Object.entries(DEFAULT_PROMPTS)) {
      console.log(`Checking prompt: ${promptId}`);
      
      // Check if prompt already exists
      const [existing] = await db.select().from(prompts).where(eq(prompts.id, promptId));
      
      if (!existing) {
        console.log(`Creating prompt: ${promptId}`);
        await db.insert(prompts).values({
          id: promptConfig.id,
          name: promptConfig.name,
          description: promptConfig.description,
          systemPrompt: promptConfig.systemPrompt,
          userPrompt: promptConfig.userPrompt,
          temperature: promptConfig.temperature,
          maxTokens: promptConfig.maxTokens
        });
        console.log(`✓ Created prompt: ${promptConfig.name}`);
      } else {
        console.log(`✓ Prompt already exists: ${promptConfig.name}`);
      }
    }
    
    console.log("Prompt initialization completed successfully!");
  } catch (error) {
    console.error("Error initializing prompts:", error);
    process.exit(1);
  }
}

// Run initialization
initializePrompts().then(() => {
  console.log("Initialization completed!");
  process.exit(0);
}).catch((error) => {
  console.error("Initialization failed:", error);
  process.exit(1);
});

export { initializePrompts };