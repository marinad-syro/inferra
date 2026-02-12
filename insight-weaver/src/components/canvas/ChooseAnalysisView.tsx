import { useEffect, useCallback, useState } from "react";
import { BarChart3, Brain, LineChart, Layers, Sparkles, Loader2, Info, Plus, X, CheckCircle2 } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { toast } from "sonner";
import { ANALYSIS_CATALOG } from "@/constants/analysisParameterCatalog";
import { apiClient } from "@/services/apiClient";

interface ChooseAnalysisViewProps {
  onContinue: () => void;
}

const complexityColors = {
  Basic: "bg-success/10 text-success",
  Intermediate: "bg-warning/10 text-warning",
  Advanced: "bg-primary/10 text-primary",
};

const getAnalysisIcon = (id: string) => {
  if (id.includes('reinforcement') || id.includes('learning') || id.includes('rl')) {
    return <Brain className="w-5 h-5" />;
  }
  if (id.includes('mixed') || id.includes('hierarchical') || id.includes('regression')) {
    return <Layers className="w-5 h-5" />;
  }
  if (id.includes('drift') || id.includes('diffusion') || id.includes('ddm')) {
    return <LineChart className="w-5 h-5" />;
  }
  return <BarChart3 className="w-5 h-5" />;
};

const ChooseAnalysisView = ({ onContinue }: ChooseAnalysisViewProps) => {
  const {
    selections,
    selectionsLoading,
    selectionsGenerating,
    generateAnalysisSuggestions,
    toggleSelection,
    fetchSelections,
    parsedData,
    session,
    variables,
    trialStructure,
    columnDescriptions,
  } = useWorkflow();

  const sessionId = session?.id;

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customMethod, setCustomMethod] = useState('');
  const [customParamMap, setCustomParamMap] = useState<Record<string, string>>({});

  // Get all columns from parsed data
  const dataColumns = parsedData?.columns || [];

  // Add derived variables as selectable columns
  const derivedVariableNames = variables
    .filter(v => v.is_enabled)
    .map(v => v.name);

  const availableColumns = [
    ...dataColumns,
    ...derivedVariableNames.filter(name => !dataColumns.includes(name))
  ];

  // Auto-generate suggestions when component mounts — only if no selections exist yet
  useEffect(() => {
    const autoGenerate = async () => {
      if (parsedData?.rows?.length && !selectionsGenerating && selections.length === 0) {
        await generateAnalysisSuggestions({
          columns: availableColumns,
          sampleRows: parsedData.rows.slice(0, 30),
          researchQuestion: session?.research_question || undefined,
          distributionType: session?.distribution_type || undefined,
          hasOutliers: session?.has_outliers || undefined,
          derivedVariables: variables.filter(v => v.is_enabled).map(v => ({
            name: v.name,
            formula: v.formula
          })),
          trialsDetected: trialStructure?.trials_detected || 0,
          columnDescriptions,
        });
      }
    };
    autoGenerate();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAnalyses = selections.filter(s => s.is_selected);
  const unselectedSuggestions = selections.filter(s => !s.is_selected);
  const selectedCount = selectedAnalyses.length;
  const hasSelections = selections.length > 0;

  const handleGenerateSuggestions = useCallback(async () => {
    if (!parsedData?.rows?.length) {
      toast.error("No data available to analyze");
      return;
    }

    try {
      const result = await generateAnalysisSuggestions({
        columns: availableColumns,
        sampleRows: parsedData.rows.slice(0, 30),
        researchQuestion: session?.research_question || undefined,
        distributionType: session?.distribution_type || undefined,
        hasOutliers: session?.has_outliers || undefined,
        derivedVariables: variables.filter(v => v.is_enabled).map(v => ({
          name: v.name,
          formula: v.formula
        })),
        trialsDetected: trialStructure?.trials_detected || 0,
        columnDescriptions,
      });

      if (result.length > 0) {
        toast.success(`Generated ${result.length} analysis recommendations`);
      } else {
        toast.info("No analysis suggestions generated. Try providing more context about your research question.");
      }
    } catch (error) {
      console.error("Generate suggestions error:", error);
      toast.error("Failed to generate analysis suggestions");
    }
  }, [parsedData, session, variables, trialStructure, generateAnalysisSuggestions]);

  // Handle custom analysis form method change — reset param map
  const handleMethodChange = (method: string) => {
    setCustomMethod(method);
    setCustomParamMap({});
  };

  // Submit custom analysis
  const handleAddCustomAnalysis = useCallback(async () => {
    if (!customMethod || !sessionId) return;

    const catalogEntry = ANALYSIS_CATALOG[customMethod];
    if (!catalogEntry) return;

    // Validate all params filled
    const allFilled = catalogEntry.params.every(p => customParamMap[p.key]);
    if (!allFilled) {
      toast.error("Please assign a column to every parameter");
      return;
    }

    const execution_spec = {
      library: catalogEntry.library,
      function: customMethod,
      param_map: customParamMap,
    };

    const toInsert = [
      ...selections.map(s => ({
        analysis_type: s.analysis_type,
        title: s.title,
        description: s.description,
        complexity: s.complexity,
        reasoning: s.reasoning,
        is_selected: s.is_selected,
        execution_spec: s.execution_spec,
        selected_columns: s.selected_columns,
      })),
      {
        analysis_type: `custom_${customMethod}_${Date.now()}`,
        title: `${catalogEntry.label} (Custom)`,
        description: catalogEntry.description,
        complexity: catalogEntry.complexity,
        reasoning: 'Manually configured by user',
        is_selected: true,
        execution_spec,
        selected_columns: Object.values(customParamMap),
      },
    ];

    try {
      await apiClient.createSelections(sessionId, toInsert);
      toast.success(`Added custom ${catalogEntry.label}`);
      setShowCustomForm(false);
      setCustomMethod('');
      setCustomParamMap({});
      // Refresh state from server without full page reload
      await fetchSelections();
    } catch (err) {
      console.error("Add custom analysis error:", err);
      toast.error("Failed to add custom analysis");
    }
  }, [customMethod, customParamMap, selections, sessionId, fetchSelections]);

  if (selectionsLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const catalogEntry = customMethod ? ANALYSIS_CATALOG[customMethod] : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <BarChart3 className="w-5 h-5" />
          <span className="text-sm font-medium">Step 5 of 6</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Choose Analysis</h2>
        <p className="text-muted-foreground mt-1">
          Select one or more analysis methods appropriate for your research question.
        </p>
      </div>

      {/* Selected Analyses — always visible when any are selected */}
      {selectedCount > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Selected Analyses ({selectedCount})
          </h3>
          <div className="grid gap-3">
            {selectedAnalyses.map((selection) => {
              const complexity = (selection.complexity as keyof typeof complexityColors) || 'Intermediate';
              return (
                <div
                  key={selection.id}
                  className="card-section ring-2 ring-primary bg-primary/5 flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary text-primary-foreground">
                    {getAnalysisIcon(selection.analysis_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">
                        {selection.title || selection.analysis_type}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${complexityColors[complexity] || complexityColors.Intermediate}`}>
                        {complexity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selection.description || "Statistical analysis method"}
                    </p>
                    {selection.selected_columns && selection.selected_columns.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selection.selected_columns.map(col => (
                          <span key={col} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                            {col}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSelection(selection.analysis_type)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {!hasSelections ? (
        <div className="card-section mb-6 text-center py-8">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h4 className="text-sm font-medium text-foreground mb-2">No analysis methods yet</h4>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
            Let AI recommend analysis methods based on your data structure, research question, and derived variables.
          </p>
          <button
            onClick={handleGenerateSuggestions}
            disabled={selectionsGenerating || !parsedData?.rows?.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectionsGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing your data...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Recommendations
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Recommendations list — only unselected ones */}
          {unselectedSuggestions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                Recommendations
              </h3>
              <div className="grid gap-4">
                {unselectedSuggestions.map((selection) => {
                  const complexity = (selection.complexity as keyof typeof complexityColors) || 'Intermediate';

                  return (
                    <div
                      key={selection.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSelection(selection.analysis_type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSelection(selection.analysis_type);
                        }
                      }}
                      className="card-section text-left transition-all cursor-pointer hover:border-primary/30"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent text-primary">
                          {getAnalysisIcon(selection.analysis_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">
                              {selection.title || selection.analysis_type}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded ${complexityColors[complexity] || complexityColors.Intermediate}`}>
                              {complexity}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selection.description || "Statistical analysis method"}
                          </p>
                          {selection.reasoning && (
                            <div className="mt-2 p-2 bg-accent/50 rounded text-xs text-muted-foreground">
                              <span className="font-medium">Why this method: </span>
                              {selection.reasoning}
                            </div>
                          )}
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 border-input flex items-center justify-center flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Regenerate Button */}
          <div className="flex justify-center mb-6">
            <button
              onClick={handleGenerateSuggestions}
              disabled={selectionsGenerating || !parsedData?.rows?.length}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectionsGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate Recommendations
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Add Custom Analysis */}
      <div className="mb-6">
        {!showCustomForm ? (
          <button
            onClick={() => setShowCustomForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Custom Analysis
          </button>
        ) : (
          <div className="card-section">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-foreground">Custom Analysis</h4>
              <button onClick={() => { setShowCustomForm(false); setCustomMethod(''); setCustomParamMap({}); }}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Method dropdown */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-1">Analysis Method</label>
              <select
                value={customMethod}
                onChange={e => handleMethodChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select method...</option>
                {Object.entries(ANALYSIS_CATALOG).map(([key, entry]) => (
                  <option key={key} value={key}>{entry.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic param fields */}
            {catalogEntry && catalogEntry.params.map(param => {
              const filteredCols = param.type === 'any'
                ? availableColumns
                : param.type === 'numeric'
                  ? availableColumns // user selects; backend will validate
                  : availableColumns;

              return (
                <div key={param.key} className="mb-3">
                  <label className="block text-xs text-muted-foreground mb-1">
                    {param.label}
                    <span className="ml-1 text-[10px] text-muted-foreground/60">({param.type})</span>
                  </label>
                  <select
                    value={customParamMap[param.key] || ''}
                    onChange={e => setCustomParamMap(prev => ({ ...prev, [param.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select column...</option>
                    {filteredCols.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              );
            })}

            {catalogEntry && (
              <button
                onClick={handleAddCustomAnalysis}
                disabled={!catalogEntry.params.every(p => customParamMap[p.key])}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Analysis
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info about AI recommendations */}
      {hasSelections && (
        <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg mb-6">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            These methods were recommended based on your data structure, research question, and derived variables. You can regenerate recommendations if you've made changes to your analysis setup.
          </p>
        </div>
      )}

      {/* Action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedCount === 0
            ? "Select at least one analysis method to continue."
            : `${selectedCount} analysis method${selectedCount > 1 ? 's' : ''} ready`
          }
        </p>
        <button
          onClick={onContinue}
          disabled={selectedCount === 0}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run Analysis
        </button>
      </div>
    </div>
  );
};

export default ChooseAnalysisView;
