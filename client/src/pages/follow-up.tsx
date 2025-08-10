import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, ArrowRight, MessageSquare, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FollowUpQuestion {
  question: string;
  category: string;
  reason: string;
}

interface AssessmentState {
  assessmentId: string;
  categorizedData: any;
  followUpQuestions: FollowUpQuestion[];
  isComplete: boolean;
  reasoning: string;
  currentRound: number;
}

export default function FollowUpPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showError, setShowError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // Get assessment state from location state or session storage
  const assessmentState: AssessmentState | null = JSON.parse(
    sessionStorage.getItem('assessmentState') || 'null'
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const submitFollowUpMutation = useMutation({
    mutationFn: async (data: { assessmentId: string; answers: Record<string, string> }) => {
      try {
        console.log('Making fetch request to /api/assessments/follow-up with data:', data);
        
        // Use XMLHttpRequest instead of fetch to avoid browser timeout issues
        const response = await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 60000; // 60 second timeout
          
          xhr.open('POST', '/api/assessments/follow-up');
          xhr.setRequestHeader('Content-Type', 'application/json');
          
          xhr.onload = () => {
            const response = new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers(
                xhr.getAllResponseHeaders()
                  .split('\r\n')
                  .filter(Boolean)
                  .map(header => {
                    const [key, ...values] = header.split(':');
                    return [key.trim(), values.join(':').trim()];
                  })
              )
            });
            resolve(response);
          };
          
          xhr.onerror = () => reject(new Error(`Network error: ${xhr.status} ${xhr.statusText}`));
          xhr.ontimeout = () => reject(new Error('Request timeout after 60 seconds'));
          
          xhr.send(JSON.stringify(data));
        });
        
        console.log('Response received. Status:', response.status, 'OK:', response.ok);
        
        // Log response headers for debugging
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Server error response:', errorData);
          throw new Error(`Server error: ${response.status} ${errorData}`);
        }
        
        // Try to read the response as text first to see what we're getting
        const responseText = await response.text();
        console.log('Raw response text:', responseText.substring(0, 200) + '...');
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Full response text:', responseText);
          throw new Error('Invalid JSON response from server');
        }
        
        console.log('Response JSON parsed successfully:', responseData);
        return responseData;
        
      } catch (error) {
        console.error('Fetch error caught:', error);
        console.error('Error type:', typeof error);
        console.error('Error name:', error?.constructor?.name);
        console.error('Error message:', (error as any)?.message);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Follow-up submission successful:', data);
      if (data.isComplete) {
        console.log('Assessment marked as complete, going to summary');
        // Assessment is complete, show summary
        sessionStorage.setItem('completedAssessment', JSON.stringify(data));
        setLocation('/summary');
        setTimeout(() => window.scrollTo(0, 0), 100);
      } else {
        console.log(`Moving to next round: ${data.currentRound}, questions:`, data.followUpQuestions?.length);
        // More rounds needed, update state and continue
        const newState = {
          ...assessmentState!,
          followUpQuestions: data.followUpQuestions,
          currentRound: data.currentRound,
          categorizedData: data.categorizedData
        };
        sessionStorage.setItem('assessmentState', JSON.stringify(newState));
        setAnswers({});
        setCurrentQuestionIndex(0);
        setTimeout(() => window.scrollTo(0, 0), 100);
      }
    },
    onError: (error) => {
      console.error('Follow-up submission error:', error);
      
      // Capture comprehensive error details
      const errorInfo = {
        type: (error as any)?.constructor?.name || 'Unknown',
        message: (error as any)?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        assessmentId: assessmentState?.assessmentId,
        currentRound: assessmentState?.currentRound,
        requestData: {
          assessmentId: assessmentState?.assessmentId,
          answers: Object.keys(answers).reduce((acc, key) => {
            const questionIndex = parseInt(key);
            if (!isNaN(questionIndex) && assessmentState?.followUpQuestions[questionIndex]) {
              acc[assessmentState.followUpQuestions[questionIndex].question] = answers[key];
            }
            return acc;
          }, {} as Record<string, string>)
        },
        stack: (error as any)?.stack || 'No stack trace',
      };
      
      // Show error details directly on this page
      setErrorDetails(errorInfo);
      setShowError(true);
    },
  });

  if (!assessmentState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No assessment found. Please start over.</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              Start New Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { followUpQuestions, currentRound, isComplete } = assessmentState;
  const progress = ((currentQuestionIndex + Object.keys(answers).length) / followUpQuestions.length) * 100;

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < followUpQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    const formattedAnswers: Record<string, string> = {};
    followUpQuestions.forEach((question, index) => {
      if (answers[index]) {
        formattedAnswers[question.question] = answers[index];
      }
    });

    console.log('Submitting follow-up:', {
      assessmentId: assessmentState.assessmentId,
      currentRound: currentRound,
      answersCount: Object.keys(formattedAnswers).length,
      answers: formattedAnswers
    });

    submitFollowUpMutation.mutate({
      assessmentId: assessmentState.assessmentId,
      answers: formattedAnswers
    });
  };

  const getPlaceholderForQuestion = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    // Timeline/Timing questions (must be first to catch "when do you plan to move")
    if (lowerQuestion.includes('when') || lowerQuestion.includes('timeline') || lowerQuestion.includes('deadline') || lowerQuestion.includes('plan to move') || lowerQuestion.includes('timeframe')) {
      return "e.g., Within 6 months, by next summer, or flexible timing depending on visa approval";
    }
    
    // Financial questions
    if (lowerQuestion.includes('income') || lowerQuestion.includes('salary') || lowerQuestion.includes('earn') || lowerQuestion.includes('money')) {
      return "e.g., $75,000 USD annually from software development, or €45,000 from consulting work";
    }
    if (lowerQuestion.includes('saving') || lowerQuestion.includes('budget') || lowerQuestion.includes('cost') || lowerQuestion.includes('afford')) {
      return "e.g., $50,000 saved for the move, or planning to budget $3,000 monthly";
    }
    
    // Visa/immigration questions
    if (lowerQuestion.includes('visa') || lowerQuestion.includes('permit') || lowerQuestion.includes('citizenship') || lowerQuestion.includes('status')) {
      return "e.g., I'm a US citizen looking for work visa, or I have EU citizenship through my parents";
    }
    
    // Work questions
    if (lowerQuestion.includes('job') || lowerQuestion.includes('work') || lowerQuestion.includes('employer') || lowerQuestion.includes('career')) {
      return "e.g., Remote software engineer, or looking for marketing roles in tech companies";
    }
    
    // Family questions
    if (lowerQuestion.includes('family') || lowerQuestion.includes('spouse') || lowerQuestion.includes('children') || lowerQuestion.includes('depend')) {
      return "e.g., Married with 2 children ages 8 and 12, or single with elderly parents to consider";
    }
    
    // Housing questions
    if (lowerQuestion.includes('housing') || lowerQuestion.includes('rent') || lowerQuestion.includes('buy') || lowerQuestion.includes('live') || lowerQuestion.includes('apartment')) {
      return "e.g., Plan to rent 3-bedroom apartment near city center, or buy house in suburbs";
    }
    
    // Education questions
    if (lowerQuestion.includes('school') || lowerQuestion.includes('education') || lowerQuestion.includes('university') || lowerQuestion.includes('degree')) {
      return "e.g., Need English-speaking international school, or looking at local universities";
    }
    
    // Healthcare questions
    if (lowerQuestion.includes('health') || lowerQuestion.includes('medical') || lowerQuestion.includes('insurance')) {
      return "e.g., No ongoing medical needs, or require diabetes medication and regular checkups";
    }
    
    // Language questions
    if (lowerQuestion.includes('language') || lowerQuestion.includes('speak') || lowerQuestion.includes('fluent')) {
      return "e.g., Fluent in English, basic Italian, or willing to learn the local language";
    }
    
    // Goals/motivation questions
    if (lowerQuestion.includes('why') || lowerQuestion.includes('goal') || lowerQuestion.includes('reason') || lowerQuestion.includes('motivat')) {
      return "e.g., Better work opportunities, lifestyle change, or family reasons";
    }
    
    // Legal/document questions
    if (lowerQuestion.includes('legal') || lowerQuestion.includes('document') || lowerQuestion.includes('requirement') || lowerQuestion.includes('process')) {
      return "e.g., Need help understanding requirements, or have all documents ready";
    }
    
    // Default placeholder
    return "Please provide specific details about your situation...";
  };

  // Show error details if there's an error
  if (showError && errorDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-red-700 dark:text-red-400">
                🐛 Bug Details - Load Failed Error
              </CardTitle>
              <CardDescription className="text-lg">
                Here's what went wrong with the follow-up submission
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <strong>Error Type:</strong> {errorDetails.type}
              </div>
              <div>
                <strong>Message:</strong> {errorDetails.message}
              </div>
              <div>
                <strong>Assessment ID:</strong> {errorDetails.assessmentId}
              </div>
              <div>
                <strong>Current Round:</strong> {errorDetails.currentRound}
              </div>
              <div>
                <strong>Request Data:</strong>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-sm mt-2">
                  {JSON.stringify(errorDetails.requestData, null, 2)}
                </pre>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  <strong>Note:</strong> This error page will stay visible so you can read all the details. 
                  The error occurs because the LLM processing takes 18+ seconds but the browser times out earlier.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => setShowError(false)} variant="outline">
                  Go Back to Form
                </Button>
                <Button onClick={() => setLocation('/')}>
                  Start Over
                </Button>
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
                    alert('Error details copied to clipboard!');
                  }}
                  variant="outline"
                >
                  Copy Error Details
                </Button>
                <Button 
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(errorDetails, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `error-details-${new Date().toISOString()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  variant="outline"
                >
                  Download Error Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const allAnswered = followUpQuestions.every((_, index) => answers[index]?.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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
            {followUpQuestions.map((question, index) => (
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

            {/* Submit Button */}
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