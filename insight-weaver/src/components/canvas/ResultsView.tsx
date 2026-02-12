import { useState, useMemo, useCallback, useEffect } from "react";
import { PieChart, RefreshCw, ArrowLeft, Code, Loader2, LineChart } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { generateAnalysisResult } from "@/lib/generateAnalysisResult";
import AnalysisResultCard from "./results/AnalysisResultCard";
import CodeSummaryView from "./CodeSummaryView";
import { llmService } from "@/services/llmService";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

/**
 * Transform backend analysis results into frontend format
 */
function transformAnalysisResult(
  title: string,
  description: string,
  analysisType: string,
  results: Record<string, any>,
  decision?: any
) {
  const parameters: { name: string; value: string; interpretation?: string }[] = [];
  const metrics: { name: string; value: string; highlight?: boolean }[] = [];

  // Extract parameters and metrics based on analysis type
  if (analysisType.includes('t_test') || analysisType.includes('t-test')) {
    // T-test results
    if (results.group1 !== undefined) {
      parameters.push({
        name: "Group 1",
        value: `${results.group1} (n=${results.group1_n})`,
        interpretation: `Mean: ${results.group1_mean?.toFixed(3)}`
      });
    }
    if (results.group2 !== undefined) {
      parameters.push({
        name: "Group 2",
        value: `${results.group2} (n=${results.group2_n})`,
        interpretation: `Mean: ${results.group2_mean?.toFixed(3)}`
      });
    }

    if (results.t_statistic !== undefined) {
      metrics.push({
        name: "t-statistic",
        value: results.t_statistic.toFixed(4),
        highlight: false
      });
    }
    if (results.p_value !== undefined) {
      metrics.push({
        name: "p-value",
        value: results.p_value.toFixed(4),
        highlight: results.p_value < 0.05
      });
    }
  } else if (analysisType.includes('mann') || analysisType.includes('wilcoxon') || analysisType.includes('kruskal')) {
    // Non-parametric tests
    if (results.group1 !== undefined) {
      parameters.push({
        name: "Group 1",
        value: `${results.group1} (n=${results.group1_n})`,
        interpretation: results.group1_median !== undefined ? `Median: ${results.group1_median?.toFixed(3)}` : undefined
      });
    }
    if (results.group2 !== undefined) {
      parameters.push({
        name: "Group 2",
        value: `${results.group2} (n=${results.group2_n})`,
        interpretation: results.group2_median !== undefined ? `Median: ${results.group2_median?.toFixed(3)}` : undefined
      });
    }
    if (results.num_groups !== undefined) {
      parameters.push({ name: "Number of Groups", value: results.num_groups.toString() });
    }

    const statKey = results.u_statistic !== undefined ? 'u_statistic' : results.h_statistic !== undefined ? 'h_statistic' : 'w_statistic';
    const statName = results.u_statistic !== undefined ? 'U-statistic' : results.h_statistic !== undefined ? 'H-statistic' : 'W-statistic';
    if (results[statKey] !== undefined) {
      metrics.push({ name: statName, value: results[statKey].toFixed(4), highlight: false });
    }
    if (results.p_value !== undefined) {
      metrics.push({ name: "p-value", value: results.p_value.toFixed(4), highlight: results.p_value < 0.05 });
    }
  } else if (analysisType.includes('correlation')) {
    // Correlation results
    if (results.correlation !== undefined) {
      metrics.push({
        name: "Correlation",
        value: results.correlation.toFixed(4),
        highlight: Math.abs(results.correlation) > 0.5
      });
    }
    if (results.p_value !== undefined) {
      metrics.push({
        name: "p-value",
        value: results.p_value.toFixed(4),
        highlight: results.p_value < 0.05
      });
    }
    if (results.n !== undefined) {
      parameters.push({
        name: "Sample Size",
        value: results.n.toString()
      });
    }
  } else if (analysisType.includes('anova')) {
    // ANOVA results
    if (results.f_statistic !== undefined) {
      metrics.push({
        name: "F-statistic",
        value: results.f_statistic.toFixed(4),
        highlight: false
      });
    }
    if (results.p_value !== undefined) {
      metrics.push({
        name: "p-value",
        value: results.p_value.toFixed(4),
        highlight: results.p_value < 0.05
      });
    }
    if (results.num_groups !== undefined) {
      parameters.push({
        name: "Number of Groups",
        value: results.num_groups.toString()
      });
    }
  } else if (analysisType.includes('chi')) {
    // Chi-square results
    if (results.chi2_statistic !== undefined) {
      metrics.push({
        name: "χ² statistic",
        value: results.chi2_statistic.toFixed(4),
        highlight: false
      });
    }
    if (results.p_value !== undefined) {
      metrics.push({
        name: "p-value",
        value: results.p_value.toFixed(4),
        highlight: results.p_value < 0.05
      });
    }
    if (results.degrees_of_freedom !== undefined) {
      parameters.push({
        name: "Degrees of Freedom",
        value: results.degrees_of_freedom.toString()
      });
    }
  } else {
    // Generic handling for unknown analysis types
    // Put everything with numeric values in metrics
    Object.entries(results).forEach(([key, value]) => {
      if (typeof value === 'number') {
        const isSignificant = key.includes('p_value') || key.includes('p-value')
          ? value < 0.05
          : false;

        metrics.push({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: value.toFixed(4),
          highlight: isSignificant
        });
      } else if (typeof value === 'string' || typeof value === 'boolean') {
        parameters.push({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: String(value)
        });
      }
    });
  }

  return {
    title,
    description,
    analysisType,
    parameters,
    metrics,
    decision,
    rawResults: results // Keep raw results for debugging
  };
}

