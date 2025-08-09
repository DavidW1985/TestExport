import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, ArrowRight, MessageSquare } from 'lucide-react';
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const queryClient = useQueryClient();

  // Get assessment state from location state or session storage
  const assessmentState: AssessmentState | null = JSON.parse(
    sessionStorage.getItem('assessmentState') || 'null'
  );

  const submitFollowUpMutation = useMutation({
    mutationFn: async (data: { assessmentId: string; answers: Record<string, string> }) => {
      const response = await fetch('/api/assessments/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit follow-up answers');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isComplete) {
        // Assessment is complete, show summary
        sessionStorage.setItem('completedAssessment', JSON.stringify(data));
        setLocation('/summary');
      } else {
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
      }
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

    submitFollowUpMutation.mutate({
      assessmentId: assessmentState.assessmentId,
      answers: formattedAnswers
    });
  };

  const allAnswered = followUpQuestions.every((_, index) => answers[index]?.trim());
  const currentQuestion = followUpQuestions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Follow-Up Questions
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            Help us understand your situation better with a few targeted questions
          </p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <Badge variant="outline" className="bg-white dark:bg-gray-800">
              Round {currentRound} of 3
            </Badge>
            <Badge variant="secondary">
              {Object.keys(answers).length} of {followUpQuestions.length} answered
            </Badge>
          </div>
          <Progress value={progress} className="w-full max-w-md mx-auto" />
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader className="border-b bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">
                    Question {currentQuestionIndex + 1} of {followUpQuestions.length}
                  </CardTitle>
                </div>
                <CardDescription>
                  <Badge variant="outline" className="mr-2">
                    {currentQuestion.category}
                  </Badge>
                  {currentQuestion.reason}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Label htmlFor="answer" className="text-base font-medium">
                    {currentQuestion.question}
                  </Label>
                  <Textarea
                    id="answer"
                    placeholder="Please provide as much detail as possible..."
                    value={answers[currentQuestionIndex] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                    rows={6}
                    className="resize-none"
                    data-testid={`textarea-answer-${currentQuestionIndex}`}
                  />
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    data-testid="button-previous"
                  >
                    Previous
                  </Button>
                  
                  <div className="flex gap-2">
                    {currentQuestionIndex < followUpQuestions.length - 1 ? (
                      <Button
                        onClick={handleNext}
                        disabled={!answers[currentQuestionIndex]?.trim()}
                        data-testid="button-next"
                      >
                        Next <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        disabled={!allAnswered || submitFollowUpMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid="button-submit-followup"
                      >
                        {submitFollowUpMutation.isPending ? 'Processing...' : 'Complete Assessment'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Sidebar */}
          <div className="space-y-4">
            <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-lg">Question Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {followUpQuestions.map((question, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                      index === currentQuestionIndex
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : answers[index]
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                    onClick={() => setCurrentQuestionIndex(index)}
                    data-testid={`question-progress-${index}`}
                  >
                    {answers[index] ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-xs mb-1">
                        {question.category}
                      </Badge>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {question.question}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* AI Insight */}
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                These questions were generated based on your initial responses to gather the most critical information for your emigration planning.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}