import { useMemo } from "react";
import { FileText, Info } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";

interface ParseEventsViewProps {
  onContinue: () => void;
}

const ParseEventsView = ({ onContinue }: ParseEventsViewProps) => {
  const { parsedData, columnDescriptions, updateColumnDescription } = useWorkflow();

  const columns = parsedData?.columns || [];
  const sampleRow = parsedData?.rows?.[0] || {};
  const totalRows = parsedData?.rowCount || 0;

  // Infer a rough type label for each column from the first non-null value
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    for (const col of columns) {
      const val = parsedData?.rows?.find(r => r[col] != null)?.[col];
      if (val === undefined || val === null) {
        types[col] = 'unknown';
      } else if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
        types[col] = 'numeric';
      } else {
        types[col] = 'text';
      }
    }
    return types;
  }, [columns, parsedData?.rows]);

  const filledCount = columns.filter(c => columnDescriptions[c]?.trim()).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <FileText className="w-5 h-5" />
          <span className="text-sm font-medium">Step 3 of 7</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Describe Your Columns</h2>
        <p className="text-muted-foreground mt-1">
          Add a short description for each column. This helps the AI correctly interpret variable
          names — especially abbreviated or domain-specific ones — when suggesting variables and
          analyses. Include any relevant context (e.g. units, scale, what a trial or event column
          represents).
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 mb-6 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <span>
          Descriptions are optional but recommended. Your dataset has{' '}
          <strong className="text-foreground">{totalRows}</strong> rows and{' '}
          <strong className="text-foreground">{columns.length}</strong> columns.{' '}
          {filledCount > 0
            ? `${filledCount} of ${columns.length} described so far.`
            : 'None described yet.'}
        </span>
      </div>

      {columns.length === 0 ? (
        <div className="card-section text-center py-10 text-muted-foreground text-sm">
          No dataset loaded. Go back and upload a file first.
        </div>
      ) : (
        <div className="space-y-3">
          {columns.map(col => {
            const sample = sampleRow[col];
            const typeLabel = columnTypes[col];
            const hasDescription = !!columnDescriptions[col]?.trim();

            return (
              <div
                key={col}
                className="flex flex-col gap-1.5 p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-sm font-semibold text-foreground truncate">{col}</code>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      typeLabel === 'numeric'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : typeLabel === 'text'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {typeLabel}
                    </span>
                  </div>
                  {sample !== undefined && sample !== null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      e.g.{' '}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {String(sample).length > 30
                          ? String(sample).slice(0, 30) + '…'
                          : String(sample)}
                      </code>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={`What does "${col}" represent? (optional)`}
                  value={columnDescriptions[col] || ''}
                  onChange={e => updateColumnDescription(col, e.target.value)}
                  className={`w-full text-sm rounded-md border px-3 py-2 bg-background outline-none transition-colors
                    placeholder:text-muted-foreground/60
                    focus:ring-1 focus:ring-primary focus:border-primary
                    ${hasDescription ? 'border-primary/40' : 'border-input'}`}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          onClick={onContinue}
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Continue to Variables
        </button>
      </div>
    </div>
  );
};

export default ParseEventsView;