const ResultsView = () => {
  const { selections, parsedData, trialStructure, updateStep, session, uploadedFile } = useWorkflow();
  const [showCodeView, setShowCodeView] = useState(false);
  const [running, setRunning] = useState(false);
  const [backendResults, setBackendResults] = useState<any[]>([]);
  const [hasAutoRun, setHasAutoRun] = useState(false);

  // Get selected analyses directly from the selections array
  const selectedAnalyses = selections.filter(s => s.is_selected);
  const trialCount = trialStructure?.trials_detected || parsedData?.rowCount || 0;

  // Get all unique selected columns across all analyses
  const allSelectedColumns = useMemo(() => {
    const columnsSet = new Set<string>();
    selectedAnalyses.forEach(a => {
      a.selected_columns?.forEach(col => columnsSet.add(col));
    });
    return Array.from(columnsSet);
  }, [selectedAnalyses]);

  // Generate results for each selected analysis
  const results = useMemo(() => {
    if (!parsedData?.rows?.length) return [];

    return selectedAnalyses.map(analysis => {
      // Get the columns selected for this specific analysis
      const analysisColumns = analysis.selected_columns || [];
      
      // Build numeric data only for the selected columns
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
          title: analysis.title,
          description: analysis.description,
        },
        numericData,
        analysisColumns
      );
    });
  }, [selectedAnalyses, parsedData]);

  // Request AI interpretation for a result
  const handleRequestInterpretation = useCallback(async (result: typeof results[0]) => {
    // Call FastAPI backend for result interpretation
    const interpretation = await llmService.interpretResults({
      result,
      researchContext: {
        researchQuestion: session?.research_question,
        distributionType: session?.distribution_type,
        hasOutliers: session?.has_outliers,
      },
    });

    return interpretation;
  }, [session]);


  // Run analyses using backend
  const handleRunAnalyses = useCallback(async () => {
    if (!uploadedFile?.storage_path) {
      toast.error("No dataset available to analyze");
      return;
    }

    if (selectedAnalyses.length === 0) {
      toast.error("No analyses selected");
      return;
    }

    setRunning(true);
    setBackendResults([]);

    const datasetRef = uploadedFile.storage_path;

    // Run all analyses in parallel so neither blocks the other
    const analysisPromises = selectedAnalyses.map(analysis => {
      const runParams = analysis.execution_spec
        ? { dataset_reference: datasetRef, execution_spec: analysis.execution_spec }
        : { dataset_reference: datasetRef, prompt: `Perform ${analysis.analysis_type} analysis on columns: ${analysis.selected_columns?.join(', ')}` };

      return apiClient.runAnalysis(runParams).then(result => ({
        status: 'fulfilled' as const,
        analysis,
        result,
      })).catch(error => ({
        status: 'rejected' as const,
        analysis,
        error,
      }));
    });

    const settled = await Promise.all(analysisPromises);

    const analysisResults: any[] = [];
    let failCount = 0;

    settled.forEach(outcome => {
      if (outcome.status === 'fulfilled') {
        const transformed = transformAnalysisResult(
          outcome.analysis.title,
          outcome.analysis.description || '',
          outcome.analysis.analysis_type,
          outcome.result.results,
          outcome.result.decision
        );
        analysisResults.push(transformed);
      } else {
        failCount++;
        const msg = outcome.error?.message || 'Unknown error';
        console.error(`Failed to run ${outcome.analysis.title}:`, outcome.error);
        toast.error(`${outcome.analysis.title} failed: ${msg}`);
      }
    });

    setBackendResults(analysisResults);
    if (analysisResults.length > 0) {
      toast.success(`Completed ${analysisResults.length} of ${selectedAnalyses.length} ${selectedAnalyses.length === 1 ? 'analysis' : 'analyses'}`);
    }
    setRunning(false);
  }, [selectedAnalyses, uploadedFile]);

  // Auto-run when landing on the Results tab
  useEffect(() => {
    if (!hasAutoRun && selectedAnalyses.length > 0 && uploadedFile?.storage_path && !running) {
      setHasAutoRun(true);
      handleRunAnalyses();
    }
  }, [hasAutoRun, selectedAnalyses.length, uploadedFile?.storage_path]);

  // Show code view if requested
  if (showCodeView) {
    return <CodeSummaryView onBack={() => setShowCodeView(false)} />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <PieChart className="w-5 h-5" />
          <span className="text-sm font-medium">Step 6 of 7</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Results</h2>
            <p className="text-muted-foreground mt-1">
              Statistical results from your selected analyses.
            </p>
          </div>
          {selectedAnalyses.length > 0 && (
            <button
              onClick={handleRunAnalyses}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Rerun
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Data Summary */}
      <div className="card-section mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Data Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-accent/50 rounded-lg">
            <div className="text-lg font-semibold text-foreground">{trialCount}</div>
            <div className="text-xs text-muted-foreground">Trials Analyzed</div>
          </div>
          <div className="p-3 bg-accent/50 rounded-lg">
            <div className="text-lg font-semibold text-foreground">{selectedAnalyses.length}</div>
            <div className="text-xs text-muted-foreground">Models Fitted</div>
          </div>
          <div className="p-3 bg-accent/50 rounded-lg">
            <div className="text-lg font-semibold text-foreground">{allSelectedColumns.length}</div>
            <div className="text-xs text-muted-foreground">Variables Used</div>
          </div>
        </div>
      </div>

      {/* Columns Used */}
      {allSelectedColumns.length > 0 && (
        <div className="card-section mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Columns in Analysis</h3>
          <div className="flex flex-wrap gap-2">
            {allSelectedColumns.map(col => (
              <span
                key={col}
                className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {running && (
        <div className="card-section mb-6 border-primary/20">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Running {selectedAnalyses.length} {selectedAnalyses.length === 1 ? 'analysis' : 'analyses'}...
          </div>
        </div>
      )}

      {/* Results for each analysis */}
      {(backendResults.length > 0 ? backendResults : results).length > 0 ? (
        (backendResults.length > 0 ? backendResults : results).map((result, index) => (
          <AnalysisResultCard
            key={`${result.analysisType}-${index}`}
            result={result}
            onRequestInterpretation={handleRequestInterpretation}
          />
        ))
      ) : (
        <div className="card-section mb-6 text-center py-8">
          <p className="text-muted-foreground">No analyses selected. Go back to select analysis methods.</p>
          <button
            onClick={() => updateStep(5)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Choose Analysis
          </button>
        </div>
      )}

      {/* Actions */}
      {(backendResults.length > 0 || results.length > 0) && (
        <div className="card-section">
          <h3 className="text-base font-semibold text-foreground mb-4">Next Steps</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Continue to the visualization step to create charts and export your complete report.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => updateStep(7)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <LineChart className="w-4 h-4" />
              Create Visualizations & Export
            </button>
            <button
              onClick={() => setShowCodeView(true)}
              className="flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors"
            >
              <Code className="w-4 h-4" />
              View Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsView;
