// API routes for event log viewing and management
import { Express } from "express";
import { eventLog } from "./event-log";

export function setupEventRoutes(app: Express) {
  
  // Get all user IDs with events (admin view)
  app.get("/api/events/users", async (req, res) => {
    try {
      const userIds = await eventLog.getAllUserIds();
      res.json({
        success: true,
        userIds
      });
    } catch (error) {
      console.error("Error getting user IDs:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user IDs"
      });
    }
  });
  
  // Get all events for a specific user
  app.get("/api/events/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const events = await eventLog.getUserEvents(userId);
      const summary = await eventLog.getUserSummary(userId);
      const stats = await eventLog.getUserStats(userId);
      
      res.json({
        success: true,
        userId,
        events,
        summary,
        stats
      });
    } catch (error) {
      console.error("Error getting user events:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user events"
      });
    }
  });
  
  // Get latest events for a user
  app.get("/api/events/users/:userId/latest", async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const events = await eventLog.getLatestEvents(userId, limit);
      
      res.json({
        success: true,
        userId,
        events
      });
    } catch (error) {
      console.error("Error getting latest events:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get latest events"
      });
    }
  });
  
  // Get events by type
  app.get("/api/events/users/:userId/type/:eventType", async (req, res) => {
    try {
      const { userId, eventType } = req.params;
      const events = await eventLog.getEventsByType(userId, eventType);
      
      res.json({
        success: true,
        userId,
        eventType,
        events
      });
    } catch (error) {
      console.error("Error getting events by type:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get events by type"
      });
    }
  });
  
  // Get user summary (derived state)
  app.get("/api/events/users/:userId/summary", async (req, res) => {
    try {
      const { userId } = req.params;
      const summary = await eventLog.getUserSummary(userId);
      
      if (!summary) {
        return res.status(404).json({
          success: false,
          message: "User summary not found"
        });
      }
      
      res.json({
        success: true,
        userId,
        summary
      });
    } catch (error) {
      console.error("Error getting user summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user summary"
      });
    }
  });
  
  // Debug endpoint to manually add an event (for testing)
  app.post("/api/events/users/:userId/add", async (req, res) => {
    try {
      const { userId } = req.params;
      const eventData = req.body;
      
      const event = await eventLog.addEvent({
        userId,
        ...eventData
      });
      
      res.json({
        success: true,
        event
      });
    } catch (error) {
      console.error("Error adding event:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add event"
      });
    }
  });
}