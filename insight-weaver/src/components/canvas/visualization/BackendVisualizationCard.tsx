import { useState, useEffect } from "react";
import { X, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { toast } from "sonner";
import type { VisualizationConfig } from "../DataVisualizationView";

interface BackendVisualizationCardProps {
  config: VisualizationConfig;
  onRemove: () => void;
}

const BackendVisualizationCard = ({ config, onRemove }: BackendVisualizationCardProps) => {
  const { uploadedFile } = useWorkflow();
  const [loading, setLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateVisualization = async () => {
    if (!uploadedFile?.storage_path) {
      toast.error("No dataset available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.generateVisualization({
        dataset_reference: uploadedFile.storage_path,
        plot_type: config.plotType,
        x_column: config.columns[0],
        y_column: config.columns[1],
        color_column: config.columns[2],
      });

      if (response.status === "success" && response.plot_base64) {
        setImageBase64(response.plot_base64);
        toast.success("Visualization generated!");
      } else {
        setError(response.error || "Failed to generate visualization");
        toast.error("Failed to generate visualization");
      }
    } catch (err) {
      console.error("Visualization error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate");
      toast.error("Failed to generate visualization");
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    generateVisualization();
  }, []);

  return (
    <div className="card-section">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-foreground">{config.title}</h4>
            {config.isAISuggested && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                <Sparkles className="w-3 h-3" />
                AI Suggested
              </span>
            )}
            <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
              Backend Generated
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {config.columns.map(col => (
              <span key={col} className="px-2 py-0.5 text-xs bg-secondary rounded">
                {col}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateVisualization}
            disabled={loading}
            className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50"
            title="Regenerate"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-destructive/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Visualization Display */}
      <div className="min-h-[280px] flex items-center justify-center bg-accent/30 rounded-lg">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating visualization with seaborn...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={generateVisualization}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : imageBase64 ? (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={config.title}
            className="w-full h-auto rounded"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No visualization generated</p>
        )}
      </div>
    </div>
  );
};

export default BackendVisualizationCard;
