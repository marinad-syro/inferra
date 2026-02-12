import { useState, useEffect, useCallback } from "react";
import Editor from '@monaco-editor/react';
import { useWorkflow } from "@/contexts/WorkflowContext";
import { apiClient } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw, Code2, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CodeCanvasViewProps {
  onContinue?: () => void;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

const CodeCanvasView = ({ onContinue, refreshTrigger }: CodeCanvasViewProps) => {
  const { session } = useWorkflow();
  const [language, setLanguage] = useState<'python' | 'r'>('python');
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load auto-generated code from latest UI workflow state
  const loadGeneratedCode = useCallback(async () => {
    if (!session?.id) {
      setCode('// No active session. Please start by uploading data.');
      setOriginalCode('// No active session. Please start by uploading data.');
      return;
    }

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

      if (response.operations_included && response.operations_included.length > 0) {
        toast.success(`Generated ${language.toUpperCase()} code with ${response.operations_included.length} operations`);
      } else {
        toast.info(`Generated ${language.toUpperCase()} code (no operations yet)`);
      }
    } catch (err: any) {
      console.error('Failed to generate code:', err);
      const errorMsg = err.message || 'Failed to generate code';
      setError(errorMsg);

      // Provide helpful error message
      if (errorMsg.includes('No session') || errorMsg.includes('404')) {
        setCode('// Session not found. Please upload data first.');
        setOriginalCode('// Session not found. Please upload data first.');
        toast.error('Session not found. Start by uploading data.');
      } else {
        toast.error('Failed to generate code');
      }
    } finally {
      setLoading(false);
    }
  }, [session?.id, language]);

  // Load code when session, language, or refreshTrigger changes
  useEffect(() => {
    loadGeneratedCode();
  }, [loadGeneratedCode, refreshTrigger]);

  const handleExecute = async () => {
    if (!session?.id || !code.trim()) {
      toast.error('No code to execute');
      return;
    }

    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      // Get dataset reference from session
      const datasetReference = session.dataset_reference;

      const response = await apiClient.executeCode(session.id, code, language, datasetReference);

      if (response.success) {
        setResult(response);
        console.log('Code execution response:', response);
        console.log('Console output:', response.console_output);
        console.log('Plots:', response.plots?.length);
        console.log('Analysis results:', response.analysis_results);
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
    toast.info('Code reset to last generated version');
  };

  const handleRefresh = () => {
    setResult(null);
    setError(null);
    loadGeneratedCode();
  };

  const hasChanges = code !== originalCode;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background">
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
            onClick={handleRefresh}
            disabled={loading || executing}
            title="Regenerate code from latest UI workflow changes"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || loading || executing}
            title="Reset to last generated code"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Undo Changes
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
          {loading ? 'Generating code...' : hasChanges ? 'Code modified' : 'Switch to UI Canvas to continue the workflow'}
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Editor */}
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
          <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="font-medium">{language.toUpperCase()}</span>
              <span>{code.split('\n').length} lines</span>
              {hasChanges && <span className="text-orange-600">• Modified</span>}
            </div>
          </div>
        </div>

        {/* Right: Output Panel */}
        <div className="w-96 border-l flex flex-col bg-muted/5">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Output
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!result && !error && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Run code to see output</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Execution Error</div>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-black/10 p-2 rounded">
                    {error}
                  </pre>
                  {result?.console_output && (
                    <div className="mt-3">
                      <div className="font-semibold mb-1 text-xs">Console Output (before error):</div>
                      <pre className="text-xs bg-black/10 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                        {result.console_output}
                      </pre>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result && !error && (
              <div className="space-y-4">
                {/* Success Status */}
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold text-sm">Executed Successfully</span>
                </div>

                {/* Dataset Info */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">DATASET</h4>
                  <div className="bg-background border rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rows:</span>
                      <span className="font-mono font-semibold">{result.row_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Columns:</span>
                      <span className="font-mono font-semibold">{result.column_names?.length}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    <div className="text-muted-foreground mb-1">Column names:</div>
                    <div className="flex flex-wrap gap-1">
                      {result.column_names?.map((col: string) => (
                        <code key={col} className="px-2 py-0.5 bg-primary/10 rounded text-xs">
                          {col}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Analysis Results */}
                {result.analysis_results && Object.keys(result.analysis_results).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">ANALYSIS RESULTS</h4>
                    <div className="bg-background border rounded-lg p-3 space-y-2 text-sm">
                      {Object.entries(result.analysis_results).map(([key, value]) => (
                        <div key={key} className="border-b last:border-b-0 pb-2 last:pb-0">
                          <div className="text-xs font-semibold text-primary mb-1">{key}</div>
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plots/Visualizations */}
                {result.plots && result.plots.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      VISUALIZATIONS ({result.plots.length})
                    </h4>
                    <div className="space-y-3">
                      {result.plots.map((plot, idx) => (
                        <div key={idx} className="bg-background border rounded-lg p-2 overflow-hidden">
                          <img
                            src={`data:image/png;base64,${plot}`}
                            alt={`Plot ${idx + 1}`}
                            className="w-full h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Console Output - Always show if exists, even if empty */}
                {result.console_output !== undefined && result.console_output !== null && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      CONSOLE OUTPUT
                      {result.console_output.trim() === '' && <span className="ml-2 text-xs text-muted-foreground/50">(empty)</span>}
                    </h4>
                    {result.console_output.trim() ? (
                      <pre className="text-xs bg-black dark:bg-black/50 text-green-400 p-3 rounded-lg font-mono overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto border border-green-900/20">
{result.console_output}</pre>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg border">
                        No console output (no print statements)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeCanvasView;
