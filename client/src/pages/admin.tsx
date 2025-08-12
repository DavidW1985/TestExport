import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, RotateCcw, FileText, Cpu, MessageSquare, Activity, Package, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptConfig | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<PromptConfig | null>(null);

  const { data: promptsData, isLoading } = useQuery({
    queryKey: ['/api/prompts'],
    queryFn: async () => {
      const response = await fetch('/api/prompts');
      if (!response.ok) throw new Error('Failed to fetch prompts');
      return response.json();
    }
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (prompt: PromptConfig) => {
      const response = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prompt.name,
          description: prompt.description,
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
          temperature: prompt.temperature,
          maxTokens: prompt.maxTokens
        }),
      });
      if (!response.ok) throw new Error('Failed to update prompt');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      toast({ title: 'Prompt Updated', description: 'Your changes have been saved successfully.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Update Failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  // Sort prompts to ensure God Prompt (systemPrompt) is first and Global Prompt (globalPrompt) is second
  const prompts = (promptsData?.prompts || []).sort((a: PromptConfig, b: PromptConfig) => {
    // Define priority order
    const priorityOrder = ['systemPrompt', 'globalPrompt'];
    
    const aIndex = priorityOrder.indexOf(a.id);
    const bIndex = priorityOrder.indexOf(b.id);
    
    // If both are in priority list, sort by their position
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only a is in priority list, it comes first
    if (aIndex !== -1) {
      return -1;
    }
    
    // If only b is in priority list, it comes first
    if (bIndex !== -1) {
      return 1;
    }
    
    // If neither is in priority list, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    if (prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0]);
      setEditedPrompt(prompts[0]);
    }
  }, [prompts, selectedPrompt]);

  const handlePromptSelect = (prompt: PromptConfig) => {
    setSelectedPrompt(prompt);
    setEditedPrompt({ ...prompt });
  };

  const handleSave = () => {
    if (editedPrompt) {
      updatePromptMutation.mutate(editedPrompt);
    }
  };

  const handleReset = () => {
    if (selectedPrompt) {
      setEditedPrompt({ ...selectedPrompt });
    }
  };

  const getIconForPrompt = (id: string) => {
    switch (id) {
      case 'categorization': return <FileText className="h-4 w-4" />;
      case 'followUp': return <MessageSquare className="h-4 w-4" />;
      case 'updateCategories': return <Cpu className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Loading prompts...</p>
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
            LLM Prompt Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Edit and configure the prompts used by the AI system
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/llm-logs">
              <Button variant="outline" className="gap-2" data-testid="button-view-logs">
                <Activity className="w-4 h-4" />
                View LLM Logs
              </Button>
            </Link>
            <Link href="/pricing-packages">
              <Button variant="outline" className="gap-2" data-testid="button-pricing-packages">
                <Package className="w-4 h-4" />
                Manage Pricing Packages
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Prompt List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-lg">Available Prompts</CardTitle>
                <CardDescription>Select a prompt to edit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {prompts.map((prompt: PromptConfig) => (
                  <div
                    key={prompt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedPrompt?.id === prompt.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => handlePromptSelect(prompt)}
                    data-testid={`prompt-select-${prompt.id}`}
                  >
                    {getIconForPrompt(prompt.id)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{prompt.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {prompt.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Prompt Editor */}
          <div className="lg:col-span-3">
            {editedPrompt && (
              <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
                <CardHeader className="border-b bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {getIconForPrompt(editedPrompt.id)}
                        <span className="truncate">{editedPrompt.name}</span>
                      </CardTitle>
                      <CardDescription className="truncate">{editedPrompt.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        data-testid="button-reset"
                        className="flex items-center"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={updatePromptMutation.isPending}
                        data-testid="button-save"
                        className="flex items-center"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {updatePromptMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="prompts" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="prompts">Prompts</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                      <TabsTrigger value="info">Info</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="prompts" className="space-y-6 mt-6">
                      <div className="space-y-4">
                        {/* Show different content based on prompt type */}
                        {editedPrompt.id === 'systemPrompt' ? (
                          <div>
                            <Label htmlFor="systemPromptContent" className="text-base font-medium">
                              Global System Prompt
                            </Label>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              The unified system prompt used across all Clarity modes
                            </p>
                            <Textarea
                              id="systemPromptContent"
                              value={editedPrompt.userPrompt}
                              onChange={(e) => setEditedPrompt({ ...editedPrompt, userPrompt: e.target.value })}
                              rows={15}
                              className="font-mono text-sm"
                              data-testid="textarea-system-prompt-content"
                            />
                          </div>
                        ) : editedPrompt.id === 'globalPrompt' ? (
                          <div>
                            <Label htmlFor="globalPromptContent" className="text-base font-medium">
                              Global Prompt Template
                            </Label>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Template variables and rules that can be referenced by mode-specific prompts
                            </p>
                            <Textarea
                              id="globalPromptContent"
                              value={editedPrompt.userPrompt}
                              onChange={(e) => setEditedPrompt({ ...editedPrompt, userPrompt: e.target.value })}
                              rows={20}
                              className="font-mono text-sm"
                              data-testid="textarea-global-prompt-content"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label htmlFor="userPrompt" className="text-base font-medium">
                              User Prompt Template
                            </Label>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              The specific instruction template for this mode with variables like {`{{destination}}`}
                            </p>
                            <Textarea
                              id="userPrompt"
                              value={editedPrompt.userPrompt}
                              onChange={(e) => setEditedPrompt({ ...editedPrompt, userPrompt: e.target.value })}
                              rows={20}
                              className="font-mono text-sm"
                              data-testid="textarea-user-prompt"
                            />
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-6 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="name" className="text-base font-medium">
                            Prompt Name
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            This name appears in the prompt list and header
                          </p>
                          <Input
                            id="name"
                            value={editedPrompt.name}
                            onChange={(e) => setEditedPrompt({ ...editedPrompt, name: e.target.value })}
                            placeholder="Enter a descriptive name for this prompt"
                            data-testid="input-name"
                          />
                        </div>

                        <div>
                          <Label htmlFor="description" className="text-base font-medium">
                            Description
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Brief description of what this prompt does
                          </p>
                          <Input
                            id="description"
                            value={editedPrompt.description}
                            onChange={(e) => setEditedPrompt({ ...editedPrompt, description: e.target.value })}
                            placeholder="Describe the purpose of this prompt"
                            data-testid="input-description"
                          />
                        </div>

                        <div>
                          <Label htmlFor="temperature" className="text-base font-medium">
                            Temperature ({editedPrompt.temperature})
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Controls randomness (0.0 = deterministic, 2.0 = very creative)
                          </p>
                          <Input
                            id="temperature"
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={editedPrompt.temperature}
                            onChange={(e) => setEditedPrompt({ ...editedPrompt, temperature: parseFloat(e.target.value) || 0 })}
                            data-testid="input-temperature"
                          />
                        </div>

                        <div>
                          <Label htmlFor="maxTokens" className="text-base font-medium">
                            Max Tokens ({editedPrompt.maxTokens})
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Maximum response length (1 token ≈ 4 characters)
                          </p>
                          <Input
                            id="maxTokens"
                            type="number"
                            min="1"
                            max="4000"
                            value={editedPrompt.maxTokens}
                            onChange={(e) => setEditedPrompt({ ...editedPrompt, maxTokens: parseInt(e.target.value) || 1500 })}
                            data-testid="input-max-tokens"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="info" className="space-y-6 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-base font-medium">Prompt ID</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{editedPrompt.id}</p>
                        </div>
                        
                        <div>
                          <Label className="text-base font-medium">AI Model</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {editedPrompt.model || 'gpt-4o'}
                            </Badge>
                            <p className="text-xs text-gray-500">Currently used model</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-base font-medium">Created</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(editedPrompt.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <Label className="text-base font-medium">Last Updated</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(editedPrompt.updatedAt).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <Label className="text-base font-medium">Status</Label>
                          <Badge variant="secondary">Active</Badge>
                        </div>

                        <div>
                          <Label className="text-base font-medium">Usage</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Backend processing & AI responses
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}