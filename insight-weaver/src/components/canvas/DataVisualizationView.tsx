import { useState, useMemo, useEffect } from "react";
import { LineChart, Sparkles, Plus, BarChart2, ScatterChart, TrendingUp, Loader2, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VisualizationCard from "./visualization/VisualizationCard";
import BackendVisualizationCard from "./visualization/BackendVisualizationCard";
import PlotTypeSelector from "./visualization/PlotTypeSelector";
import { llmService } from "@/services/llmService";
import { toast } from "sonner";
import { exportAsCSV, exportAsJSON, exportAsPDF } from "@/lib/exportUtils";
import { generateAnalysisResult } from "@/lib/generateAnalysisResult";

export interface VisualizationConfig {
  id: string;
  title: string;
  description: string;
  plotType: "histogram" | "scatter" | "line" | "bar" | "boxplot" | "density";
  columns: string[];
  isAISuggested?: boolean;
}

interface DataVisualizationViewProps {
  onContinue: () => void;
}

const DataVisualizationView = ({ onContinue }: DataVisualizationViewProps) => {
  const { parsedData, variables, session, uploadedFile, selections } = useWorkflow();
  const [visualizations, setVisualizations] = useState<VisualizationConfig[]>([]);
  const [showPlotSelector, setShowPlotSelector] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Get all columns from parsed data
  const allColumns = useMemo(() => {
    if (!parsedData?.columns) return [];
    return parsedData.columns;
  }, [parsedData]);

  // Get enabled derived variables
  const enabledVariables = useMemo(() => {
    return variables.filter(v => v.is_enabled);
  }, [variables]);

  // Combine all columns with derived variables
  const availableColumns = useMemo(() => {
    const derivedNames = enabledVariables.map(v => v.name);
    return [...allColumns, ...derivedNames];
  }, [allColumns, enabledVariables]);

  // Get numeric columns for AI suggestions
  const numericColumns = useMemo(() => {
    if (!parsedData?.rows?.length || !parsedData?.columns) return [];
    
    return parsedData.columns.filter(col => {
      const sampleValues = parsedData.rows.slice(0, 20).map(row => row[col]);
      return sampleValues.some(val => typeof val === 'number' || !isNaN(Number(val)));
    });
  }, [parsedData]);

  // AI-suggested visualizations based on data
  const [aiSuggestions, setAiSuggestions] = useState<VisualizationConfig[]>([]);

  // Generate AI suggestions when data is available
  useEffect(() => {
    const generateAISuggestions = async () => {
      if (availableColumns.length === 0 || loadingSuggestions) return;

      setLoadingSuggestions(true);
      try {
        const suggestions = await llmService.suggestVisualizations({
          columns: availableColumns,
          researchQuestion: session?.research_question,
          distributionType: session?.distribution_type,
          hasOutliers: session?.has_outliers,
          datasetReference: uploadedFile?.storage_path,
        });

        // Convert to VisualizationConfig format
        const vizConfigs: VisualizationConfig[] = suggestions.map((sug, index) => ({
          id: `ai-${sug.plot_type}-${index}`,
          title: sug.title,
          description: sug.description,
          plotType: sug.plot_type as any,
          columns: sug.columns,
          isAISuggested: true,
        }));

        setAiSuggestions(vizConfigs);
        toast.success(`Generated ${vizConfigs.length} visualization suggestions`);
      } catch (error) {
        console.error('Failed to generate AI suggestions:', error);
        toast.error('Failed to generate visualization suggestions');
      } finally {
        setLoadingSuggestions(false);
      }
    };

    generateAISuggestions();
  }, [availableColumns, session, uploadedFile]);

  const handleAddVisualization = (config: Omit<VisualizationConfig, 'id'>) => {
    const newViz: VisualizationConfig = {
      ...config,
      id: `custom-${Date.now()}`,
    };
    setVisualizations(prev => [...prev, newViz]);
    setShowPlotSelector(false);
  };

  const handleRemoveVisualization = (id: string) => {
    setVisualizations(prev => prev.filter(v => v.id !== id));
  };

  const handleAddSuggestion = (suggestion: VisualizationConfig) => {
    if (!visualizations.find(v => v.id === suggestion.id)) {
      setVisualizations(prev => [...prev, suggestion]);
    }
  };

  const allVisualizations = [...visualizations];

  // Generate analysis results from selected analyses (similar to ResultsView)
  const selectedAnalyses = selections.filter(s => s.is_selected);
  const analysisResults = useMemo(() => {
    if (!parsedData?.rows?.length || selectedAnalyses.length === 0) return [];

    return selectedAnalyses.map(analysis => {
      const analysisColumns = analysis.selected_columns || [];

      const numericData: Record<string, number[]> = {};
      analysisColumns.forEach(col => {
        const values = parsedData.rows
          .map(row => Number(row[col]))
          .filter(v => !isNaN(v));
        if (values.length > 0) {
          numericData[col] = values;
        }
      });

      return generateAnalysisResult(
        {
          analysis_type: analysis.analysis_type,
          title: analysis.title || analysis.analysis_type,
          description: analysis.description || '',
        },
        numericData,
        analysisColumns
      );
    });
  }, [selectedAnalyses, parsedData]);

  // Get all columns used in analyses
  const allAnalysisColumns = useMemo(() => {
    const columnsSet = new Set<string>();
    selectedAnalyses.forEach(analysis => {
      (analysis.selected_columns || []).forEach(col => columnsSet.add(col));
    });
    return Array.from(columnsSet);
  }, [selectedAnalyses]);

  // Export handlers
  const handleExportPDF = () => {
    const datasetPreview = parsedData ? {
      columns: parsedData.columns,
      rows: parsedData.rows
    } : undefined;

    const derivedVariables = variables.filter(v => v.is_enabled).map(v => ({
      name: v.name,
      formula: v.formula,
      formula_type: v.formula_type || 'eval',
      description: v.description
    }));

    exportAsPDF(analysisResults, allAnalysisColumns, {
      datasetPreview,
      derivedVariables,
      visualizations: allVisualizations
    });
  };

  const handleExportCSV = () => {
    if (analysisResults.length === 0) {
      toast.error("No analysis results to export");
      return;
    }
    exportAsCSV(analysisResults, allAnalysisColumns);
  };

  const handleExportJSON = () => {
    if (analysisResults.length === 0) {
      toast.error("No analysis results to export");
      return;
    }
    exportAsJSON(analysisResults, allAnalysisColumns, {
      researchQuestion: session?.research_question,
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <LineChart className="w-5 h-5" />
          <span className="text-sm font-medium">Step 7 of 7</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Data Visualization</h2>
        <p className="text-muted-foreground mt-1">
          Design publication-ready visualizations based on your analysis results.
        </p>
      </div>

      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="suggestions" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Suggestions
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <Plus className="w-4 h-4" />
            Custom Plots
          </TabsTrigger>
        </TabsList>

        {/* AI Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          {availableColumns.length === 0 ? (
            <div className="card-section text-center py-8">
              <p className="text-muted-foreground">No columns available. Upload data to get visualization suggestions.</p>
            </div>
          ) : loadingSuggestions ? (
            <div className="card-section text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Generating AI visualization suggestions...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Based on your data and research question, we recommend these visualizations. Click to add them to your analysis.
              </p>
              {aiSuggestions.length === 0 ? (
                <div className="card-section text-center py-8">
                  <p className="text-muted-foreground">No AI suggestions available yet.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {aiSuggestions.map(suggestion => {
                    const isAdded = visualizations.find(v => v.id === suggestion.id);
                    return (
                      <div
                        key={suggestion.id}
                        className={`card-section cursor-pointer transition-all hover:border-primary/50 ${
                          isAdded ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => !isAdded && handleAddSuggestion(suggestion)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {(suggestion.plotType === 'histogram' || suggestion.plotType === 'bar' || suggestion.plotType === 'count') && <BarChart2 className="w-5 h-5 text-primary" />}
                            {suggestion.plotType === 'scatter' && <ScatterChart className="w-5 h-5 text-primary" />}
                            {(suggestion.plotType === 'boxplot' || suggestion.plotType === 'box' || suggestion.plotType === 'violin') && <TrendingUp className="w-5 h-5 text-primary" />}
                            {suggestion.plotType === 'line' && <LineChart className="w-5 h-5 text-primary" />}
                            {(suggestion.plotType === 'density' || suggestion.plotType === 'heatmap' || suggestion.plotType === 'correlation') && <TrendingUp className="w-5 h-5 text-primary" />}
                            {(suggestion.plotType === 'pairplot' || suggestion.plotType === 'strip' || suggestion.plotType === 'swarm') && <ScatterChart className="w-5 h-5 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-foreground truncate">{suggestion.title}</h4>
                              <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.columns.map(col => (
                                <span key={col} className="px-2 py-0.5 text-xs bg-secondary rounded">
                                  {col}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {isAdded && (
                          <div className="mt-3 text-xs text-primary font-medium">✓ Added to visualizations</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Custom Plots Tab */}
        <TabsContent value="custom" className="space-y-4">
          {!showPlotSelector ? (
            <button
              onClick={() => setShowPlotSelector(true)}
              className="w-full card-section border-dashed hover:border-primary/50 transition-colors flex items-center justify-center gap-2 py-8"
            >
              <Plus className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">Add Custom Visualization</span>
            </button>
          ) : (
            <PlotTypeSelector
              columns={availableColumns}
              derivedVariableNames={enabledVariables.map(v => v.name)}
              onAdd={handleAddVisualization}
              onCancel={() => setShowPlotSelector(false)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Active Visualizations */}
      {allVisualizations.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            Your Visualizations ({allVisualizations.length})
          </h3>
          <div className="space-y-6">
            {allVisualizations.map(viz => (
              <BackendVisualizationCard
                key={viz.id}
                config={viz}
                onRemove={() => handleRemoveVisualization(viz.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="mt-8 p-6 bg-card border border-border rounded-lg">
        <h3 className="text-base font-semibold text-foreground mb-3">Export Report</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download a comprehensive report including your dataset, derived variables, analysis results, and visualizations.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportPDF}
            disabled={analysisResults.length === 0 && allVisualizations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download Report (PDF)
          </button>
          <button
            onClick={handleExportCSV}
            disabled={analysisResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Results as CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={analysisResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileJson className="w-4 h-4" />
            Export Results as JSON
          </button>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex items-center justify-end mt-8">
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Finish Workflow
        </button>
      </div>
    </div>
  );
};

export default DataVisualizationView;
