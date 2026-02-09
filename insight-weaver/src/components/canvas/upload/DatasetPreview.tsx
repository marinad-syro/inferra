import { useMemo, useState, useEffect } from "react";
import { BarChart3, ScatterChart, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { histogram, mean, std, median, min, max, formatNumber } from "@/lib/statistics";
import { ParsedDataset } from "@/hooks/useMultiFileUpload";
import { apiClient } from "@/services/apiClient";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { toast } from "sonner";

interface DatasetPreviewProps {
  parsedData: ParsedDataset;
}

const DatasetPreview = ({ parsedData }: DatasetPreviewProps) => {
  const { uploadedFile } = useWorkflow();
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [exploratoryViz, setExploratoryViz] = useState<string | null>(null);
  const [loadingViz, setLoadingViz] = useState(false);

  // Get numeric columns for histogram - check multiple rows for better detection
  const numericColumns = useMemo(() => {
    if (!parsedData?.rows?.length) return [];
    return parsedData.columns.filter(col => {
      // Check first 20 rows to determine if column is numeric
      const sampleValues = parsedData.rows.slice(0, 20).map(row => row[col]);
      // Column is numeric if at least some values are numbers
      return sampleValues.some(v =>
        typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)))
      );
    });
  }, [parsedData]);

  // Auto-select first numeric column
  useMemo(() => {
    if (numericColumns.length > 0 && !selectedColumn) {
      setSelectedColumn(numericColumns[0]);
    }
  }, [numericColumns, selectedColumn]);

  // Extract numeric values for selected column
  const columnData = useMemo(() => {
    if (!parsedData?.rows?.length || !selectedColumn) return [];
    return parsedData.rows
      .map(row => Number(row[selectedColumn]))
      .filter(v => !isNaN(v));
  }, [parsedData, selectedColumn]);

  // Generate histogram data
  const histogramData = useMemo(() => {
    if (columnData.length === 0) return [];
    return histogram(columnData);
  }, [columnData]);

  // Calculate descriptive statistics
  const stats = useMemo(() => {
    if (columnData.length === 0) return null;
    return {
      mean: mean(columnData),
      std: std(columnData),
      median: median(columnData),
      min: min(columnData),
      max: max(columnData),
      n: columnData.length,
    };
  }, [columnData]);

  // Generate exploratory scatter plot if we have 2+ numeric columns
  useEffect(() => {
    const generateExploratoryViz = async () => {
      if (numericColumns.length < 2 || !uploadedFile?.storage_path || loadingViz) return;

      setLoadingViz(true);
      try {
        // Generate scatter plot of first two numeric columns
        const response = await apiClient.generateVisualization({
          dataset_reference: uploadedFile.storage_path,
          plot_type: "scatter",
          x_column: numericColumns[0],
          y_column: numericColumns[1],
        });

        if (response.status === "success" && response.plot_base64) {
          setExploratoryViz(response.plot_base64);
        }
      } catch (error) {
        console.error("Failed to generate exploratory visualization:", error);
      } finally {
        setLoadingViz(false);
      }
    };

    generateExploratoryViz();
  }, [numericColumns, uploadedFile]);

  return (
    <div className="space-y-6">
      {/* Distribution Visualization */}
      {numericColumns.length > 0 && (
        <div className="card-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Distribution</h3>
            </div>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {numericColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          
          {histogramData.length > 0 && stats && (
            <>
              {/* Statistics summary */}
              <div className="grid grid-cols-5 gap-2 mb-4 text-center">
                <div className="p-2 bg-accent/30 rounded">
                  <div className="text-xs text-muted-foreground">Mean</div>
                  <div className="text-sm font-mono font-medium">{formatNumber(stats.mean)}</div>
                </div>
                <div className="p-2 bg-accent/30 rounded">
                  <div className="text-xs text-muted-foreground">Std</div>
                  <div className="text-sm font-mono font-medium">{formatNumber(stats.std)}</div>
                </div>
                <div className="p-2 bg-accent/30 rounded">
                  <div className="text-xs text-muted-foreground">Median</div>
                  <div className="text-sm font-mono font-medium">{formatNumber(stats.median)}</div>
                </div>
                <div className="p-2 bg-accent/30 rounded">
                  <div className="text-xs text-muted-foreground">Min</div>
                  <div className="text-sm font-mono font-medium">{formatNumber(stats.min)}</div>
                </div>
                <div className="p-2 bg-accent/30 rounded">
                  <div className="text-xs text-muted-foreground">Max</div>
                  <div className="text-sm font-mono font-medium">{formatNumber(stats.max)}</div>
                </div>
              </div>
              
              {/* Histogram with KDE-like area */}
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={histogramData} margin={{ top: 10, right: 10, bottom: 25, left: 50 }}>
                    <defs>
                      <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="binCenter" 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => formatNumber(v, 1)}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      label={{ value: selectedColumn, position: 'bottom', offset: 10, fontSize: 11, fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      dataKey="count"
                    />
                    <ReferenceLine 
                      x={stats.mean} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      label={{ value: 'μ', position: 'top', fontSize: 10, fill: 'hsl(var(--destructive))' }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'count') return [value, 'Count'];
                        return [value.toFixed(4), 'Density'];
                      }}
                      labelFormatter={(label) => `${formatNumber(Number(label), 2)}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#histGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                n = {stats.n} • Bins determined by Freedman-Diaconis rule
              </p>
            </>
          )}
        </div>
      )}

      {/* Exploratory Scatter Plot */}
      {numericColumns.length >= 2 && (
        <div className="card-section">
          <div className="flex items-center gap-2 mb-4">
            <ScatterChart className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Exploratory Scatter Plot</h3>
            <span className="text-xs text-muted-foreground">
              ({numericColumns[0]} vs {numericColumns[1]})
            </span>
          </div>

          {loadingViz ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Generating visualization...</p>
            </div>
          ) : exploratoryViz ? (
            <div className="rounded-lg overflow-hidden bg-accent/20">
              <img
                src={`data:image/png;base64,${exploratoryViz}`}
                alt="Exploratory scatter plot"
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No visualization generated yet
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Use this plot to visually identify relationships, patterns, and potential outliers in your data.
          </p>
        </div>
      )}

      {/* Data Preview Table */}
      <div className="card-section">
        <h3 className="text-base font-semibold text-foreground mb-4">Data Preview</h3>
        <div className="overflow-hidden rounded-lg border border-[hsl(var(--table-border))]">
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="bg-[hsl(var(--table-header))]">
                  {parsedData.columns.map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-card">
                {parsedData.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-[hsl(var(--table-border))]">
                    {parsedData.columns.map((col) => (
                      <td key={col} className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                        {String(row[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Showing first 5 of {parsedData.rowCount} rows • {parsedData.columns.length} columns
        </p>
      </div>
    </div>
  );
};

export default DatasetPreview;
