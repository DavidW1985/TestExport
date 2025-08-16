import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User, Clock, MessageSquare, Brain, FileText } from 'lucide-react';

export default function EventLogsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Get all user IDs
  const { data: userIds } = useQuery({
    queryKey: ['/api/events/users'],
    refetchInterval: 5000,
  });

  // Get events for selected user
  const { data: userEvents, refetch } = useQuery({
    queryKey: ['/api/events/users', selectedUserId],
    enabled: !!selectedUserId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (userIds?.userIds?.length > 0 && !selectedUserId) {
      setSelectedUserId(userIds.userIds[0]);
    }
  }, [userIds, selectedUserId]);

  const formatEventType = (eventType: string) => {
    switch (eventType) {
      case 'initial_assessment':
        return { label: 'Initial Assessment', icon: FileText, color: 'bg-blue-500' };
      case 'follow_up_answer':
        return { label: 'Follow-up Answer', icon: MessageSquare, color: 'bg-green-500' };
      case 'categorization':
        return { label: 'LLM Categorization', icon: Brain, color: 'bg-purple-500' };
      case 'llm_analysis':
        return { label: 'LLM Analysis', icon: Brain, color: 'bg-orange-500' };
      default:
        return { label: eventType, icon: Clock, color: 'bg-gray-500' };
    }
  };

  const formatTreatment = (treatment: string | null) => {
    if (!treatment) return null;
    
    const colors = {
      fact: 'bg-green-100 text-green-800',
      unknown: 'bg-yellow-100 text-yellow-800',
      contradictory: 'bg-red-100 text-red-800',
      clarification_needed: 'bg-blue-100 text-blue-800',
    };
    
    return (
      <Badge className={colors[treatment as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {treatment}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Event Log Viewer
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Append-only database of all user interactions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User Selection */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Select User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userIds?.userIds?.map((userId: string) => (
                      <SelectItem key={userId} value={userId}>
                        {userId.split('-')[0]}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {userEvents?.stats && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>Total Events:</strong> {userEvents.stats.totalEvents}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Current Round:</strong> {userEvents.stats.currentRound}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Complete:</strong> {userEvents.stats.isComplete ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Categories:</strong> {userEvents.stats.categoriesCovered?.length || 0}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Event Timeline */}
          <div className="lg:col-span-3">
            {userEvents?.events && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Timeline - {selectedUserId.split('-')[0]}...</CardTitle>
                  <CardDescription>
                    Immutable append-only log of all user interactions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userEvents.events.map((event: any, index: number) => {
                    const eventFormat = formatEventType(event.eventType);
                    const Icon = eventFormat.icon;
                    
                    return (
                      <div key={event.id} className="relative">
                        {index < userEvents.events.length - 1 && (
                          <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200 dark:bg-gray-700" />
                        )}
                        
                        <div className="flex gap-4">
                          <div className={`flex-shrink-0 w-12 h-12 ${eventFormat.color} rounded-full flex items-center justify-center text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  Event #{event.eventId} - {eventFormat.label}
                                </h3>
                                {event.llmTreatment && formatTreatment(event.llmTreatment)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(event.timestamp).toLocaleString()}
                              </div>
                            </div>
                            
                            <div className="mt-2 space-y-2">
                              {event.questionType && (
                                <div className="text-sm">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span> {event.questionType}
                                </div>
                              )}
                              
                              {event.questionText && (
                                <div className="text-sm">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Question:</span>
                                  <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
                                    {event.questionText}
                                  </div>
                                </div>
                              )}
                              
                              {event.userAnswer && (
                                <div className="text-sm">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Answer:</span>
                                  <div className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded text-green-800 dark:text-green-200">
                                    {event.userAnswer}
                                  </div>
                                </div>
                              )}
                              
                              {event.llmCategory && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">LLM Category:</span>
                                  <Badge variant="outline">{event.llmCategory}</Badge>
                                  {event.llmConfidence && (
                                    <span className="text-gray-500">
                                      ({Math.round(event.llmConfidence * 100)}% confidence)
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {event.roundNumber && (
                                <div className="text-sm">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Round:</span> {event.roundNumber}
                                </div>
                              )}
                              
                              {event.metadata && (
                                <details className="text-sm">
                                  <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                    Metadata
                                  </summary>
                                  <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto">
                                    {JSON.stringify(event.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {index < userEvents.events.length - 1 && <Separator className="my-4" />}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}