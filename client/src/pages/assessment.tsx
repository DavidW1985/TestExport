import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  TrendingUp,
  MapPin,
  Plane
} from "lucide-react";

// Popular countries for emigration
const POPULAR_COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "Australia", 
  "Netherlands", "Switzerland", "France", "Italy", "Spain", "Portugal", 
  "Sweden", "Norway", "Denmark", "Austria", "Belgium", "Ireland", 
  "New Zealand", "Japan", "Singapore", "United Arab Emirates", "Other"
];

// Rotating example hints for context field
const CONTEXT_EXAMPLES = [
  "Ex: 'EU citizen, target October, need school options near city center, lease first.'",
  "Ex: 'Software engineer, remote work approved, wife is teacher, need visa guidance.'", 
  "Ex: 'Family of 4, kids ages 8&12, budget €200k house, prefer suburbs.'",
  "Ex: 'Retiring in 2 years, health concerns, warm climate preferred, simple process.'",
  "Ex: 'Startup founder, need business visa, tech hub location, fast timeline.'"
];

export default function Assessment() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formProgress, setFormProgress] = useState(33);
  const [currentExample, setCurrentExample] = useState(0);
  
  const form = useForm<InsertAssessment>({
    resolver: zodResolver(insertAssessmentSchema),
    defaultValues: {
      movingFrom: "",
      movingTo: "",
      context: "",
    },
  });

  // Rotate example hints every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % CONTEXT_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
        console.log("Assessment response received:", {
          hasFollowUpQuestions: !!data.followUpQuestions,
          questionsType: Array.isArray(data.followUpQuestions) ? 'array' : typeof data.followUpQuestions,
          questionsLength: data.followUpQuestions?.length || 0,
          dataKeys: Object.keys(data)
        });
        
        toast({
          title: "Assessment Processed!",
          description: `We have ${data.followUpQuestions?.length || 0} follow-up questions to better understand your needs.`,
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
          {/* Question 1: Where are you moving from? */}
          <div className="form-group">
            <Label htmlFor="movingFrom" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Plane className="h-5 w-5 text-primary mr-2" />
              Where are you moving from?
            </Label>
            <div className="space-y-3">
              <Controller
                name="movingFrom"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={(value) => {
                    if (value === "Other") {
                      field.onChange("");
                    } else {
                      field.onChange(value);
                    }
                  }} value={field.value}>
                    <SelectTrigger className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100">
                      <SelectValue placeholder="Netherlands (Amsterdam)" />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {(form.watch("movingFrom") === "Other" || !POPULAR_COUNTRIES.includes(form.watch("movingFrom"))) && (
                <Input
                  placeholder="Enter your country and optional city"
                  value={form.watch("movingFrom")}
                  onChange={(e) => form.setValue("movingFrom", e.target.value)}
                  className="text-lg py-4 px-4 border-2 focus:border-primary placeholder:italic placeholder:text-muted-foreground/70"
                />
              )}
            </div>
            {form.formState.errors.movingFrom && (
              <p className="text-error text-sm mt-2" data-testid="error-moving-from">
                {form.formState.errors.movingFrom.message}
              </p>
            )}
          </div>

          {/* Question 2: Where are you moving to? */}
          <div className="form-group">
            <Label htmlFor="movingTo" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <MapPin className="h-5 w-5 text-primary mr-2" />
              Where are you moving to?
            </Label>
            <div className="space-y-3">
              <Controller
                name="movingTo"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={(value) => {
                    if (value === "Other") {
                      field.onChange("");
                    } else {
                      field.onChange(value);
                    }
                  }} value={field.value}>
                    <SelectTrigger className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100">
                      <SelectValue placeholder="Italy (Rome)" />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {(form.watch("movingTo") === "Other" || !POPULAR_COUNTRIES.includes(form.watch("movingTo"))) && (
                <Input
                  placeholder="Enter your destination country and optional city/region"
                  value={form.watch("movingTo")}
                  onChange={(e) => form.setValue("movingTo", e.target.value)}
                  className="text-lg py-4 px-4 border-2 focus:border-primary placeholder:italic placeholder:text-muted-foreground/70"
                />
              )}
            </div>
            {form.formState.errors.movingTo && (
              <p className="text-error text-sm mt-2" data-testid="error-moving-to">
                {form.formState.errors.movingTo.message}
              </p>
            )}
          </div>

          {/* Question 3: Context */}
          <div className="form-group">
            <Label htmlFor="context" className="block text-lg font-semibold text-text-primary mb-3 flex items-center">
              <Star className="h-5 w-5 text-primary mr-2" />
              Context (anything that helps us help you fast)
            </Label>
            <Textarea 
              id="context"
              {...form.register("context")}
              rows={4}
              placeholder="Mention timing, who's moving, work setup, visas, constraints..."
              className="text-lg py-4 px-4 border-2 focus:border-primary focus:ring-4 focus:ring-blue-100 resize-none placeholder:italic placeholder:text-muted-foreground/70"
              data-testid="textarea-context"
            />
            <div className="text-sm text-neutral mt-2">
              <p className="font-medium mb-1">Mention timing, who's moving, work setup, visas, constraints.</p>
              <div className="flex items-center gap-2 transition-all duration-500">
                <span className="opacity-70">{CONTEXT_EXAMPLES[currentExample]}</span>
              </div>
            </div>
            {form.formState.errors.context && (
              <p className="text-error text-sm mt-2" data-testid="error-context">
                {form.formState.errors.context.message}
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
