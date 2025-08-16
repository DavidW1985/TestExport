// Append-only event log system - immutable audit trail for user interactions
import { db } from "./db";
import { userEvents, userSummaries, type InsertUserEvent, type UserEvent } from "@shared/schema";
import { eq, desc, asc, max, and } from "drizzle-orm";

export interface UserEventInput {
  userId: string;
  eventType: 'initial_assessment' | 'follow_up_question' | 'follow_up_answer' | 'categorization' | 'llm_analysis' | 'assessment_completed';
  questionType?: string;
  questionText?: string;
  userAnswer?: string;
  llmCategory?: string;
  llmTreatment?: 'fact' | 'unknown' | 'contradictory' | 'clarification_needed';
  llmConfidence?: number;
  roundNumber?: number;
  metadata?: any;
}

export class EventLogService {
  
  // Add a new event to the append-only log
  async addEvent(event: UserEventInput): Promise<UserEvent> {
    console.log(`[EventLog] Adding event for user ${event.userId}: ${event.eventType}`);
    
    // Get the next event ID for this user
    const eventId = await this.getNextEventId(event.userId);
    
    const eventData: InsertUserEvent = {
      userId: event.userId,
      eventId,
      timestamp: new Date(),
      eventType: event.eventType,
      questionType: event.questionType || null,
      questionText: event.questionText || null,
      userAnswer: event.userAnswer || null,
      llmCategory: event.llmCategory || null,
      llmTreatment: event.llmTreatment || undefined,
      llmConfidence: event.llmConfidence || null,
      roundNumber: event.roundNumber || null,
      metadata: event.metadata || null,
    };
    
    // Insert the event (immutable)
    const [insertedEvent] = await db.insert(userEvents).values(eventData).returning();
    
    // Update the user summary (derived state)
    await this.updateUserSummary(event.userId);
    
    console.log(`[EventLog] Event ${eventId} added for user ${event.userId}`);
    return insertedEvent;
  }
  
