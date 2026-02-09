import { useEffect, useMemo } from "react";
import { FileText, Eye } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import DataTable from "./DataTable";
import TrialStructureCard from "./TrialStructureCard";

interface ParseEventsViewProps {
  onContinue: () => void;
}

const ParseEventsView = ({ onContinue }: ParseEventsViewProps) => {
  const { parsedData, trialStructure, countTrials } = useWorkflow();

  // Count trials when data or onset event changes
  useEffect(() => {
    if (parsedData?.rows && trialStructure?.trial_onset_event) {
      countTrials(parsedData.rows, trialStructure.trial_onset_event);
    }
  }, [parsedData?.rows, trialStructure?.trial_onset_event, countTrials]);

  // Get unique event types from data
  const eventTypes = useMemo(() => {
    if (!parsedData?.rows) return [];
    const types = new Set<string>();
    parsedData.rows.forEach(row => {
      if (row.event_type) types.add(String(row.event_type));
    });
    return Array.from(types);
  }, [parsedData?.rows]);

  const displayData = parsedData?.rows.slice(0, 10) || [];
  const totalRows = parsedData?.rowCount || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <FileText className="w-5 h-5" />
          <span className="text-sm font-medium">Step 2 of 6</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Parse Events</h2>
        <p className="text-muted-foreground mt-1">
          Define how your event log is structured into trials, responses, and outcomes.
        </p>
      </div>

      {/* Data Preview Section */}
      <div className="card-section mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Event Log Preview</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(10, totalRows)} of {totalRows} events
          </span>
        </div>
        <DataTable 
          data={displayData} 
          columns={parsedData?.columns || []}
          highlightEvent={trialStructure?.trial_onset_event}
        />
      </div>

      {/* Trial Structure Configuration */}
      <TrialStructureCard 
        eventTypes={eventTypes}
        trialsDetected={trialStructure?.trials_detected || 0}
      />

      {/* Action hint */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The AI assistant can help refine these definitions based on your data patterns.
        </p>
        <button 
          onClick={onContinue}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Continue to Variables
        </button>
      </div>
    </div>
  );
};

export default ParseEventsView;
