import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Save,
  RefreshCw,
  ArrowRight,
  User,
  Database,
  Search,
  Filter
} from 'lucide-react';

interface CaseSnapshot {
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
}

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  round: number;
  timestamp: string;
  reason?: string;
}

interface CaseMeta {
  assessmentId: string;
  currentRound: number;
  maxRounds: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
  totalQuestions: number;
  totalAnswers: number;
}

interface CaseState {
  snapshot: CaseSnapshot;
  qa_log: QAEntry[];
  meta: CaseMeta;
}

export default function CaseStatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [editedSnapshot, setEditedSnapshot] = useState<CaseSnapshot | null>(null);
  const [filterRound, setFilterRound] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Query for case IDs list
  const { data: caseIdsData, isLoading: caseIdsLoading } = useQuery({
    queryKey: ['/api/case-states'],
    queryFn: async () => {
      const response = await fetch('/api/case-states');
      if (!response.ok) throw new Error('Failed to fetch case states');
      return response.json();
    }
  });

  // Query for specific case state
  const { data: caseStateData, isLoading: caseStateLoading, refetch } = useQuery({
    queryKey: ['/api/case-states', selectedCaseId],
    enabled: !!selectedCaseId,
    queryFn: async () => {
      const response = await fetch(`/api/case-states/${selectedCaseId}`);
      if (!response.ok) throw new Error('Failed to fetch case state');
      return response.json();
    }
  });

  const updateSnapshotMutation = useMutation({
    mutationFn: async (snapshot: CaseSnapshot) => {
      const response = await fetch(`/api/case-states/${selectedCaseId}/snapshot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      if (!response.ok) throw new Error('Failed to update snapshot');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/case-states', selectedCaseId] });
      toast({ title: 'Snapshot Updated', description: 'Case state snapshot has been updated successfully.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Update Failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const caseIds = caseIdsData?.caseIds || [];
  const caseState: CaseState | null = caseStateData?.caseState || null;

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    setEditedSnapshot(null);
    setFilterRound('all');
    setSearchTerm('');
  };

  const handleSnapshotEdit = () => {
    if (caseState) {
      setEditedSnapshot({ ...caseState.snapshot });
    }
  };

  const handleSaveSnapshot = () => {
    if (editedSnapshot) {
      updateSnapshotMutation.mutate(editedSnapshot);
    }
  };

  const handleResetSnapshot = () => {
    if (caseState) {
      setEditedSnapshot({ ...caseState.snapshot });
    }
  };

  const getStatusColor = (meta: CaseMeta) => {
    if (meta.isComplete) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (meta.currentRound > 1) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  };

  const getStatusIcon = (meta: CaseMeta) => {
    if (meta.isComplete) return <CheckCircle className="h-4 w-4" />;
    if (meta.currentRound > 1) return <Clock className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const filteredQALog = caseState?.qa_log.filter(qa => {
    const matchesRound = filterRound === 'all' || qa.round.toString() === filterRound;
    const matchesSearch = searchTerm === '' || 
      qa.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qa.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qa.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRound && matchesSearch;
  }) || [];

  if (caseIdsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Loading case states...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Case State Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            View and edit emigration case states with Q&A logs and categorized data
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Case List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Case States
                </CardTitle>
                <CardDescription>Select a case to view/edit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {caseIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No case states found</p>
                ) : (
                  caseIds.map((caseId: string) => (
                    <div
                      key={caseId}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedCaseId === caseId
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                      onClick={() => handleCaseSelect(caseId)}
                      data-testid={`case-select-${caseId}`}
                    >
                      <FileText className="h-4 w-4" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{caseId}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Case State
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Case Details */}
          <div className="lg:col-span-3">
            {!selectedCaseId ? (
              <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Select a case state to view details</p>
                </CardContent>
              </Card>
            ) : caseStateLoading ? (
              <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Loading case state...</p>
                </CardContent>
              </Card>
            ) : caseState ? (
              <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
                <CardHeader className="border-b bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <span className="truncate">{caseState.meta.assessmentId}</span>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <Badge className={getStatusColor(caseState.meta)}>
                          {getStatusIcon(caseState.meta)}
                          <span className="ml-1">
                            {caseState.meta.isComplete ? 'Complete' : `Round ${caseState.meta.currentRound}/${caseState.meta.maxRounds}`}
                          </span>
                        </Badge>
                        <span className="text-sm">
                          {caseState.meta.totalAnswers}/{caseState.meta.totalQuestions} answered
                        </span>
                        <span className="text-sm">
                          Updated: {new Date(caseState.meta.updatedAt).toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      data-testid="button-refresh"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="snapshot" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="snapshot">Snapshot Data</TabsTrigger>
                      <TabsTrigger value="qa-log">Q&A Log</TabsTrigger>
                      <TabsTrigger value="meta">Metadata</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="snapshot" className="space-y-6 mt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Case Snapshot (10 Categories)</h3>
                        <div className="flex gap-2">
                          {editedSnapshot ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetSnapshot}
                                data-testid="button-reset-snapshot"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reset
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveSnapshot}
                                disabled={updateSnapshotMutation.isPending}
                                data-testid="button-save-snapshot"
                              >
                                <Save className="h-4 w-4 mr-1" />
                                {updateSnapshotMutation.isPending ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSnapshotEdit}
                              data-testid="button-edit-snapshot"
                            >
                              Edit Snapshot
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(editedSnapshot || caseState.snapshot).map(([category, value]) => (
                          <div key={category} className="space-y-2">
                            <Label className="text-sm font-medium capitalize">
                              {category.replace('_', ' ')}
                            </Label>
                            {editedSnapshot ? (
                              <Textarea
                                value={value}
                                onChange={(e) => setEditedSnapshot({
                                  ...editedSnapshot,
                                  [category]: e.target.value
                                })}
                                rows={3}
                                className="text-sm"
                                data-testid={`textarea-${category}`}
                              />
                            ) : (
                              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md min-h-[80px]">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {value || <span className="text-muted-foreground italic">Empty</span>}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="qa-log" className="space-y-6 mt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Q&A Log ({filteredQALog.length} entries)</h3>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <Select value={filterRound} onValueChange={setFilterRound}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Rounds</SelectItem>
                                {Array.from({ length: caseState.meta.maxRounds }, (_, i) => i + 1).map(round => (
                                  <SelectItem key={round} value={round.toString()}>Round {round}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search questions/answers..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 w-64"
                              data-testid="input-search-qa"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {filteredQALog.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No Q&A entries found</p>
                        ) : (
                          filteredQALog.map((qa) => (
                            <Card key={qa.id} className="border border-gray-200 dark:border-gray-700">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      Round {qa.round}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {qa.category}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(qa.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <MessageSquare className="h-4 w-4 text-blue-500" />
                                      <span className="font-medium text-sm">Question</span>
                                      {qa.reason && (
                                        <span className="text-xs text-muted-foreground">({qa.reason})</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 ml-6">
                                      {qa.question}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <ArrowRight className="h-4 w-4 text-green-500" />
                                      <span className="font-medium text-sm">Answer</span>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 ml-6">
                                      {qa.answer || <span className="text-muted-foreground italic">Not answered yet</span>}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="meta" className="space-y-6 mt-6">
                      <h3 className="text-lg font-semibold">Case Metadata</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border border-gray-200 dark:border-gray-700">
                          <CardContent className="p-4">
                            <h4 className="font-medium mb-3">Assessment Info</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Assessment ID:</span>
                                <span className="font-mono">{caseState.meta.assessmentId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Current Round:</span>
                                <span>{caseState.meta.currentRound} / {caseState.meta.maxRounds}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge className={getStatusColor(caseState.meta)}>
                                  {caseState.meta.isComplete ? 'Complete' : 'In Progress'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border border-gray-200 dark:border-gray-700">
                          <CardContent className="p-4">
                            <h4 className="font-medium mb-3">Statistics</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Questions:</span>
                                <span>{caseState.meta.totalQuestions}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Answers:</span>
                                <span>{caseState.meta.totalAnswers}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Completion Rate:</span>
                                <span>
                                  {caseState.meta.totalQuestions > 0 
                                    ? Math.round((caseState.meta.totalAnswers / caseState.meta.totalQuestions) * 100)
                                    : 0}%
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="border border-gray-200 dark:border-gray-700 md:col-span-2">
                          <CardContent className="p-4">
                            <h4 className="font-medium mb-3">Timestamps</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Created:</span>
                                <span>{new Date(caseState.meta.createdAt).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Last Updated:</span>
                                <span>{new Date(caseState.meta.updatedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Case state not found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}