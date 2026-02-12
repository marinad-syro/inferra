import { useState, useCallback } from "react";
import { Variable, Plus, Clock, Target, Zap, Trash2, ToggleLeft, ToggleRight, Sparkles, Loader2, Check, X } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { toast } from "sonner";
import { llmService } from "@/services/llmService";

interface CreateVariablesViewProps {
  onContinue: () => void;
}

interface SuggestedVariable {
  name: string;
  formula?: string; // Make formula optional
  formula_type?: string; // Formula type: 'eval' or 'transform'
  description: string;
}

const CreateVariablesView = ({ onContinue }: CreateVariablesViewProps) => {
  const { variables, addVariable, toggleVariable, deleteVariable, parsedData, session, columnDescriptions } = useWorkflow();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVariable, setNewVariable] = useState({ name: '', formula: '', formula_type: 'eval', description: '' });
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedVariable[]>([]);

  const getIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('time') || lowerName.includes('rt')) {
      return <Clock className="w-4 h-4 text-primary" />;
    }
    if (lowerName.includes('choice') || lowerName.includes('accuracy')) {
      return <Target className="w-4 h-4 text-primary" />;
    }
    return <Zap className="w-4 h-4 text-primary" />;
  };

  const handleAddVariable = async () => {
    if (newVariable.name && newVariable.formula) {
      await addVariable(newVariable);
      setNewVariable({ name: '', formula: '', formula_type: 'eval', description: '' });
      setShowAddForm(false);
    }
  };

  const handleGenerateSuggestions = useCallback(async () => {
    if (!parsedData?.rows?.length) {
      toast.error("No data available to analyze");
      return;
    }

    setGenerating(true);
    setSuggestions([]);

    try {
      // Call FastAPI backend for variable suggestions
      const suggestions = await llmService.suggestVariables({
        sampleRows: parsedData.rows.slice(0, 30),
        columns: parsedData.columns,
        researchQuestion: session?.research_question || undefined,
        columnDescriptions,
      });

      if (suggestions && suggestions.length > 0) {
        setSuggestions(suggestions);
        toast.success(`Generated ${suggestions.length} variable suggestions`);
      } else {
        toast.info("No variable suggestions generated. Try adding variables manually.");
      }
    } catch (error) {
      console.error("Generate suggestions error:", error);
      toast.error("Failed to generate suggestions. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [parsedData, session?.research_question, columnDescriptions]);

  const handleAcceptSuggestion = async (suggestion: SuggestedVariable) => {
    await addVariable(suggestion);
    setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
    toast.success(`Added "${suggestion.name}" variable`);
  };

  const handleRejectSuggestion = (suggestion: SuggestedVariable) => {
    setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
  };

  const hasVariables = variables.length > 0;
  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <Variable className="w-5 h-5" />
          <span className="text-sm font-medium">Step 3 of 6</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Create Variables</h2>
        <p className="text-muted-foreground mt-1">
          Derive analysis-ready variables from your parsed events.
        </p>
      </div>

      {/* AI Suggestions Section */}
      {hasSuggestions && (
        <div className="card-section mb-6 border-primary/30">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">AI Suggestions</h3>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {suggestions.length} pending
            </span>
          </div>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div 
                key={suggestion.name} 
                className="p-4 bg-primary/5 border border-primary/20 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {getIcon(suggestion.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{suggestion.name}</h4>
                      {suggestion.formula_type && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          suggestion.formula_type === 'python'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : suggestion.formula_type === 'transform'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {suggestion.formula_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
                    <code className="text-xs font-mono text-primary bg-accent/50 px-2 py-0.5 rounded mt-2 inline-block">
                      {suggestion.formula}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAcceptSuggestion(suggestion)}
                      className="p-1.5 text-success hover:bg-success/10 rounded transition-colors"
                      title="Accept"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion(suggestion)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State or Variables List */}
      <div className="card-section mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Derived Variables</h3>
          {hasVariables && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {variables.filter(v => v.is_enabled).length} active
            </span>
          )}
        </div>

        {!hasVariables && !hasSuggestions ? (
          <div className="text-center py-8">
            <Variable className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h4 className="text-sm font-medium text-foreground mb-2">No variables yet</h4>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Let AI analyze your data and suggest useful derived variables, or add your own custom formulas.
            </p>
            <button
              onClick={handleGenerateSuggestions}
              disabled={generating || !parsedData?.rows?.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing data...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Suggestions
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((variable) => (
              <div 
                key={variable.id} 
                className={`p-4 bg-background border rounded-lg transition-all ${
                  variable.is_enabled 
                    ? 'border-border hover:border-primary/30' 
                    : 'border-border/50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    {getIcon(variable.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{variable.name}</h4>
                        {variable.formula_type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            variable.formula_type === 'python'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : variable.formula_type === 'transform'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                            {variable.formula_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleVariable(variable.id, !variable.is_enabled)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title={variable.is_enabled ? "Disable" : "Enable"}
                        >
                          {variable.is_enabled ? (
                            <ToggleRight className="w-5 h-5 text-primary" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteVariable(variable.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{variable.description}</p>
                    <code className="text-xs font-mono text-primary bg-accent/50 px-2 py-0.5 rounded mt-2 inline-block">
                      {variable.formula}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate More / Add Custom */}
      {(hasVariables || hasSuggestions) && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleGenerateSuggestions}
            disabled={generating || !parsedData?.rows?.length}
            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Generate More Suggestions</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Add Custom Variable */}
      <div className="card-section">
        {showAddForm ? (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Add Custom Variable</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Variable name (e.g., Accuracy)"
                value={newVariable.name}
                onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Formula Type Selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Formula Type</label>
                <select
                  value={newVariable.formula_type}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, formula_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="eval">Eval - Simple Numeric Operations (e.g., col1 + col2)</option>
                  <option value="transform">Transform - Single-Line Functions (e.g., normalize('col'))</option>
                  <option value="python">Python - Multi-Line Code (e.g., map then composite)</option>
                </select>
              </div>

              <input
                type="text"
                placeholder={newVariable.formula_type === 'transform'
                  ? "Formula (e.g., map_binary('Status', {'Yes': 1, 'No': 0}))"
                  : "Formula (e.g., `Score_Post` - `Score_Pre`)"}
                value={newVariable.formula}
                onChange={(e) => setNewVariable(prev => ({ ...prev, formula: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Show transform documentation */}
              {newVariable.formula_type === 'transform' && (
                <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-md">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">Available Transform Functions:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 font-mono">
                    <li>• map_binary('col', {'{'}'val1': 1, 'val2': 0{'}'})</li>
                    <li>• normalize('col', min_val=0, max_val=1)</li>
                    <li>• z_score('col')</li>
                    <li>• composite_score(['col1', 'col2'], weights=[0.5, 0.5])</li>
                    <li>• conditional_numeric('col', '&gt;', 50, 'High', 'Low')</li>
                    <li>• percentile_rank('col')</li>
                  </ul>
                </div>
              )}

              <input
                type="text"
                placeholder="Description (optional)"
                value={newVariable.description}
                onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVariable}
                disabled={!newVariable.name || !newVariable.formula}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Variable
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Custom Variable</span>
          </button>
        )}
      </div>

      {/* Action */}
      <div className="mt-6 flex items-center justify-end">
        <button 
          onClick={onContinue}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Choose Analysis
        </button>
      </div>
    </div>
  );
};

export default CreateVariablesView;
