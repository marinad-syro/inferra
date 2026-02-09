import { useState, useEffect } from "react";
import Editor from '@monaco-editor/react';
import { useWorkflow } from "@/contexts/WorkflowContext";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw, Code2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CodeCanvasViewProps {
  onContinue?: () => void;
}

const CodeCanvasView = ({ onContinue }: CodeCanvasViewProps) => {
  const { session } = useWorkflow();
  const [language, setLanguage] = useState<'python' | 'r'>('python');
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load auto-generated code when session or language changes
  useEffect(() => {
    const loadGeneratedCode = async () => {
      if (!session?.id) return;

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.generateCode(session.id, language, {
          include_cleaning: true,
          include_transforms: true,
          include_analyses: true,
        });
        setCode(response.code);
        setOriginalCode(response.code);
        toast.success(`Generated ${language.toUpperCase()} code`);
      } catch (err: any) {
        console.error('Failed to generate code:', err);
        setError(err.message || 'Failed to generate code');
        toast.error('Failed to generate code');
      } finally {
        setLoading(false);
      }
    };

    loadGeneratedCode();
  }, [session?.id, language]);

  const handleExecute = async () => {
    if (!session?.id || !code.trim()) {
      toast.error('No code to execute');
      return;
    }

    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.executeCode(session.id, code, language);

      if (response.success) {
        setResult(response);
        toast.success(
          `Code executed successfully! Dataset: ${response.row_count} rows × ${response.column_names?.length} columns`
        );
      } else {
        setError(response.error || 'Code execution failed');
        toast.error('Code execution failed');
      }
    } catch (err: any) {
      console.error('Code execution error:', err);
      setError(err.message || 'Failed to execute code');
      toast.error('Failed to execute code');
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setCode(originalCode);
    setResult(null);
    setError(null);
    toast.info('Code reset to generated version');
  };

  const hasChanges = code !== originalCode;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={language === 'python' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('python')}
              disabled={loading || executing}
            >
              Python
            </Button>
            <Button
              variant={language === 'r' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLanguage('r')}
              disabled={loading || executing}
            >
              R
            </Button>
          </div>

          {/* Action Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || loading || executing}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>

          <Button
            size="sm"
            onClick={handleExecute}
            disabled={loading || executing || !code.trim()}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Code
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Switch to UI Canvas to continue the workflow
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Generating code...</p>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={language === 'python' ? 'python' : 'r'}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: language === 'python' ? 4 : 2,
              insertSpaces: true,
              wordWrap: 'on',
              padding: { top: 16, bottom: 16 },
            }}
          />
        )}

        {/* Status Bar */}
        <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium">{language.toUpperCase()}</span>
            <span>
              {code.split('\n').length} lines
            </span>
            {hasChanges && (
              <span className="text-orange-600">• Modified</span>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Last execution: {result.row_count} rows × {result.column_names?.length} columns
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Result/Error Display */}
      {error && (
        <div className="p-4 border-t bg-destructive/5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-1">Execution Error</div>
              <pre className="text-xs mt-2 overflow-x-auto whitespace-pre-wrap font-mono">
                {error}
              </pre>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {result && !error && (
        <div className="p-4 border-t bg-green-50 dark:bg-green-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Code Executed Successfully
              </div>
              <div className="text-sm text-green-800 dark:text-green-200">
                <div>Dataset updated:</div>
                <ul className="list-disc list-inside mt-1">
                  <li>{result.row_count} rows</li>
                  <li>{result.column_names?.length} columns: {result.column_names?.join(', ')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeCanvasView;
