import {
  Upload,
  FileText,
  Variable,
  BarChart3,
  PieChart,
  Check,
  Wrench,
  LineChart
} from "lucide-react";

interface WorkflowStep {
  id: number;
  label: string;
  icon: React.ReactNode;
}

const steps: WorkflowStep[] = [
  { id: 1, label: "Upload Data", icon: <Upload className="w-4 h-4" /> },
  { id: 2, label: "Wrangling & Cleaning", icon: <Wrench className="w-4 h-4" /> },
  { id: 3, label: "Parse Events", icon: <FileText className="w-4 h-4" /> },
  { id: 4, label: "Create Variables", icon: <Variable className="w-4 h-4" /> },
  { id: 5, label: "Choose Analysis", icon: <BarChart3 className="w-4 h-4" /> },
  { id: 6, label: "Results", icon: <PieChart className="w-4 h-4" /> },
  { id: 7, label: "Visualizations", icon: <LineChart className="w-4 h-4" /> },
];

interface WorkflowSidebarProps {
  currentStep: number;
  onStepChange: (step: number) => void;
}

const WorkflowSidebar = ({ currentStep, onStepChange }: WorkflowSidebarProps) => {
  const getStepStatus = (stepId: number): "complete" | "active" | "pending" => {
    if (stepId < currentStep) return "complete";
    if (stepId === currentStep) return "active";
    return "pending";
  };
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Inferra</h1>
        <p className="text-xs text-muted-foreground mt-0.5">AI-Assisted Data Analysis</p>
      </div>

      {/* Workflow Steps */}
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Workflow
        </p>
        <ul className="space-y-1">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            return (
              <li key={step.id}>
                <button
                  onClick={() => onStepChange(step.id)}
                  className={`w-full workflow-step ${
                    status === "active"
                      ? "workflow-step-active"
                      : status === "complete"
                      ? "workflow-step-complete"
                      : "workflow-step-pending"
                  }`}
                >
                  {/* Step number or check */}
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
                      status === "complete"
                        ? "bg-success text-success-foreground"
                        : status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {status === "complete" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      step.id
                    )}
                  </span>

                  {/* Icon and label */}
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    {step.icon}
                    <span className="truncate text-sm">{step.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>Session active</span>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSidebar;
