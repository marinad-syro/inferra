import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { MissingDataStrategy } from "@/hooks/useDataWrangling";

interface MissingDataTabProps {
  columns: string[];
  missingDataStrategy: MissingDataStrategy;
  criticalVariables: string[];
  optionalVariables: string[];
  data?: Record<string, unknown>[];
  onUpdateStrategy: (column: string, strategy: 'keep' | 'drop' | 'impute_mean' | 'impute_median') => void;
  onUpdateCritical: (variables: string[]) => void;
  onUpdateOptional: (variables: string[]) => void;
}

interface ColumnMissingInfo {
  column: string;
  missingCount: number;
  missingPercent: number;
  isCritical: boolean;
  isOptional: boolean;
}

const MissingDataTab = ({
  columns,
  missingDataStrategy,
  criticalVariables,
  optionalVariables,
  data,
  onUpdateStrategy,
  onUpdateCritical,
  onUpdateOptional,
}: MissingDataTabProps) => {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  // Calculate missing data info
  const calculateMissingInfo = (): ColumnMissingInfo[] => {
    if (!data || data.length === 0) {
      // Demo data
      return [
        { column: "reaction_time", missingCount: 12, missingPercent: 0.5, isCritical: true, isOptional: false },
        { column: "accuracy", missingCount: 0, missingPercent: 0, isCritical: true, isOptional: false },
        { column: "anxiety_score", missingCount: 8, missingPercent: 6.7, isCritical: false, isOptional: true },
        { column: "depression_score", missingCount: 15, missingPercent: 12.5, isCritical: false, isOptional: true },
        { column: "age", missingCount: 2, missingPercent: 1.7, isCritical: false, isOptional: true },
        { column: "education", missingCount: 45, missingPercent: 37.5, isCritical: false, isOptional: true },
        { column: "handedness", missingCount: 89, missingPercent: 74.2, isCritical: false, isOptional: true },
      ];
    }

    return columns.map(column => {
      const missingCount = data.filter(row => row[column] === null || row[column] === undefined || row[column] === '').length;
      return {
        column,
        missingCount,
        missingPercent: (missingCount / data.length) * 100,
        isCritical: criticalVariables.includes(column),
        isOptional: optionalVariables.includes(column),
      };
    });
  };

  const missingInfo = calculateMissingInfo();
  const sortedInfo = [...missingInfo].sort((a, b) => b.missingPercent - a.missingPercent);

  const toggleCritical = (column: string) => {
    if (criticalVariables.includes(column)) {
      onUpdateCritical(criticalVariables.filter(c => c !== column));
    } else {
      onUpdateCritical([...criticalVariables, column]);
      // Remove from optional if adding to critical
      if (optionalVariables.includes(column)) {
        onUpdateOptional(optionalVariables.filter(c => c !== column));
      }
    }
  };

  const toggleOptional = (column: string) => {
    if (optionalVariables.includes(column)) {
      onUpdateOptional(optionalVariables.filter(c => c !== column));
    } else {
      onUpdateOptional([...optionalVariables, column]);
      // Remove from critical if adding to optional
      if (criticalVariables.includes(column)) {
        onUpdateCritical(criticalVariables.filter(c => c !== column));
      }
    }
  };

  // Color scale for heatmap
  const getMissingColor = (column: string, percent: number): string => {
    // If a strategy has been applied (not "keep"), show green
    const strategy = missingDataStrategy[column];
    if (strategy && strategy !== 'keep') {
      return "bg-success/50 border-success";
    }

    // Otherwise, color by missing percentage
    if (percent === 0) return "bg-success/20";
    if (percent < 5) return "bg-success/40";
    if (percent < 15) return "bg-warning/30";
    if (percent < 30) return "bg-warning/60";
    if (percent < 50) return "bg-destructive/40";
    return "bg-destructive/70";
  };

  const getStatusIcon = (percent: number) => {
    if (percent === 0) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (percent < 15) return <Info className="h-4 w-4 text-warning" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-6">
      {/* Intro text */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Handle missing values transparently.</span>{" "}
          Review the pattern of missingness across variables and choose appropriate handling strategies.
          Mark critical outcome variables separately from optional covariates.
        </p>
      </div>

      {/* Heatmap overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Missing Data Heatmap</CardTitle>
          <CardDescription>
            Visual overview of missing values by variable — darker = more missing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sortedInfo.map((info) => (
              <div
                key={info.column}
                className={`px-3 py-2 rounded-md border transition-all hover:ring-2 hover:ring-primary cursor-pointer ${
                  selectedColumn === info.column ? 'ring-2 ring-primary' : ''
                } ${getMissingColor(info.column, info.missingPercent)}`}
                title={`${info.column}: ${info.missingPercent.toFixed(1)}% missing - Click to configure`}
                onClick={() => setSelectedColumn(info.column)}
              >
                <div className="text-xs font-medium truncate max-w-[120px]">{info.column}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {info.missingPercent.toFixed(1)}%
                </div>
                {missingDataStrategy[info.column] && missingDataStrategy[info.column] !== 'keep' && (
                  <CheckCircle2 className="h-3 w-3 text-success mt-1" />
                )}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">Legend:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-success/20" />
              <span className="text-xs">0%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-warning/30" />
              <span className="text-xs">5-15%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-warning/60" />
              <span className="text-xs">15-30%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-destructive/70" />
              <span className="text-xs">&gt;50%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Configuration Panel - Shows when a column is selected */}
      {selectedColumn && (() => {
        const info = sortedInfo.find(i => i.column === selectedColumn);
        if (!info) return null;

        return (
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Configure: {selectedColumn}
                    {info.isCritical && (
                      <Badge variant="default" className="text-xs">Critical</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {info.missingCount} missing ({info.missingPercent.toFixed(1)}%)
                  </CardDescription>
                </div>
                <button
                  onClick={() => setSelectedColumn(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Variable type toggle */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`critical-${selectedColumn}`}
                    checked={info.isCritical}
                    onCheckedChange={() => toggleCritical(selectedColumn)}
                  />
                  <Label htmlFor={`critical-${selectedColumn}`} className="text-sm">
                    Mark as critical variable
                  </Label>
                </div>
              </div>

              {/* Strategy selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Handling Strategy</Label>
                <Select
                  value={missingDataStrategy[selectedColumn] || 'keep'}
                  onValueChange={(value) => {
                    onUpdateStrategy(selectedColumn, value as 'keep' | 'drop' | 'impute_mean' | 'impute_median');
                    // Auto-close after selection
                    setTimeout(() => setSelectedColumn(null), 500);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep as missing</SelectItem>
                    <SelectItem value="drop">Drop rows with missing values</SelectItem>
                    <SelectItem value="impute_mean">Impute with mean</SelectItem>
                    <SelectItem value="impute_median">Impute with median</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {missingDataStrategy[selectedColumn] === 'drop' &&
                    `${info.missingCount} rows will be dropped from the dataset`}
                  {missingDataStrategy[selectedColumn] === 'impute_mean' &&
                    `Missing values will be replaced with the column mean`}
                  {missingDataStrategy[selectedColumn] === 'impute_median' &&
                    `Missing values will be replaced with the column median`}
                  {(!missingDataStrategy[selectedColumn] || missingDataStrategy[selectedColumn] === 'keep') &&
                    `Missing values will remain in the dataset`}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Notes about critical vs optional */}
      <Card className="bg-info/5 border-info/30">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-info shrink-0" />
            <div className="text-sm space-y-2">
              <p>
                <strong>Critical variables</strong> (e.g., outcome measures) typically warrant dropping rows 
                with missing values, as imputation could introduce bias in your main analyses.
              </p>
              <p>
                <strong>Optional covariates</strong> (e.g., demographics, auxiliary measures) can often be 
                imputed or kept as missing without affecting your primary conclusions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MissingDataTab;
