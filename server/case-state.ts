/**
 * Emigration Case State Management
 * 
 * A tiny, dependency-free module that maintains emigration case state in one JSON blob:
 * - snapshot: 10 LLM-maintained categories 
 * - qa_log: questions asked/answered (code-owned, never mutated by LLM)
 * - meta: round counters and metadata
 * 
 * Clean state plumbing with deterministic behavior and good logging.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Core data structures
export interface CaseSnapshot {
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

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  round: number;
  timestamp: string;
  reason?: string;
}

export interface CaseMeta {
  assessmentId: string;
  currentRound: number;
  maxRounds: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
  totalQuestions: number;
  totalAnswers: number;
}

export interface CaseState {
  snapshot: CaseSnapshot;
  qa_log: QAEntry[];
  meta: CaseMeta;
}

// Storage configuration
const STORAGE_DIR = './data/cases';
const LOG_PREFIX = '[CaseState]';

/**
 * Creates an empty case snapshot with all categories initialized
 */
export function createEmptySnapshot(): CaseSnapshot {
  return {
    goal: "",
    finance: "",
    family: "",
    housing: "",
    work: "",
    immigration: "",
    education: "",
    tax: "",
    healthcare: "",
    other: "",
    outstanding_clarifications: ""
  };
}

/**
 * Creates initial case metadata
 */
export function createInitialMeta(assessmentId: string, maxRounds: number = 3): CaseMeta {
  const now = new Date().toISOString();
  return {
    assessmentId,
    currentRound: 1,
    maxRounds,
    isComplete: false,
    createdAt: now,
    updatedAt: now,
    totalQuestions: 0,
    totalAnswers: 0
  };
}

/**
 * Creates a new case state with empty snapshot and metadata
 */
export function createNewCaseState(assessmentId: string, maxRounds: number = 3): CaseState {
  console.log(`${LOG_PREFIX} Creating new case state for assessment: ${assessmentId}`);
  
  return {
    snapshot: createEmptySnapshot(),
    qa_log: [],
    meta: createInitialMeta(assessmentId, maxRounds)
  };
}

/**
 * Validates that a snapshot contains all required categories
 */
function validateSnapshot(snapshot: any): snapshot is CaseSnapshot {
  const requiredKeys = [
    'goal', 'finance', 'family', 'housing', 'work', 
    'immigration', 'education', 'tax', 'healthcare', 
    'other', 'outstanding_clarifications'
  ];
  
  return requiredKeys.every(key => 
    typeof snapshot === 'object' && 
    snapshot !== null && 
    typeof snapshot[key] === 'string'
  );
}

/**
 * Merges new snapshot data into existing case state
 * Only updates snapshot, never touches qa_log (code-owned)
 */
