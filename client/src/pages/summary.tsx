import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Globe, 
  Users, 
  Briefcase, 
  Home, 
  Calendar, 
  Star,
  Target,
  DollarSign,
  FileText,
  Building,
  Scale,
  GraduationCap,
  HeartHandshake,
  Shield,
  Phone,
  Mail,
  ArrowRight,
  Package
} from 'lucide-react';

interface CompletedAssessment {
  assessmentId: string;
  categorizedData: {
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
  };
  isComplete: boolean;
  reasoning: string;
}

export default function SummaryPage() {
  const [, setLocation] = useLocation();
  const [completedAssessment, setCompletedAssessment] = useState<CompletedAssessment | null>(null);

  useEffect(() => {
    const assessmentData = sessionStorage.getItem('completedAssessment');
    if (assessmentData) {
      setCompletedAssessment(JSON.parse(assessmentData));
    }
  }, []);

  // Fetch package match for the completed assessment
  const { data: packageMatch } = useQuery({
    queryKey: ['/api/assessments', completedAssessment?.assessmentId, 'package-match'],
    enabled: !!completedAssessment?.assessmentId,
  });

  if (!completedAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No completed assessment found. Please start over.</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              Start New Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { categorizedData, reasoning } = completedAssessment;

  const categories = [
    { key: 'goal', label: 'Main Goal', icon: Target, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'finance', label: 'Financial Situation', icon: DollarSign, color: 'bg-green-50 text-green-700 border-green-200' },
    { key: 'family', label: 'Family Details', icon: Users, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: 'housing', label: 'Housing Plan', icon: Home, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { key: 'work', label: 'Work Situation', icon: Briefcase, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { key: 'immigration', label: 'Immigration Status', icon: FileText, color: 'bg-red-50 text-red-700 border-red-200' },
    { key: 'education', label: 'Education Needs', icon: GraduationCap, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { key: 'tax', label: 'Tax Considerations', icon: Scale, color: 'bg-gray-50 text-gray-700 border-gray-200' },
    { key: 'healthcare', label: 'Healthcare Requirements', icon: HeartHandshake, color: 'bg-pink-50 text-pink-700 border-pink-200' },
  ];

  const handleStartOver = () => {
    sessionStorage.clear();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Assessment Complete!
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Your emigration assessment has been processed and categorized by our AI system
          </p>
          <Badge variant="secondary" className="text-sm">
            Assessment ID: {completedAssessment.assessmentId}
          </Badge>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* AI Analysis Summary */}
          <Card className="mb-8 shadow-lg border-0 bg-white dark:bg-gray-800">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardTitle className="flex items-center text-xl">
                <Shield className="h-6 w-6 text-blue-600 mr-2" />
                AI Analysis Summary
              </CardTitle>
              <CardDescription>
                Our AI system has analyzed your responses and categorized your emigration needs
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  {reasoning}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Categorized Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {categories.map((category) => {
              const data = categorizedData[category.key as keyof typeof categorizedData];
              const Icon = category.icon;
              
              if (!data || data.trim() === '') return null;

              return (
                <Card key={category.key} className={`shadow-lg border ${category.color} bg-opacity-50`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-lg">
                      <Icon className="h-5 w-5 mr-2" />
                      {category.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-relaxed">{data}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Outstanding Clarifications */}
          {categorizedData.outstanding_clarifications && (
            <Card className="mb-8 shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader className="border-b bg-yellow-50 dark:bg-yellow-900/20">
                <CardTitle className="flex items-center text-xl text-yellow-800 dark:text-yellow-200">
                  <FileText className="h-6 w-6 mr-2" />
                  Outstanding Questions
                </CardTitle>
                <CardDescription>
                  Areas that may need additional clarification for optimal emigration planning
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {categorizedData.outstanding_clarifications}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Other Information */}
          {categorizedData.other && (
            <Card className="mb-8 shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader className="border-b bg-gray-50 dark:bg-gray-700">
                <CardTitle className="flex items-center text-xl">
                  <FileText className="h-6 w-6 text-gray-600 mr-2" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {categorizedData.other}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Package Recommendation Section */}
          {packageMatch?.success && packageMatch.package && (
            <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Package className="w-6 h-6 text-primary" />
                  <CardTitle>Recommended Emigration Package</CardTitle>
                </div>
                <CardDescription>
                  Based on your assessment, we recommend the following service package
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{packageMatch.package.displayName}</h3>
                      <p className="text-muted-foreground">{packageMatch.package.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">${packageMatch.package.price}</div>
                      <div className="text-sm text-muted-foreground">{packageMatch.package.currency}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">
                      {Math.round(packageMatch.match.matchScore * 100)}% match confidence
                    </span>
                  </div>

                  <div className="border-l-4 border-primary/30 pl-4 py-2 bg-primary/5 rounded-r">
                    <p className="text-sm">{packageMatch.match.matchReasoning}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="font-medium">Package Includes:</div>
                      {packageMatch.package.includesVisaSupport && (
                        <div className="flex items-center space-x-1">
                          <Shield className="w-3 h-3 text-green-600" />
                          <span>Visa Support</span>
                        </div>
                      )}
                      {packageMatch.package.includesHousingSearch && (
                        <div className="flex items-center space-x-1">
                          <Home className="w-3 h-3 text-green-600" />
                          <span>Housing Search</span>
                        </div>
                      )}
                      {packageMatch.package.includesTaxAdvice && (
                        <div className="flex items-center space-x-1">
                          <Scale className="w-3 h-3 text-green-600" />
                          <span>Tax Advice</span>
                        </div>
                      )}
                      {packageMatch.package.includesEducationPlanning && (
                        <div className="flex items-center space-x-1">
                          <GraduationCap className="w-3 h-3 text-green-600" />
                          <span>Education Planning</span>
                        </div>
                      )}
                      {packageMatch.package.includesHealthcareGuidance && (
                        <div className="flex items-center space-x-1">
                          <HeartHandshake className="w-3 h-3 text-green-600" />
                          <span>Healthcare Guidance</span>
                        </div>
                      )}
                      {packageMatch.package.includesWorkPermitHelp && (
                        <div className="flex items-center space-x-1">
                          <Briefcase className="w-3 h-3 text-green-600" />
                          <span>Work Permit Help</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">Service Limits:</div>
                      <div>Consultation: {packageMatch.package.consultationHours} hours</div>
                      <div>Follow-ups: {packageMatch.package.followUpSessions} sessions</div>
                      <div>Reviews: {packageMatch.package.documentReviews} documents</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button size="lg" className="w-full" data-testid="button-select-package">
                      Select This Package <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center text-xl text-green-800 dark:text-green-200">
                <ArrowRight className="h-6 w-6 mr-2" />
                Next Steps
              </CardTitle>
              <CardDescription>
                Your emigration assessment is ready for expert review
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">What happens next?</h4>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                        Your assessment will be reviewed by certified immigration experts
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                        We'll match you with suitable emigration service packages
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                        You'll receive personalized recommendations within 2-3 business days
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Contact Information</h4>
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-blue-600 mr-2" />
                        support@emigrationexperts.com
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-blue-600 mr-2" />
                        +1-800-EMIGRATE
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={handleStartOver}
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-testid="button-start-over"
                  >
                    Start New Assessment
                  </Button>
                  <Button 
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-contact-expert"
                  >
                    Contact Expert Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}