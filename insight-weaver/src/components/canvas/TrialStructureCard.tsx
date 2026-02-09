import { ChevronDown, Info, AlertCircle } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";

interface DropdownFieldProps {
  label: string;
  value: string;
  hint?: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const DropdownField = ({ label, value, hint, options, onChange, placeholder, disabled }: DropdownFieldProps) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && (
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {hint}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none px-3 py-2 bg-background border border-input rounded-md text-sm font-mono hover:border-ring transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              event_type == '{opt}'
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
};

interface TrialStructureCardProps {
  eventTypes: string[];
  trialsDetected: number;
}

const TrialStructureCard = ({ eventTypes, trialsDetected }: TrialStructureCardProps) => {
  const { trialStructure, updateTrialStructure } = useWorkflow();

  // Default event types if none provided
  const availableEvents = eventTypes.length > 0 
    ? eventTypes 
    : ['ons_ms1', 'stim_on', 'response', 'feedback'];

  const isNonTrial = trialsDetected === 0;

  // When no trials detected, use empty values
  const effectiveOnset = isNonTrial ? '' : (trialStructure?.trial_onset_event || 'ons_ms1');
  const effectiveResponse = isNonTrial ? '' : (trialStructure?.response_event || 'response');
  const effectiveOutcome = isNonTrial ? '' : (trialStructure?.outcome_event || 'feedback');

  return (
    <div className="card-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Trial Structure</h3>
        {!isNonTrial && (
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {trialsDetected} trials detected
          </span>
        )}
      </div>

      {isNonTrial ? (
        <div className="p-4 bg-accent/50 rounded-lg mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">No trials detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                This appears to be a non-trial experiment. You can skip trial structure configuration or manually select events below.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <DropdownField
          label="Trial starts at:"
          value={effectiveOnset}
          hint="Defines when a new trial begins"
          options={availableEvents}
          onChange={(value) => updateTrialStructure({ trial_onset_event: value })}
          placeholder={isNonTrial ? "Select event..." : undefined}
        />
        
        <DropdownField
          label="Response is defined as:"
          value={effectiveResponse}
          hint="Marks the participant's response event"
          options={availableEvents}
          onChange={(value) => updateTrialStructure({ response_event: value })}
          placeholder={isNonTrial ? "Select event..." : undefined}
        />
        
        <DropdownField
          label="Outcome occurs at:"
          value={effectiveOutcome}
          hint="When feedback or outcome is shown"
          options={availableEvents}
          onChange={(value) => updateTrialStructure({ outcome_event: value })}
          placeholder={isNonTrial ? "Select event..." : undefined}
        />
      </div>

      {/* Visual preview indicator */}
      {!isNonTrial && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[hsl(45_100%_85%)]" />
              <span>Trial onset rows highlighted above</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrialStructureCard;
