import { useState } from 'react';
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
          acc[question.question] = answers[index].trim();
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

  const getPlaceholderForQuestion = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('citizenship') || lowerQuestion.includes('nationality')) {
      return "e.g., Belgian, German, or dual citizenship";
    }
    
    if (lowerQuestion.includes('timeline') || lowerQuestion.includes('when') || lowerQuestion.includes('move')) {
      return "e.g., Within 6 months, or by end of 2025";
    }
    
    if (lowerQuestion.includes('finance') || lowerQuestion.includes('budget') || lowerQuestion.includes('cost')) {
      return "e.g., €50,000 budget, or need financing options";
    }
    
    if (lowerQuestion.includes('work') || lowerQuestion.includes('job') || lowerQuestion.includes('employment')) {
      return "e.g., Remote work, job search, or starting a business";
    }
    
    if (lowerQuestion.includes('visa') || lowerQuestion.includes('permit') || lowerQuestion.includes('legal')) {
      return "e.g., EU passport, work visa needed, or legal requirements unclear";
    }
    
    if (lowerQuestion.includes('housing') || lowerQuestion.includes('rent') || lowerQuestion.includes('property')) {
      return "e.g., Rent 3-bedroom house, or buy property near city center";
    }
    
    if (lowerQuestion.includes('family') || lowerQuestion.includes('spouse') || lowerQuestion.includes('children')) {
      return "e.g., Moving with 2 kids, or spouse will join later";
    }
    
    if (lowerQuestion.includes('school') || lowerQuestion.includes('education') || lowerQuestion.includes('university')) {
      return "e.g., Need English-speaking school, or looking at universities";
    }
    
    if (lowerQuestion.includes('health') || lowerQuestion.includes('medical') || lowerQuestion.includes('insurance')) {
      return "e.g., No ongoing needs, or require diabetes medication";
    }
    
    if (lowerQuestion.includes('language') || lowerQuestion.includes('speak') || lowerQuestion.includes('fluent')) {
      return "e.g., Fluent English, basic Italian, or willing to learn";
    }
    
    if (lowerQuestion.includes('why') || lowerQuestion.includes('goal') || lowerQuestion.includes('reason')) {
      return "e.g., Better opportunities, lifestyle change, or family reasons";
    }
    
    if (lowerQuestion.includes('tax')) {
      return "e.g., No research done yet, or understand basics";
    }
    
    return "Please provide specific details...";
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
                  placeholder={getPlaceholderForQuestion(question.question)}
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