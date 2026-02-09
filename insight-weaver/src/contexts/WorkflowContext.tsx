import React, { createContext, useContext, ReactNode } from 'react';
import { useWorkflowSession, WorkflowSession } from '@/hooks/useWorkflowSession';
import { useMultiFileUpload, DatasetWithData } from '@/hooks/useMultiFileUpload';
import { useTrialStructure, TrialStructure } from '@/hooks/useTrialStructure';
import { useDerivedVariables, DerivedVariable } from '@/hooks/useDerivedVariables';
import { useAnalysisSelections, AnalysisSelection, SuggestedAnalysis } from '@/hooks/useAnalysisSelections';
import { useDataWrangling, WranglingConfig } from '@/hooks/useDataWrangling';

interface WorkflowContextType {
  // Session
  session: WorkflowSession | null;
  sessionLoading: boolean;
  currentStep: number;
  updateStep: (step: number) => Promise<void>;
  updateMetadata: (metadata: {
    research_question?: string;
    distribution_type?: string;
    has_outliers?: boolean;
    outlier_notes?: string;
  }) => Promise<void>;
  
  // Multi-file upload
  datasets: DatasetWithData[];
  activeDataset: DatasetWithData | null;
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
  uploading: boolean;
  uploadFile: (file: File) => Promise<void>;
  removeDataset: (datasetId: string) => Promise<void>;
  
  // Legacy single-file compatibility
  uploadedFile: DatasetWithData['file'] | null;
  parsedData: { columns: string[]; rows: Record<string, unknown>[]; rowCount: number } | null;
  allColumns: string[];
  
  // Trial structure
  trialStructure: TrialStructure | null;
  updateTrialStructure: (updates: Partial<TrialStructure>) => Promise<void>;
  countTrials: (data: Record<string, unknown>[], onsetEvent: string) => number;
  
  // Derived variables
  variables: DerivedVariable[];
  addVariable: (variable: { name: string; formula: string; formula_type?: string; description?: string }) => Promise<void>;
  toggleVariable: (variableId: string, isEnabled: boolean) => Promise<void>;
  deleteVariable: (variableId: string) => Promise<void>;
  
  // Analysis selections
  selections: AnalysisSelection[];
  selectionsLoading: boolean;
  selectionsGenerating: boolean;
  fetchSelections: () => Promise<void>;
  generateAnalysisSuggestions: (context: {
    columns: string[];
    sampleRows: Record<string, unknown>[];
    researchQuestion?: string;
    distributionType?: string;
    hasOutliers?: boolean;
    derivedVariables?: { name: string; formula?: string }[];
    trialsDetected?: number;
  }) => Promise<SuggestedAnalysis[]>;
  toggleSelection: (analysisType: string) => Promise<void>;
  updateSelectedColumns: (analysisType: string, columns: string[]) => Promise<void>;
  getSelectedAnalyses: () => string[];
  
  // Wrangling config
  wranglingConfig: WranglingConfig | null;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session, loading: sessionLoading, updateStep, updateMetadata } = useWorkflowSession();
  
  const { 
    datasets,
    activeDataset,
    activeDatasetId,
    setActiveDatasetId,
    uploading, 
    uploadFile,
    removeDataset,
    uploadedFile,
    parsedData,
    allColumns,
  } = useMultiFileUpload(session?.id);
  
  const { 
    trialStructure, 
    updateTrialStructure, 
    countTrials 
  } = useTrialStructure(session?.id);
  
  const { 
    variables, 
    addVariable, 
    toggleVariable, 
    deleteVariable 
  } = useDerivedVariables(session?.id);
  
  const { 
    selections, 
    loading: selectionsLoading,
    generating: selectionsGenerating,
    fetchSelections,
    generateSuggestions,
    toggleSelection, 
    getSelectedAnalyses,
    updateSelectedColumns
  } = useAnalysisSelections(session?.id);
  
  const { config: wranglingConfig } = useDataWrangling(session?.id);

  const value: WorkflowContextType = {
    session,
    sessionLoading,
    currentStep: session?.current_step || 1,
    updateStep,
    updateMetadata,
    datasets,
    activeDataset,
    activeDatasetId,
    setActiveDatasetId,
    uploading,
    uploadFile,
    removeDataset,
    uploadedFile,
    parsedData,
    allColumns,
    trialStructure,
    updateTrialStructure,
    countTrials,
    variables,
    addVariable,
    toggleVariable,
    deleteVariable,
    selections,
    selectionsLoading,
    selectionsGenerating,
    fetchSelections,
    generateAnalysisSuggestions: generateSuggestions,
    toggleSelection,
    updateSelectedColumns,
    getSelectedAnalyses,
    wranglingConfig,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};