export function mergeSnapshot(caseState: CaseState, newSnapshot: Partial<CaseSnapshot>): CaseState {
  console.log(`${LOG_PREFIX} Merging snapshot for assessment: ${caseState.meta.assessmentId}`);
  
  const updatedSnapshot = { ...caseState.snapshot };
  
  // Only merge valid string values
  Object.entries(newSnapshot).forEach(([key, value]) => {
    if (key in updatedSnapshot && typeof value === 'string') {
      updatedSnapshot[key as keyof CaseSnapshot] = value;
      console.log(`${LOG_PREFIX} Updated ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    }
  });
  
  return {
    ...caseState,
    snapshot: updatedSnapshot,
    meta: {
      ...caseState.meta,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Appends questions to the Q&A log (code-owned, deterministic)
 */
export function appendQuestions(
  caseState: CaseState, 
  questions: Array<{ question: string; category: string; reason?: string }>
): CaseState {
  console.log(`${LOG_PREFIX} Appending ${questions.length} questions for round ${caseState.meta.currentRound}`);
  
  const newEntries: QAEntry[] = questions.map((q, index) => ({
    id: `${caseState.meta.assessmentId}-r${caseState.meta.currentRound}-q${index + 1}`,
    question: q.question,
    answer: "", // Empty until answered
    category: q.category,
    round: caseState.meta.currentRound,
    timestamp: new Date().toISOString(),
    reason: q.reason
  }));
  
  return {
    ...caseState,
    qa_log: [...caseState.qa_log, ...newEntries],
    meta: {
      ...caseState.meta,
      totalQuestions: caseState.meta.totalQuestions + newEntries.length,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Records answers to existing questions in the Q&A log
 */
export function recordAnswers(
  caseState: CaseState,
  answers: Record<string, string>
): CaseState {
  console.log(`${LOG_PREFIX} Recording ${Object.keys(answers).length} answers`);
  
  const updatedQALog = caseState.qa_log.map(entry => {
    const answer = answers[entry.id];
    if (answer && typeof answer === 'string' && answer.trim()) {
      console.log(`${LOG_PREFIX} Answer recorded for ${entry.id}: ${answer.substring(0, 30)}...`);
      return { ...entry, answer: answer.trim() };
    }
    return entry;
  });
  
  const answeredCount = updatedQALog.filter(entry => entry.answer).length;
  
  return {
    ...caseState,
    qa_log: updatedQALog,
    meta: {
      ...caseState.meta,
      totalAnswers: answeredCount,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Advances to the next round
 */
export function advanceRound(caseState: CaseState): CaseState {
  const nextRound = caseState.meta.currentRound + 1;
  const isComplete = nextRound > caseState.meta.maxRounds;
  
  console.log(`${LOG_PREFIX} Advancing to round ${nextRound}. Complete: ${isComplete}`);
  
  return {
    ...caseState,
    meta: {
      ...caseState.meta,
      currentRound: nextRound,
      isComplete,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Marks case as complete
 */
export function markComplete(caseState: CaseState): CaseState {
  console.log(`${LOG_PREFIX} Marking case complete: ${caseState.meta.assessmentId}`);
  
  return {
    ...caseState,
    meta: {
      ...caseState.meta,
      isComplete: true,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Gets the file path for storing case state
 */
function getCaseFilePath(assessmentId: string): string {
  return join(STORAGE_DIR, `${assessmentId}.json`);
}

/**
 * Ensures storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
    console.log(`${LOG_PREFIX} Created storage directory: ${STORAGE_DIR}`);
  }
}

/**
 * Persists case state to disk
 */
export async function saveCaseState(caseState: CaseState): Promise<void> {
  try {
    await ensureStorageDir();
    const filePath = getCaseFilePath(caseState.meta.assessmentId);
    const jsonData = JSON.stringify(caseState, null, 2);
    
    await writeFile(filePath, jsonData, 'utf8');
    console.log(`${LOG_PREFIX} Saved case state to: ${filePath}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to save case state:`, error);
    throw new Error(`Failed to save case state: ${error.message}`);
  }
}

/**
 * Loads case state from disk
 */
export async function loadCaseState(assessmentId: string): Promise<CaseState | null> {
  try {
    const filePath = getCaseFilePath(assessmentId);
    
    if (!existsSync(filePath)) {
      console.log(`${LOG_PREFIX} No case state file found: ${filePath}`);
      return null;
    }
    
    const jsonData = await readFile(filePath, 'utf8');
    const caseState = JSON.parse(jsonData) as CaseState;
    
    // Validate structure
    if (!validateSnapshot(caseState.snapshot) || !caseState.qa_log || !caseState.meta) {
      throw new Error('Invalid case state structure');
    }
    
    console.log(`${LOG_PREFIX} Loaded case state from: ${filePath}`);
    return caseState;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to load case state:`, error);
    return null;
  }
}

/**
 * Lists all case state files
 */
export async function listCaseStates(): Promise<string[]> {
  try {
    await ensureStorageDir();
    const fs = await import('fs/promises');
    const files = await fs.readdir(STORAGE_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to list case states:`, error);
    return [];
  }
}

/**
 * Helper: Get unanswered questions from current round
 */
export function getUnansweredQuestions(caseState: CaseState): QAEntry[] {
  return caseState.qa_log.filter(entry => 
    entry.round === caseState.meta.currentRound && 
    !entry.answer.trim()
  );
}

/**
 * Helper: Get all answered questions
 */
export function getAnsweredQuestions(caseState: CaseState): QAEntry[] {
  return caseState.qa_log.filter(entry => entry.answer.trim());
}

/**
 * Helper: Get questions by round
 */
export function getQuestionsByRound(caseState: CaseState, round: number): QAEntry[] {
  return caseState.qa_log.filter(entry => entry.round === round);
}

/**
 * Helper: Format case state for LLM input
 */
export function formatForLLM(caseState: CaseState): {
  snapshot: CaseSnapshot;
  previous_qa: Array<{ question: string; answer: string; category: string; round: number }>;
  meta: { current_round: number; is_complete: boolean };
} {
  const answeredQuestions = getAnsweredQuestions(caseState);
  
  return {
    snapshot: caseState.snapshot,
    previous_qa: answeredQuestions.map(qa => ({
      question: qa.question,
      answer: qa.answer,
      category: qa.category,
      round: qa.round
    })),
    meta: {
      current_round: caseState.meta.currentRound,
      is_complete: caseState.meta.isComplete
    }
  };
}