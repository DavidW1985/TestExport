import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Clock, Zap, AlertCircle, CheckCircle, Search } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LlmLog } from "@shared/schema";

interface LlmLogWithParsed extends Omit<LlmLog, 'inputData' | 'parsedResult'> {
  inputData: Record<string, any>;
  parsedResult: Record<string, any> | null;
}

interface LogsResponse {
  success: boolean;
  logs: LlmLogWithParsed[];
}

export default function LlmLogsPage() {
  const [selectedAssessment, setSelectedAssessment] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all LLM logs
  const { data: allLogs, isLoading: isLoadingAll, refetch: refetchAll } = useQuery<LogsResponse>({
    queryKey: ['/api/llm-logs'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch assessment-specific logs when an assessment is selected
  const { data: assessmentLogs, isLoading: isLoadingAssessment } = useQuery<LogsResponse>({
    queryKey: ['/api/assessments', selectedAssessment, 'llm-logs'],
    enabled: selectedAssessment !== "all",
  });

  const logs = selectedAssessment === "all" ? allLogs?.logs || [] : assessmentLogs?.logs || [];
  const isLoading = selectedAssessment === "all" ? isLoadingAll : isLoadingAssessment;

  // Filter logs based on search term
  const filteredLogs = logs.filter(log => 
    log.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.assessmentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.success !== "true" && searchTerm.toLowerCase().includes("error"))
  );

  // Get unique assessment IDs for filter dropdown
  const assessmentIds = Array.from(new Set(allLogs?.logs.map(log => log.assessmentId).filter(Boolean) || [])) as string[];

  const formatResponseTime = (ms: number | null) => {
    if (!ms) return "N/A";
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "categorize": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "followup": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "update": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getStatusColor = (success: string) => {
    return success === "true" 
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LLM Interaction Logs</h1>
          <p className="text-muted-foreground mt-1">
            Complete visibility into AI decision-making and responses
          </p>
        </div>
        <Button onClick={() => refetchAll()} data-testid="button-refresh">
          <Zap className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Assessment ID</label>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                <SelectTrigger data-testid="select-assessment">
                  <SelectValue placeholder="All Assessments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assessments</SelectItem>
                  {assessmentIds.map(id => (
                    <SelectItem key={id} value={id}>{id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search operations, IDs, errors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} logs
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {allLogs && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Successful Calls</p>
                  <p className="text-2xl font-bold" data-testid="stat-success">
                    {allLogs.logs.filter(log => log.success === "true").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Failed Calls</p>
                  <p className="text-2xl font-bold" data-testid="stat-errors">
                    {allLogs.logs.filter(log => log.success !== "true").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold" data-testid="stat-avg-time">
                    {formatResponseTime(
                      allLogs.logs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) / allLogs.logs.length
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold" data-testid="stat-tokens">
                    {allLogs.logs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Interaction History</CardTitle>
          <CardDescription>
            Detailed log of all LLM interactions with full request and response data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <Collapsible 
                  key={log.id} 
                  open={expandedLog === log.id} 
                  onOpenChange={(open) => setExpandedLog(open ? log.id : null)}
                >
                  <Card className="border-l-4 border-l-blue-500">
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {expandedLog === log.id ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                            <div className="text-left">
                              <div className="flex items-center space-x-2">
                                <Badge className={getOperationColor(log.operation)}>
                                  {log.operation}
                                </Badge>
                                {log.promptTemplate && (
                                  <Badge variant="outline" data-testid={`badge-prompt-${log.id}`}>
                                    {log.promptTemplate}
                                  </Badge>
                                )}
                                <Badge className={getStatusColor(log.success)}>
                                  {log.success === "true" ? "Success" : "Error"}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Round {log.round}
                                </span>
                              </div>
                              <p className="text-sm font-medium mt-1" data-testid={`log-assessment-${log.assessmentId}`}>
                                Assessment: {log.assessmentId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.createdAt).toLocaleString()} • {formatResponseTime(log.responseTimeMs)} • {log.tokensUsed || 0} tokens
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{log.model}</p>
                            <p className="text-xs text-muted-foreground">
                              Temp: {log.temperature}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-4 pb-4">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                            <TabsTrigger value="system">System</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Input Variables</h4>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm">
                                  {Object.entries(log.inputData).map(([key, value]) => (
                                    <div key={key} className="mb-1">
                                      <span className="font-medium">{key}:</span>{" "}
                                      <span className="text-muted-foreground">
                                        {typeof value === 'string' && value.length > 100 
                                          ? `${value.substring(0, 100)}...` 
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Result Summary</h4>
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm">
                                  {log.success === "true" ? (
                                    log.parsedResult ? (
                                      <div>
                                        {Object.entries(log.parsedResult).slice(0, 5).map(([key, value]) => (
                                          <div key={key} className="mb-1">
                                            <span className="font-medium">{key}:</span>{" "}
                                            <span className="text-muted-foreground">
                                              {typeof value === 'string' && value.length > 50 
                                                ? `${value.substring(0, 50)}...` 
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      "No parsed result available"
                                    )
                                  ) : (
                                    <div className="text-red-600 font-medium">
                                      Error: {log.success}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="request" className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Full Prompt Used</h4>
                              <Textarea 
                                value={log.promptUsed} 
                                readOnly 
                                className="min-h-[200px] font-mono text-sm"
                                data-testid={`prompt-${log.id}`}
                              />
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="response" className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Raw LLM Response</h4>
                              <Textarea 
                                value={log.llmResponse || "No response (error occurred)"} 
                                readOnly 
                                className="min-h-[200px] font-mono text-sm"
                                data-testid={`response-${log.id}`}
                              />
                            </div>
                            {log.parsedResult && (
                              <div>
                                <h4 className="font-medium mb-2">Parsed Result</h4>
                                <Textarea 
                                  value={JSON.stringify(log.parsedResult, null, 2)} 
                                  readOnly 
                                  className="min-h-[150px] font-mono text-sm"
                                  data-testid={`parsed-${log.id}`}
                                />
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="system" className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">System Prompt</h4>
                              <Textarea 
                                value={log.systemPrompt} 
                                readOnly 
                                className="min-h-[200px] font-mono text-sm"
                                data-testid={`system-prompt-${log.id}`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Performance</h4>
                                <div className="space-y-2 text-sm">
                                  <div>Response Time: {formatResponseTime(log.responseTimeMs)}</div>
                                  <div>Tokens Used: {log.tokensUsed || "N/A"}</div>
                                  <div>Temperature: {log.temperature}</div>
                                  <div>Model: {log.model}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Metadata</h4>
                                <div className="space-y-2 text-sm">
                                  <div>Operation: {log.operation}</div>
                                  <div>Round: {log.round}</div>
                                  <div>Created: {new Date(log.createdAt).toLocaleString()}</div>
                                  <div>Status: {log.success === "true" ? "Success" : `Error: ${log.success}`}</div>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}