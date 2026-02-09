import { useState } from "react";
import { Code, Copy, Check, Download, ArrowLeft, FileCode2, Terminal } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface CodeSummaryViewProps {
  onBack: () => void;
}

const CodeSummaryView = ({ onBack }: CodeSummaryViewProps) => {
  const { parsedData, trialStructure, variables, selections, wranglingConfig } = useWorkflow();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const enabledVariables = variables.filter(v => v.is_enabled);
  const selectedAnalyses = selections.filter(s => s.is_selected);

  // Generate Python-equivalent code
  const generatePythonCode = () => {
    let code = `# BehaviorLab Analysis Pipeline
# Generated code for reproducibility

import pandas as pd
import numpy as np
from scipy import stats

# ============================================
# 1. DATA LOADING
# ============================================
`;

    if (parsedData) {
      code += `
# Load your dataset
df = pd.read_csv("your_data.csv")
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
`;
    }

    // Wrangling/cleaning
    if (wranglingConfig) {
      code += `
# ============================================
# 2. DATA WRANGLING & CLEANING
# ============================================
`;
      if (wranglingConfig.missing_data_strategy) {
        const strategy = wranglingConfig.missing_data_strategy as { method?: string };
        code += `
# Missing data handling
`;
        if (strategy.method === 'drop') {
          code += `df = df.dropna()`;
        } else if (strategy.method === 'mean') {
          code += `df = df.fillna(df.mean(numeric_only=True))`;
        } else if (strategy.method === 'median') {
          code += `df = df.fillna(df.median(numeric_only=True))`;
        } else {
          code += `# Strategy: ${JSON.stringify(strategy)}`;
        }
        code += '\n';
      }

      if (wranglingConfig.critical_variables?.length) {
        code += `
# Critical variables for analysis
critical_vars = ${JSON.stringify(wranglingConfig.critical_variables)}
df = df.dropna(subset=critical_vars)
`;
      }
    }

    // Trial structure
    if (trialStructure && trialStructure.trials_detected > 0) {
      code += `
# ============================================
# 3. TRIAL STRUCTURE PARSING
# ============================================

trial_onset_event = "${trialStructure.trial_onset_event}"
response_event = "${trialStructure.response_event}"
outcome_event = "${trialStructure.outcome_event}"
trials_detected = ${trialStructure.trials_detected}

# Filter to trial-relevant events
trial_data = df[df['event_type'].isin([trial_onset_event, response_event, outcome_event])]
`;
    }

    // Derived variables
    if (enabledVariables.length > 0) {
      code += `
# ============================================
# 4. DERIVED VARIABLES
# ============================================
`;
      enabledVariables.forEach(v => {
        code += `
# ${v.name}: ${v.description || 'No description'}
df['${v.name}'] = ${v.formula}
`;
      });
    }

    // Analyses
    if (selectedAnalyses.length > 0) {
      code += `
# ============================================
# 5. STATISTICAL ANALYSES
# ============================================
`;
      selectedAnalyses.forEach(analysis => {
        const cols = analysis.selected_columns || [];
        code += `
# ${analysis.title}
# ${analysis.description || ''}
`;
        switch (analysis.analysis_type) {
          case 'descriptive':
            code += `print(df[${JSON.stringify(cols)}].describe())
`;
            break;
          case 't_test':
            if (cols.length >= 2) {
              code += `t_stat, p_value = stats.ttest_ind(df['${cols[0]}'].dropna(), df['${cols[1]}'].dropna())
print(f"T-test: t={t_stat:.4f}, p={p_value:.4f}")
`;
            }
            break;
          case 'anova':
            code += `# One-way ANOVA
groups = [df[df['group'] == g]['${cols[0]}'].dropna() for g in df['group'].unique()]
f_stat, p_value = stats.f_oneway(*groups)
print(f"ANOVA: F={f_stat:.4f}, p={p_value:.4f}")
`;
            break;
          case 'correlation':
            if (cols.length >= 2) {
              code += `corr, p_value = stats.pearsonr(df['${cols[0]}'].dropna(), df['${cols[1]}'].dropna())
print(f"Correlation: r={corr:.4f}, p={p_value:.4f}")
`;
            }
            break;
          case 'regression':
            code += `from sklearn.linear_model import LinearRegression
X = df[${JSON.stringify(cols.slice(1))}].dropna()
y = df['${cols[0]}'].dropna()
model = LinearRegression().fit(X, y)
print(f"R²={model.score(X, y):.4f}")
`;
            break;
          default:
            code += `# Analysis: ${analysis.analysis_type}
# Columns: ${cols.join(', ')}
`;
        }
      });
    }

    code += `
# ============================================
# 6. EXPORT RESULTS
# ============================================

# Save processed data
df.to_csv("processed_data.csv", index=False)

# Save analysis results
# results.to_csv("analysis_results.csv", index=False)

print("Analysis pipeline complete!")
`;

    return code;
  };

  // Generate R-equivalent code
  const generateRCode = () => {
    let code = `# BehaviorLab Analysis Pipeline
# Generated R code for reproducibility

library(tidyverse)
library(stats)

# ============================================
# 1. DATA LOADING
# ============================================
`;

    if (parsedData) {
      code += `
# Load your dataset
df <- read_csv("your_data.csv")
cat(sprintf("Loaded %d rows, %d columns\\n", nrow(df), ncol(df)))
`;
    }

    // Wrangling
    if (wranglingConfig) {
      code += `
# ============================================
# 2. DATA WRANGLING & CLEANING
# ============================================
`;
      if (wranglingConfig.missing_data_strategy) {
        const strategy = wranglingConfig.missing_data_strategy as { method?: string };
        if (strategy.method === 'drop') {
          code += `df <- df %>% drop_na()`;
        } else if (strategy.method === 'mean') {
          code += `df <- df %>% mutate(across(where(is.numeric), ~replace_na(., mean(., na.rm = TRUE))))`;
        }
        code += '\n';
      }
    }

    // Derived variables
    if (enabledVariables.length > 0) {
      code += `
# ============================================
# 3. DERIVED VARIABLES
# ============================================
`;
      enabledVariables.forEach(v => {
        code += `
# ${v.name}: ${v.description || 'No description'}
df <- df %>% mutate(${v.name} = ${v.formula})
`;
      });
    }

    // Analyses
    if (selectedAnalyses.length > 0) {
      code += `
# ============================================
# 4. STATISTICAL ANALYSES
# ============================================
`;
      selectedAnalyses.forEach(analysis => {
        const cols = analysis.selected_columns || [];
        code += `
# ${analysis.title}
`;
        switch (analysis.analysis_type) {
          case 'descriptive':
            code += `summary(df %>% select(${cols.map(c => `\`${c}\``).join(', ')}))
`;
            break;
          case 't_test':
            if (cols.length >= 2) {
              code += `t.test(df$\`${cols[0]}\`, df$\`${cols[1]}\`)
`;
            }
            break;
          case 'correlation':
            if (cols.length >= 2) {
              code += `cor.test(df$\`${cols[0]}\`, df$\`${cols[1]}\`)
`;
            }
            break;
          default:
            code += `# Analysis: ${analysis.analysis_type}
`;
        }
      });
    }

    return code;
  };

  const handleCopy = async (code: string, section: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedSection(section);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleExportCode = (language: 'python' | 'r') => {
    const code = language === 'python' ? generatePythonCode() : generateRCode();
    const ext = language === 'python' ? 'py' : 'R';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behaviorlab_analysis.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${language === 'python' ? 'Python' : 'R'} code exported`);
  };

  const pythonCode = generatePythonCode();
  const rCode = generateRCode();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Results
        </button>
        <div className="flex items-center gap-2 text-primary mb-1">
          <Code className="w-5 h-5" />
          <span className="text-sm font-medium">Code Export</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Analysis Code</h2>
        <p className="text-muted-foreground mt-1">
          Reproducible code generated from your workflow. Export for use in Python or R.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card-section text-center">
          <div className="text-lg font-semibold text-foreground">{parsedData?.columns?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Columns</div>
        </div>
        <div className="card-section text-center">
          <div className="text-lg font-semibold text-foreground">{enabledVariables.length}</div>
          <div className="text-xs text-muted-foreground">Variables</div>
        </div>
        <div className="card-section text-center">
          <div className="text-lg font-semibold text-foreground">{selectedAnalyses.length}</div>
          <div className="text-xs text-muted-foreground">Analyses</div>
        </div>
        <div className="card-section text-center">
          <div className="text-lg font-semibold text-foreground">{trialStructure?.trials_detected || 0}</div>
          <div className="text-xs text-muted-foreground">Trials</div>
        </div>
      </div>

      {/* Code Tabs */}
      <Tabs defaultValue="python" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="python" className="gap-2">
              <Terminal className="w-4 h-4" />
              Python
            </TabsTrigger>
            <TabsTrigger value="r" className="gap-2">
              <FileCode2 className="w-4 h-4" />
              R
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportCode('python')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Python
            </button>
            <button
              onClick={() => handleExportCode('r')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
              Export R
            </button>
          </div>
        </div>

        <TabsContent value="python">
          <div className="card-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Python Code</h3>
              <button
                onClick={() => handleCopy(pythonCode, 'python')}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedSection === 'python' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto text-sm font-mono text-foreground max-h-[600px] overflow-y-auto">
              {pythonCode}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="r">
          <div className="card-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">R Code</h3>
              <button
                onClick={() => handleCopy(rCode, 'r')}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedSection === 'r' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto text-sm font-mono text-foreground max-h-[600px] overflow-y-auto">
              {rCode}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeSummaryView;
