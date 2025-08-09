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
                  placeholder="Please provide details..."
                  value={answers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  rows={4}
                  className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100 resize-none"
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
                    Complete Assessment
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