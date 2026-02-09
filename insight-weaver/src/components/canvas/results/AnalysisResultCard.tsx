import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface AnalysisResult {
  title: string;
  analysisType: string;
  description?: string;
  parameters: { name: string; value: string; interpretation?: string }[];
  metrics: { name: string; value: string; highlight?: boolean }[];
}

interface AnalysisResultCardProps {
  result: AnalysisResult;
  onRequestInterpretation: (result: AnalysisResult) => Promise<string>;
}

const AnalysisResultCard = ({ result, onRequestInterpretation }: AnalysisResultCardProps) => {
  const [isInterpretationOpen, setIsInterpretationOpen] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleInterpretation = async () => {
    if (!isInterpretationOpen && !interpretation) {
      setIsLoading(true);
      setError(null);
      try {
        const text = await onRequestInterpretation(result);
        setInterpretation(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate interpretation');
      } finally {
        setIsLoading(false);
      }
    }
    setIsInterpretationOpen(!isInterpretationOpen);
  };

  return (
    <div className="card-section mb-6">
      <h3 className="text-base font-semibold text-foreground mb-2">{result.title}</h3>
      {result.description && (
        <p className="text-sm text-muted-foreground mb-4">{result.description}</p>
      )}

      {/* Parameters Table */}
      {result.parameters && result.parameters.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Parameter Estimates</h4>
          <div className="overflow-hidden rounded-lg border border-[hsl(var(--table-border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--table-header))]">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Parameter</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Note</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {result.parameters.map((param) => (
                  <tr key={param.name} className="border-t border-[hsl(var(--table-border))]">
                    <td className="px-4 py-2 font-medium">{param.name}</td>
                    <td className="px-4 py-2 font-mono text-primary">{param.value}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{param.interpretation || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model Fit Metrics */}
      {result.metrics && result.metrics.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Test Results</h4>
          <div className="grid grid-cols-3 gap-3">
            {result.metrics.map((metric) => (
              <div
                key={metric.name}
                className={`p-3 rounded-lg text-center ${metric.highlight ? 'bg-primary/20 ring-1 ring-primary/40' : 'bg-accent/30'}`}
              >
                <div className={`text-sm font-mono font-semibold ${metric.highlight ? 'text-primary' : 'text-foreground'}`}>
                  {metric.value}
                </div>
                <div className="text-xs text-muted-foreground">{metric.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Interpretation Collapsible */}
      <Collapsible open={isInterpretationOpen} onOpenChange={setIsInterpretationOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full flex items-center justify-between gap-2"
            onClick={handleToggleInterpretation}
            disabled={isLoading}
          >
            <span className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
              {isLoading ? 'Generating interpretation...' : 'AI Interpretation'}
            </span>
            {isInterpretationOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}
          {interpretation && (
            <div className="p-4 bg-accent/30 rounded-lg border border-border">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {interpretation}
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AnalysisResultCard;
