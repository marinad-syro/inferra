import { useState, useEffect } from "react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import AppLayout from "@/components/layout/AppLayout";
import WorkflowSidebar from "@/components/workflow/WorkflowSidebar";
import CanvasNavigator from "@/components/canvas/CanvasNavigator";
import UploadDataView from "@/components/canvas/UploadDataView";
import DataWranglingView from "@/components/canvas/DataWranglingView";
import ParseEventsView from "@/components/canvas/ParseEventsView";
import CreateVariablesView from "@/components/canvas/CreateVariablesView";
import ChooseAnalysisView from "@/components/canvas/ChooseAnalysisView";
import DataVisualizationView from "@/components/canvas/DataVisualizationView";
import CodeCanvasView from "@/components/canvas/CodeCanvasView";
import ResultsView from "@/components/canvas/ResultsView";

const Index = () => {
  const { currentStep, updateStep, sessionLoading } = useWorkflow();
  const [canvasMode, setCanvasMode] = useState<'ui' | 'code'>('ui');
  const [codeRefreshTrigger, setCodeRefreshTrigger] = useState(0);

  // Trigger code refresh when switching to code canvas mode
  useEffect(() => {
    if (canvasMode === 'code') {
      setCodeRefreshTrigger(prev => prev + 1);
    }
  }, [canvasMode]);

  const handleStepChange = (step: number) => {
    updateStep(step);
  };

  const renderMainContent = () => {
    // If in code mode, always show CodeCanvasView
    if (canvasMode === 'code') {
      return <CodeCanvasView onContinue={() => setCanvasMode('ui')} refreshTrigger={codeRefreshTrigger} />;
    }

    // Otherwise show the current workflow step
    switch (currentStep) {
      case 1:
        return <UploadDataView onContinue={() => handleStepChange(2)} />;
      case 2:
        return <DataWranglingView onContinue={() => handleStepChange(3)} />;
      case 3:
        return <ParseEventsView onContinue={() => handleStepChange(4)} />;
      case 4:
        return <CreateVariablesView onContinue={() => handleStepChange(5)} />;
      case 5:
        return <ChooseAnalysisView onContinue={() => handleStepChange(6)} />;
      case 6:
        return <ResultsView />;
      case 7:
        return <DataVisualizationView onContinue={() => handleStepChange(6)} />;
      default:
        return <UploadDataView onContinue={() => handleStepChange(2)} />;
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      topBar={
        <CanvasNavigator
          mode={canvasMode}
          onModeChange={setCanvasMode}
        />
      }
      leftSidebar={
        <WorkflowSidebar
          currentStep={currentStep}
          onStepChange={handleStepChange}
        />
      }
      mainContent={renderMainContent()}
    />
  );
};

export default Index;