  // Get all events for a user (chronological order)
  async getUserEvents(userId: string): Promise<UserEvent[]> {
    return await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, userId))
      .orderBy(asc(userEvents.eventId));
  }
  
  // Get the latest events for a user
  async getLatestEvents(userId: string, limit: number = 10): Promise<UserEvent[]> {
    return await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, userId))
      .orderBy(desc(userEvents.eventId))
      .limit(limit);
  }
  
  // Get events by type
  async getEventsByType(userId: string, eventType: string): Promise<UserEvent[]> {
    return await db
      .select()
      .from(userEvents)
      .where(and(
        eq(userEvents.userId, userId),
        eq(userEvents.eventType, eventType)
      ))
      .orderBy(asc(userEvents.eventId));
  }
  
  // Get the current round number for a user
  async getCurrentRound(userId: string): Promise<number> {
    const events = await db
      .select()
      .from(userEvents)
      .where(and(
        eq(userEvents.userId, userId),
        eq(userEvents.eventType, 'follow_up_answer')
      ))
      .orderBy(desc(userEvents.roundNumber));
    
    return events.length > 0 ? (events[0].roundNumber || 1) : 1;
  }
  
  // Get next sequential event ID for a user
  private async getNextEventId(userId: string): Promise<number> {
    const result = await db
      .select({ maxEventId: max(userEvents.eventId) })
      .from(userEvents)
      .where(eq(userEvents.userId, userId));
    
    const maxEventId = result[0]?.maxEventId || 0;
    return maxEventId + 1;
  }
  
  // Update derived user summary from events
  private async updateUserSummary(userId: string): Promise<void> {
    console.log(`[EventLog] Updating summary for user ${userId}`);
    
    // Get all events for this user
    const events = await this.getUserEvents(userId);
    
    if (events.length === 0) return;
    
    // Derive current state from all events
    const summary = {
      currentGoal: '',
      currentFinance: '',
      currentFamily: '',
      currentHousing: '',
      currentWork: '',
      currentImmigration: '',
      currentEducation: '',
      currentTax: '',
      currentHealthcare: '',
      currentOther: '',
    };
    
    // Process events to build current state
    for (const event of events) {
      if (event.llmCategory && event.userAnswer) {
        // Map LLM categories to summary fields
        switch (event.llmCategory.toLowerCase()) {
          case 'goal':
            summary.currentGoal = this.appendToField(summary.currentGoal, event.userAnswer);
            break;
          case 'finance':
            summary.currentFinance = this.appendToField(summary.currentFinance, event.userAnswer);
            break;
          case 'family':
            summary.currentFamily = this.appendToField(summary.currentFamily, event.userAnswer);
            break;
          case 'housing':
            summary.currentHousing = this.appendToField(summary.currentHousing, event.userAnswer);
            break;
          case 'work':
            summary.currentWork = this.appendToField(summary.currentWork, event.userAnswer);
            break;
          case 'immigration':
            summary.currentImmigration = this.appendToField(summary.currentImmigration, event.userAnswer);
            break;
          case 'education':
            summary.currentEducation = this.appendToField(summary.currentEducation, event.userAnswer);
            break;
          case 'tax':
            summary.currentTax = this.appendToField(summary.currentTax, event.userAnswer);
            break;
          case 'healthcare':
            summary.currentHealthcare = this.appendToField(summary.currentHealthcare, event.userAnswer);
            break;
          case 'other':
            summary.currentOther = this.appendToField(summary.currentOther, event.userAnswer);
            break;
        }
      }
    }
    
    const lastEvent = events[events.length - 1];
    const currentRound = await this.getCurrentRound(userId);
    
    // Upsert user summary
    const summaryData = {
      userId,
      ...summary,
      totalEvents: events.length,
      lastEventId: lastEvent.eventId,
      currentRound,
      isComplete: currentRound >= 3, // Simple completion logic
      firstEventAt: events[0].timestamp,
      lastEventAt: lastEvent.timestamp,
    };
    
    // Check if summary exists
    const [existingSummary] = await db
      .select()
      .from(userSummaries)
      .where(eq(userSummaries.userId, userId));
    
    if (existingSummary) {
      await db
        .update(userSummaries)
        .set({ ...summaryData, updatedAt: new Date() })
        .where(eq(userSummaries.userId, userId));
    } else {
      await db.insert(userSummaries).values(summaryData);
    }
    
    console.log(`[EventLog] Summary updated for user ${userId} - ${events.length} total events`);
  }
  
  // Helper to append information to existing field
  private appendToField(existing: string, newInfo: string): string {
    if (!existing) return newInfo;
    if (existing.includes(newInfo)) return existing; // Avoid duplicates
    return `${existing}; ${newInfo}`;
  }
  
  // Get user summary (derived state)
  async getUserSummary(userId: string) {
    const [summary] = await db
      .select()
      .from(userSummaries)
      .where(eq(userSummaries.userId, userId));
    
    return summary;
  }
  
  // Get all user IDs with events (for admin view)
  async getAllUserIds(): Promise<string[]> {
    try {
      const results = await db
        .select({ userId: userEvents.userId })
        .from(userEvents)
        .groupBy(userEvents.userId);
      
      return results.map(r => r.userId);
    } catch (error) {
      console.error("Error in getAllUserIds:", error);
      // Fallback: return empty array if no events exist yet
      return [];
    }
  }
  
  // Get event statistics for a user
  async getUserStats(userId: string) {
    const events = await this.getUserEvents(userId);
    const summary = await this.getUserSummary(userId);
    
    const stats = {
      totalEvents: events.length,
      eventsByType: {} as Record<string, number>,
      categoriesCovered: new Set<string>(),
      firstEvent: events[0]?.timestamp,
      lastEvent: events[events.length - 1]?.timestamp,
      currentRound: summary?.currentRound || 1,
      isComplete: summary?.isComplete || false,
    };
    
    // Count events by type
    events.forEach(event => {
      stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
      if (event.llmCategory) {
        stats.categoriesCovered.add(event.llmCategory);
      }
    });
    
    return {
      ...stats,
      categoriesCovered: Array.from(stats.categoriesCovered),
    };
  }
}

// Export singleton instance
export const eventLog = new EventLogService();