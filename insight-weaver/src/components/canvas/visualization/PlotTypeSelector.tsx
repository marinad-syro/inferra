import { useState } from "react";
import { BarChart2, ScatterChart, LineChart, TrendingUp, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { VisualizationConfig } from "../DataVisualizationView";

const PLOT_TYPES = [
  { value: "histogram", label: "Histogram", icon: BarChart2, description: "Distribution of a single variable" },
  { value: "scatter", label: "Scatter Plot", icon: ScatterChart, description: "Relationship between two variables" },
  { value: "line", label: "Line Chart", icon: LineChart, description: "Trends over time or sequence" },
  { value: "boxplot", label: "Box Plot", icon: TrendingUp, description: "Summary statistics with quartiles" },
  { value: "bar", label: "Bar Chart", icon: BarChart2, description: "Compare categorical values" },
  { value: "density", label: "Density Plot", icon: TrendingUp, description: "Smoothed distribution estimate" },
] as const;

interface PlotTypeSelectorProps {
  columns: string[];
  derivedVariableNames?: string[];
  onAdd: (config: Omit<VisualizationConfig, 'id'>) => void;
  onCancel: () => void;
}

const PlotTypeSelector = ({ columns, derivedVariableNames = [], onAdd, onCancel }: PlotTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<VisualizationConfig['plotType'] | null>(null);
  const [title, setTitle] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const isDerivedVariable = (col: string) => derivedVariableNames.includes(col);

  const handleColumnToggle = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleAdd = () => {
    if (!selectedType || selectedColumns.length === 0) return;

    onAdd({
      title: title || `${selectedType} of ${selectedColumns.join(', ')}`,
      description: `Custom ${selectedType} visualization`,
      plotType: selectedType,
      columns: selectedColumns,
    });
  };

  const needsTwoColumns = selectedType === 'scatter';
  const isValid = selectedType && selectedColumns.length >= (needsTwoColumns ? 2 : 1);

  return (
    <div className="card-section space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-foreground">Create Custom Visualization</h4>
        <button onClick={onCancel} className="p-1 hover:bg-secondary rounded">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Plot Type Selection */}
      <div className="space-y-3">
        <Label>Plot Type</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PLOT_TYPES.map(type => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {type.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column Selection */}
      {selectedType && (
        <div className="space-y-3">
          <Label>
            Select Columns {needsTwoColumns ? '(select 2)' : '(select at least 1)'}
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {columns.map(col => (
              <label
                key={col}
                className="flex items-center gap-2 p-2 rounded border border-border hover:bg-secondary/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedColumns.includes(col)}
                  onCheckedChange={() => handleColumnToggle(col)}
                />
                <span className="text-sm truncate">
                  {col}
                  {isDerivedVariable(col) && (
                    <span className="ml-1 text-xs text-primary">(derived)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {columns.length === 0 && (
            <p className="text-sm text-muted-foreground">No columns available</p>
          )}
        </div>
      )}

      {/* Title */}
      {selectedType && selectedColumns.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="viz-title">Title (optional)</Label>
          <Input
            id="viz-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`${selectedType} of ${selectedColumns.join(', ')}`}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!isValid}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Visualization
        </button>
      </div>
    </div>
  );
};

export default PlotTypeSelector;
