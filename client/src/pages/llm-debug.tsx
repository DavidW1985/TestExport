import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LlmInteraction {
  id: string;
  operation: string;
  round: number;
  timestamp: string;
  promptTemplate: string;
  systemPrompt: string;
  userPrompt: string;
  inputData: any;
  rawLlmResponse: string;
  parsedResult: any;
  model: string;
  temperature: number;
  tokensUsed: number | null;
  responseTimeMs: number;
  success: string;
}

interface DebugInfo {
  assessment: {
    id: string;
    created: string;
    currentRound: string;
    isComplete: boolean;
    originalInputs: any;
    categorizedData: any;
  };
  llmInteractions: LlmInteraction[];
  availablePrompts: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export default function LlmDebugPage() {
  const [assessmentId, setAssessmentId] = useState("");
  const [searchId, setSearchId] = useState("");
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/debug/llm", searchId],
    enabled: !!searchId,
    retry: false
  });

  const handleSearch = () => {
    if (!assessmentId.trim()) {
      toast({
        title: "Assessment ID Required",
        description: "Please enter an assessment ID to debug",
        variant: "destructive",
      });
      return;
    }
    setSearchId(assessmentId.trim());
  };

  const debugInfo = (data as any)?.data as DebugInfo | undefined;

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">LLM Processing Debugger</h1>
        <p className="text-muted-foreground">
          Deep dive into LLM interactions, prompts, and processing steps for any assessment
        </p>
      </div>

      {/* Search Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Assessment Lookup
          </CardTitle>
          <CardDescription>
            Enter an assessment ID to see detailed LLM processing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter assessment ID (e.g., 306ed943-45ce-435e-bead-3cc031d3aabb)"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              data-testid="input-assessment-id"
            />
            <Button onClick={handleSearch} disabled={isLoading} data-testid="button-search">
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="mb-8 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading debug info: {error.message || "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {debugInfo && (
        <div className="space-y-6">
          {/* Assessment Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Overview</CardTitle>
              <CardDescription>ID: {debugInfo.assessment.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Round</p>
                  <Badge variant="outline">{debugInfo.assessment.currentRound}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={debugInfo.assessment.isComplete ? "default" : "secondary"}>
                    {debugInfo.assessment.isComplete ? "Complete" : "In Progress"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(debugInfo.assessment.created).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">LLM Calls</p>
                  <p className="text-sm font-medium">{debugInfo.llmInteractions.length}</p>
                </div>
              </div>

              <Tabs defaultValue="inputs" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="inputs">Original Inputs</TabsTrigger>
                  <TabsTrigger value="categorized">Categorized Data</TabsTrigger>
                </TabsList>
                <TabsContent value="inputs" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(debugInfo.assessment.originalInputs).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-sm font-medium capitalize">{key}</p>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="categorized" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(debugInfo.assessment.categorizedData).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-sm font-medium capitalize">{key}</p>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                          {String(value) || "(empty)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* LLM Interactions Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>LLM Processing Timeline</CardTitle>
              <CardDescription>
                Detailed view of each LLM interaction showing inputs, prompts, and outputs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {debugInfo.llmInteractions.map((interaction, index) => (
                  <Collapsible key={interaction.id}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between h-auto p-4"
                        data-testid={`button-interaction-${index}`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <ChevronRight className="w-4 h-4" />
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">#{index + 1}</Badge>
                              <Badge variant={interaction.success === "true" ? "default" : "destructive"}>
                                {interaction.operation}
                              </Badge>
                              <Badge variant="secondary">Round {interaction.round}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {new Date(interaction.timestamp).toLocaleString()} • 
                              {interaction.responseTimeMs}ms • 
                              {interaction.tokensUsed || 0} tokens
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{interaction.model}</p>
                          <p className="text-xs text-muted-foreground">temp: {interaction.temperature}</p>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <Tabs defaultValue="prompt" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="prompt">Prompts</TabsTrigger>
                          <TabsTrigger value="input">Input Data</TabsTrigger>
                          <TabsTrigger value="response">LLM Response</TabsTrigger>
                          <TabsTrigger value="parsed">Parsed Result</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="prompt" className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">System Prompt</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                              {interaction.systemPrompt}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">User Prompt (Template: {interaction.promptTemplate})</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                              {interaction.userPrompt}
                            </pre>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="input" className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Input Data Structure</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                              {JSON.stringify(interaction.inputData, null, 2)}
                            </pre>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="response" className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Raw LLM Response</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                              {interaction.rawLlmResponse || "(empty response)"}
                            </pre>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="parsed" className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Parsed & Structured Result</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                              {interaction.parsedResult ? JSON.stringify(interaction.parsedResult, null, 2) : "(no parsed result)"}
                            </pre>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Prompts Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Available Prompts</CardTitle>
              <CardDescription>Reference of all prompts configured in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {debugInfo.availablePrompts.map((prompt) => (
                  <div key={prompt.id} className="space-y-1">
                    <p className="font-medium">{prompt.name}</p>
                    <Badge variant="outline">{prompt.id}</Badge>
                    <p className="text-xs text-muted-foreground">{prompt.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}