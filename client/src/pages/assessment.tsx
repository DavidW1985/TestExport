import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { insertAssessmentSchema, type InsertAssessment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Clock, 
  Award,
  Globe,
  Users,
  Briefcase,
  Home,
  Calendar,
  Star,
  Mail,
  ArrowRight,
  Loader2,
  Lock,
  GraduationCap,
  Gauge,
  TrendingUp
} from "lucide-react";

export default function Assessment() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formProgress, setFormProgress] = useState(33);
  
  const form = useForm<InsertAssessment>({
    resolver: zodResolver(insertAssessmentSchema),
    defaultValues: {
      destination: "",
      companions: "",
      income: "",
      housing: "",
      timing: "",
      priority: "",
    },
  });

  const submitAssessment = useMutation({
    mutationFn: async (data: InsertAssessment) => {
      const response = await apiRequest("POST", "/api/assessments", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isComplete) {
        // Assessment is complete without follow-up questions
        sessionStorage.setItem('completedAssessment', JSON.stringify(data));
        setLocation('/summary');
        toast({
          title: "Assessment Complete!",
          description: "Your emigration assessment has been processed successfully.",
        });
      } else {
        // Store assessment state and redirect to follow-up questions
        const assessmentState = {
          assessmentId: data.assessmentId,
          categorizedData: data.categorizedData,
          followUpQuestions: data.followUpQuestions,
          isComplete: data.isComplete,
          reasoning: data.reasoning,
          currentRound: 1
        };
        sessionStorage.setItem('assessmentState', JSON.stringify(assessmentState));
        setLocation('/follow-up');
        setTimeout(() => window.scrollTo(0, 0), 100);
        toast({
          title: "Assessment Processed!",
          description: `We have ${data.followUpQuestions.length} follow-up questions to better understand your needs.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertAssessment) => {
    submitAssessment.mutate(data);
  };

  // Update progress as user fills out form
  const watchedFields = form.watch();
  const filledFields = Object.values(watchedFields).filter(value => value?.toString().trim() !== "").length;
  const totalFields = Object.keys(watchedFields).length;
  const currentProgress = Math.max(33, (filledFields / totalFields) * 100);

  if (currentProgress !== formProgress) {
    setFormProgress(currentProgress);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Trust indicators */}
          <div className="flex items-center justify-center space-x-6 text-sm text-neutral mb-6 flex-wrap gap-4">
            <div className="flex items-center">
              <Shield className="h-4 w-4 text-success mr-2" />
              <span>Secure & Confidential</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-success mr-2" />
              <span>60 Second Form</span>
            </div>
            <div className="flex items-center">
              <Award className="h-4 w-4 text-success mr-2" />
              <span>Expert Reviewed</span>
            </div>
          </div>
          
          {/* Main value proposition */}
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-4 leading-tight">
              Your Emigration Plan,<br />
              <span className="text-primary">Expert-Reviewed in Days</span><br />
              <span className="text-neutral text-3xl lg:text-4xl">— Not Months</span>
            </h1>
            <p className="text-xl text-neutral max-w-2xl mx-auto leading-relaxed">
              Get personalized feedback on your emigration strategy from certified immigration experts. 
              Quick assessment, detailed insights, actionable next steps.
            </p>
          </div>
        </div>
      </div>

      {/* Assessment Form */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Form progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-neutral mb-2">
            <span>Step 1: Core Assessment</span>
            <span>Est. 45-60 seconds</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${formProgress}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" data-testid="assessment-form">
          {/* Question 1: Destination */}
          <div className="form-group">
            <Label htmlFor="destination" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Globe className="h-5 w-5 text-primary mr-2" />
              Where are you emigrating to?
            </Label>
            <Input 
              id="destination"
              {...form.register("destination")}
              placeholder="e.g., Toronto, Canada or Barcelona, Spain"
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100"
              data-testid="input-destination"
            />
            {form.formState.errors.destination && (
              <p className="text-error text-sm mt-2" data-testid="error-destination">
                {form.formState.errors.destination.message}
              </p>
            )}
          </div>

          {/* Question 2: Companions */}
          <div className="form-group">
            <Label htmlFor="companions" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Users className="h-5 w-5 text-primary mr-2" />
              Who's moving with you?
            </Label>
            <Input 
              id="companions"
              {...form.register("companions")}
              placeholder="e.g., Spouse and 2 children (ages 8, 12) or Just myself"
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100"
              data-testid="input-companions"
            />
            {form.formState.errors.companions && (
              <p className="text-error text-sm mt-2" data-testid="error-companions">
                {form.formState.errors.companions.message}
              </p>
            )}
          </div>

          {/* Question 3: Income Source */}
          <div className="form-group">
            <Label htmlFor="income" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Briefcase className="h-5 w-5 text-primary mr-2" />
              Main income source in new location?
            </Label>
            <Input 
              id="income"
              {...form.register("income")}
              placeholder="e.g., Remote software engineering job or Local marketing role or Starting a cafe"
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100"
              data-testid="input-income"
            />
            {form.formState.errors.income && (
              <p className="text-error text-sm mt-2" data-testid="error-income">
                {form.formState.errors.income.message}
              </p>
            )}
          </div>

          {/* Question 4: Housing Plan */}
          <div className="form-group">
            <Label htmlFor="housing" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Home className="h-5 w-5 text-primary mr-2" />
              Housing plan?
            </Label>
            <Input 
              id="housing"
              {...form.register("housing")}
              placeholder="e.g., Rent 2BR apartment downtown or Buy house in suburbs or Stay with family initially"
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100"
              data-testid="input-housing"
            />
            {form.formState.errors.housing && (
              <p className="text-error text-sm mt-2" data-testid="error-housing">
                {form.formState.errors.housing.message}
              </p>
            )}
          </div>

          {/* Question 5: Timing */}
          <div className="form-group">
            <Label htmlFor="timing" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Calendar className="h-5 w-5 text-primary mr-2" />
              Move timing & flexibility?
            </Label>
            <Input 
              id="timing"
              {...form.register("timing")}
              placeholder="e.g., Must move by June 2024 for job or Flexible, anytime in next 2 years"
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100"
              data-testid="input-timing"
            />
            {form.formState.errors.timing && (
              <p className="text-error text-sm mt-2" data-testid="error-timing">
                {form.formState.errors.timing.message}
              </p>
            )}
          </div>

          {/* Question 6: Most Important */}
          <div className="form-group">
            <Label htmlFor="priority" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Star className="h-5 w-5 text-primary mr-2" />
              Most important thing for us to know?
            </Label>
            <Textarea 
              id="priority"
              {...form.register("priority")}
              rows={4}
              placeholder="Share your biggest concern, goal, or unique situation..."
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100 resize-none"
              data-testid="textarea-priority"
            />
            <div className="text-sm text-neutral mt-2">
              <p className="mb-1 font-medium">Examples:</p>
              <ul className="text-sm space-y-1">
                <li>• "Worried about healthcare coverage during transition"</li>
                <li>• "Need to maintain US business while living in Portugal"</li>
                <li>• "Children's education and school enrollment timeline"</li>
                <li>• "Pet relocation requirements and costs"</li>
              </ul>
            </div>
            {form.formState.errors.priority && (
              <p className="text-error text-sm mt-2" data-testid="error-priority">
                {form.formState.errors.priority.message}
              </p>
            )}
          </div>



          {/* Submit Button */}
          <div className="pt-6">
            <Button 
              type="submit" 
              disabled={submitAssessment.isPending}
              className="w-full bg-primary hover:bg-primary-dark text-white text-xl font-semibold py-5 px-8 h-auto transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
              data-testid="button-submit"
            >
              {submitAssessment.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Continue to AI Follow-up Questions</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
            
            {/* Privacy Statement */}
            <p className="text-sm text-neutral text-center mt-4 leading-relaxed">
              <Lock className="inline h-4 w-4 text-success mr-1" />
              By submitting, you agree to our privacy policy. We'll never share your information.
              <br />Expert review within 2-3 business days.
            </p>
          </div>
        </form>
      </div>

      {/* Trust Signals */}
      <div className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-3">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-text-primary">Certified Experts</h3>
              <p className="text-neutral text-sm">Immigration lawyers and relocation specialists with 15+ years experience</p>
            </div>
            
            <div className="space-y-3">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <Gauge className="h-8 w-8 text-success" />
              </div>
              <h3 className="font-semibold text-text-primary">Fast Turnaround</h3>
              <p className="text-neutral text-sm">Detailed assessment and recommendations delivered within 2-3 business days</p>
            </div>
            
            <div className="space-y-3">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-text-primary">Actionable Insights</h3>
              <p className="text-neutral text-sm">Specific next steps, timeline recommendations, and potential challenge mitigation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
