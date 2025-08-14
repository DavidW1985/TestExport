import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Loader2, MessageSquare } from 'lucide-react';

interface FollowUpQuestion {
  question: string;
  category: string;
  reason: string;
}

interface AssessmentState {
  assessmentId: string;
  followUpQuestions: FollowUpQuestion[];
  currentRound: number;
  categorizedData: any;
}

export default function FollowUpPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showError, setShowError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // Get assessment state from session storage
  const assessmentState: AssessmentState | null = JSON.parse(
    sessionStorage.getItem('assessmentState') || 'null'
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [placeholderCache, setPlaceholderCache] = useState<Record<string, string>>({});

  if (!assessmentState) {
    setLocation('/');
    return null;
  }

  // If followUpQuestions is missing, redirect to home page
  if (!assessmentState.followUpQuestions || !Array.isArray(assessmentState.followUpQuestions) || assessmentState.followUpQuestions.length === 0) {
    console.error('Missing followUpQuestions in assessment state:', assessmentState);
    sessionStorage.removeItem('assessmentState'); // Clean up corrupted state
    setLocation('/');
    return null;
  }

  const { followUpQuestions, currentRound } = assessmentState;

  // Simple polling function
  const pollForResult = async (assessmentId: string): Promise<any> => {
    const maxAttempts = 60; // 5 minutes
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`);
      
      const response = await fetch(`/api/assessments/follow-up/${assessmentId}/status`);
      const result = await response.json();
      
      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'error') {
        throw new Error(result.message || 'Processing failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      attempts++;
    }
    
    throw new Error('Processing timeout');
  };

  const submitFollowUpMutation = useMutation({
    mutationFn: async (data: { assessmentId: string; answers: Record<string, string> }) => {
      // Start processing
      const response = await fetch('/api/assessments/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start processing: ${response.status}`);
      }
      
      console.log('Processing started, now polling...');
      return await pollForResult(data.assessmentId);
    },
    onSuccess: (data) => {
      if (data.isComplete) {
        sessionStorage.setItem('completedAssessment', JSON.stringify(data));
        setLocation('/summary');
      } else {
        const newState = {
          ...assessmentState,
          followUpQuestions: data.followUpQuestions,
          currentRound: data.currentRound,
          categorizedData: data.categorizedData
        };
        sessionStorage.setItem('assessmentState', JSON.stringify(newState));
        setAnswers({});
        window.scrollTo(0, 0);
      }
    },
    onError: (error) => {
      const errorInfo = {
        type: (error as any)?.constructor?.name || 'Unknown',
        message: (error as any)?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        assessmentId: assessmentState?.assessmentId,
        currentRound: assessmentState?.currentRound,
        requestData: { assessmentId: assessmentState?.assessmentId, answers }
      };
      
      setErrorDetails(errorInfo);
      setShowError(true);
      sessionStorage.setItem('debugError', JSON.stringify(errorInfo));
    }
  });

  const handleAnswerChange = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submissionData = {
      assessmentId: assessmentState.assessmentId,
      answers: (followUpQuestions || []).reduce((acc, question, index) => {
        if (answers[index]?.trim()) {
          // Use index as key for easier mapping on backend
          acc[index.toString()] = answers[index].trim();
        }
        return acc;
      }, {} as Record<string, string>)
    };

    console.log('Submitting follow-up:', {
      assessmentId: submissionData.assessmentId,
      currentRound,
      answersCount: Object.keys(submissionData.answers).length,
      answers: submissionData.answers
    });

    submitFollowUpMutation.mutate(submissionData);
  };

  // Track which questions are currently being loaded to prevent duplicates
  const [loadingPlaceholders, setLoadingPlaceholders] = useState<Set<string>>(new Set());

  // Generate LLM-powered placeholder text
  const getPlaceholderForQuestion = async (question: string): Promise<string> => {
    // Check cache first
    if (placeholderCache[question]) {
      return placeholderCache[question];
    }

    // Check if already loading to prevent duplicate requests
    if (loadingPlaceholders.has(question)) {
      return "Loading suggestion...";
    }

    try {
      // Mark as loading
      setLoadingPlaceholders(prev => new Set([...prev, question]));

      const response = await fetch('/api/placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error('Failed to generate placeholder');
      }

      const data = await response.json();
      const placeholder = data.placeholder || "Provide specific details about your situation...";
      
      // Cache the result and remove from loading
      setPlaceholderCache(prev => ({
        ...prev,
        [question]: placeholder
      }));

      setLoadingPlaceholders(prev => {
        const newSet = new Set(prev);
        newSet.delete(question);
        return newSet;
      });

      return placeholder;
    } catch (error) {
      console.error('Error generating placeholder:', error);
      
      // Remove from loading on error
      setLoadingPlaceholders(prev => {
        const newSet = new Set(prev);
        newSet.delete(question);
        return newSet;
      });

      return "Provide specific details about your situation...";
    }
  };

  // Load all placeholders at once to prevent re-render issues
  useEffect(() => {
    if (followUpQuestions && followUpQuestions.length > 0) {
      followUpQuestions.forEach((question, index) => {
        const questionText = question.question;
        // Only load if not already cached or loading
        if (!placeholderCache[questionText]) {
          console.log(`Loading placeholder for question ${index}: ${questionText.substring(0, 50)}...`);
          getPlaceholderForQuestion(questionText);
        }
      });
    }
  }, [followUpQuestions]);

  // Get placeholder text synchronously from cache
  const getPlaceholder = (question: string): string => {
    return placeholderCache[question] || "Provide specific details about your situation...";
  };

  // Show error details if there's an error
  if (showError && errorDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-red-700 dark:text-red-400">
                🐛 Processing Error
              </CardTitle>
              <CardDescription className="text-lg">
                Here's what went wrong with the follow-up submission
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><strong>Error:</strong> {errorDetails.message}</div>
              <div><strong>Assessment ID:</strong> {errorDetails.assessmentId}</div>
              <div><strong>Round:</strong> {errorDetails.currentRound}</div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  The issue appears to be with long-running LLM processing. The server may still be working in the background.
                </p>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => setShowError(false)} variant="outline">
                  Go Back
                </Button>
                <Button onClick={() => setLocation('/')}>
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const allAnswered = followUpQuestions && followUpQuestions.length > 0 
    ? followUpQuestions.every((_, index) => answers[index]?.trim())
    : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Follow-Up Questions
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            A few more details to complete your assessment
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form className="space-y-8" data-testid="follow-up-form">
            {followUpQuestions && followUpQuestions.map((question, index) => (
              <div key={index} className="form-group">
                <Label htmlFor={`question-${index}`} className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
                  <MessageSquare className="h-5 w-5 text-primary mr-2" />
                  {question.question}
                </Label>
                <Textarea
                  id={`question-${index}`}
                  placeholder={getPlaceholder(question.question)}
                  value={answers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  rows={4}
                  className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100 resize-none placeholder:italic placeholder:text-muted-foreground/70"
                  data-testid={`textarea-answer-${index}`}
                />
                {!answers[index]?.trim() && (
                  <p className="text-error text-sm mt-2" data-testid={`error-question-${index}`}>
                    Please provide an answer to continue
                  </p>
                )}
              </div>
            ))}

            <div className="pt-6 border-t">
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || submitFollowUpMutation.isPending}
                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 text-white font-semibold"
                data-testid="button-submit-followup"
              >
                {submitFollowUpMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Processing Your Assessment...
                  </>
                ) : (
                  <>
                    {currentRound >= 3 ? 'Complete Assessment' : 'Continue to Next Round'}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}