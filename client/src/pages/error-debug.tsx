import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Copy, RotateCcw, Home } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface ErrorInfo {
  type: string;
  message: string;
  timestamp: string;
  assessmentId?: string;
  currentRound?: number;
  requestData?: any;
  responseStatus?: number;
  responseData?: any;
  stack?: string;
}

export default function ErrorDebugPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    // Get error info from session storage
    const errorData = sessionStorage.getItem('debugError');
    if (errorData) {
      setErrorInfo(JSON.parse(errorData));
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Error details copied for debugging",
    });
  };

  const copyFullError = () => {
    const fullError = JSON.stringify(errorInfo, null, 2);
    copyToClipboard(fullError);
  };

  const retryOperation = () => {
    // Clear the error and go back to follow-up
    sessionStorage.removeItem('debugError');
    setLocation('/follow-up');
  };

  const startOver = () => {
    // Clear everything and start fresh
    sessionStorage.clear();
    setLocation('/');
  };

  if (!errorInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No error information found.</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-red-700 dark:text-red-400">
              Runtime Error Detected
            </CardTitle>
            <CardDescription className="text-lg">
              Here are the complete error details for debugging
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Error Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Error Summary
              <Badge variant="destructive">{errorInfo.type}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Message:</strong>
              <p className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                {errorInfo.message}
              </p>
            </div>
            
            <div>
              <strong>Timestamp:</strong>
              <p>{errorInfo.timestamp}</p>
            </div>

            {errorInfo.assessmentId && (
              <div>
                <strong>Assessment ID:</strong>
                <p className="font-mono">{errorInfo.assessmentId}</p>
              </div>
            )}

            {errorInfo.currentRound && (
              <div>
                <strong>Current Round:</strong>
                <p>{errorInfo.currentRound}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Data */}
        {errorInfo.requestData && (
          <Card>
            <CardHeader>
              <CardTitle>Request Data Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(errorInfo.requestData, null, 2)}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => copyToClipboard(JSON.stringify(errorInfo.requestData, null, 2))}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Request Data
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Response Details */}
        {(errorInfo.responseStatus || errorInfo.responseData) && (
          <Card>
            <CardHeader>
              <CardTitle>Server Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorInfo.responseStatus && (
                <div>
                  <strong>Status Code:</strong>
                  <Badge variant={errorInfo.responseStatus >= 400 ? "destructive" : "default"} className="ml-2">
                    {errorInfo.responseStatus}
                  </Badge>
                </div>
              )}
              
              {errorInfo.responseData && (
                <div>
                  <strong>Response Body:</strong>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-sm">
                    {typeof errorInfo.responseData === 'string' 
                      ? errorInfo.responseData 
                      : JSON.stringify(errorInfo.responseData, null, 2)
                    }
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stack Trace */}
        {errorInfo.stack && (
          <Card>
            <CardHeader>
              <CardTitle>Stack Trace</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-sm">
                {errorInfo.stack}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => copyToClipboard(errorInfo.stack!)}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Stack Trace
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              <Button onClick={copyFullError} variant="outline">
                <Copy className="w-4 h-4 mr-2" />
                Copy All Error Details
              </Button>
              
              <Button onClick={retryOperation} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry Operation
              </Button>
              
              <Button onClick={startOver}>
                <Home className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}