import { useMemo } from "react";
import { X, Sparkles } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { VisualizationConfig } from "../DataVisualizationView";

interface VisualizationCardProps {
  config: VisualizationConfig;
  data: Record<string, unknown>[];
  onRemove: () => void;
}

const VisualizationCard = ({ config, data, onRemove }: VisualizationCardProps) => {
  const chartData = useMemo(() => {
    if (!data.length || !config.columns.length) return [];

    const col1 = config.columns[0];
    const col2 = config.columns[1];

    switch (config.plotType) {
      case 'histogram': {
        // Create bins for histogram
        const values = data
          .map(row => Number(row[col1]))
          .filter(v => !isNaN(v));
        
        if (values.length === 0) return [];
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)));
        const binWidth = (max - min) / binCount || 1;
        
        const bins: { range: string; count: number; binStart: number }[] = [];
        for (let i = 0; i < binCount; i++) {
          const binStart = min + i * binWidth;
          const binEnd = binStart + binWidth;
          bins.push({
            range: `${binStart.toFixed(1)}`,
            binStart,
            count: values.filter(v => v >= binStart && (i === binCount - 1 ? v <= binEnd : v < binEnd)).length,
          });
        }
        return bins;
      }

      case 'scatter': {
        if (!col2) return [];
        return data
          .map(row => ({
            x: Number(row[col1]),
            y: Number(row[col2]),
          }))
          .filter(d => !isNaN(d.x) && !isNaN(d.y));
      }

      case 'line': {
        return data
          .map((row, i) => ({
            index: i,
            value: Number(row[col1]),
          }))
          .filter(d => !isNaN(d.value));
      }

      case 'boxplot': {
        // Return raw values for display
        const values = data
          .map(row => Number(row[col1]))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);
        
        if (values.length === 0) return [];
        
        const q1 = values[Math.floor(values.length * 0.25)];
        const median = values[Math.floor(values.length * 0.5)];
        const q3 = values[Math.floor(values.length * 0.75)];
        const min = values[0];
        const max = values[values.length - 1];
        
        return [{ name: col1, min, q1, median, q3, max }];
      }

      case 'bar': {
        // Group by unique values
        const counts: Record<string, number> = {};
        data.forEach(row => {
          const val = String(row[col1]);
          counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts)
          .slice(0, 20)
          .map(([name, count]) => ({ name, count }));
      }

      case 'density': {
        // Simplified density using histogram with more bins
        const values = data
          .map(row => Number(row[col1]))
          .filter(v => !isNaN(v));
        
        if (values.length === 0) return [];
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 30;
        const binWidth = (max - min) / binCount || 1;
        
        const bins: { x: number; density: number }[] = [];
        for (let i = 0; i < binCount; i++) {
          const binStart = min + i * binWidth;
          const binEnd = binStart + binWidth;
          const count = values.filter(v => v >= binStart && (i === binCount - 1 ? v <= binEnd : v < binEnd)).length;
          bins.push({
            x: binStart + binWidth / 2,
            density: count / values.length,
          });
        }
        return bins;
      }

      default:
        return [];
    }
  }, [config, data]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No data available for this visualization
        </div>
      );
    }

    switch (config.plotType) {
      case 'histogram':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="range" 
                tick={{ fontSize: 11 }} 
                className="fill-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }} 
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="x" 
                name={config.columns[0]} 
                tick={{ fontSize: 11 }} 
                className="fill-muted-foreground"
              />
              <YAxis 
                dataKey="y" 
                name={config.columns[1]} 
                tick={{ fontSize: 11 }} 
                className="fill-muted-foreground"
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }} 
              />
              <Scatter data={chartData} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={chartData.length < 50}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'density':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="density" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }} 
                className="fill-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }} 
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'boxplot': {
        // Simple boxplot representation - cast to correct type
        const boxData = chartData as { name: string; min: number; q1: number; median: number; q3: number; max: number }[];
        const box = boxData[0];
        if (!box) return null;
        
        const range = box.max - box.min;
        
        return (
          <div className="h-64 flex flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-3">
              <div className="text-sm text-center text-muted-foreground mb-4">
                Box Plot Summary for {config.columns[0]}
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Min</div>
                  <div className="text-sm font-mono font-medium">{box.min.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Q1</div>
                  <div className="text-sm font-mono font-medium">{box.q1.toFixed(2)}</div>
                </div>
                <div className="bg-primary/10 rounded p-2">
                  <div className="text-xs text-primary">Median</div>
                  <div className="text-sm font-mono font-medium text-primary">{box.median.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Q3</div>
                  <div className="text-sm font-mono font-medium">{box.q3.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max</div>
                  <div className="text-sm font-mono font-medium">{box.max.toFixed(2)}</div>
                </div>
              </div>
              {/* Visual box representation */}
              <div className="relative h-8 mt-4">
                <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                  <div 
                    className="h-0.5 bg-muted-foreground/30" 
                    style={{ 
                      marginLeft: '0%',
                      width: `${range > 0 ? ((box.q1 - box.min) / range) * 100 : 0}%`
                    }} 
                  />
                  <div 
                    className="h-6 bg-primary/20 border-2 border-primary rounded"
                    style={{ width: `${range > 0 ? ((box.q3 - box.q1) / range) * 100 : 50}%` }}
                  />
                  <div 
                    className="h-0.5 bg-muted-foreground/30 flex-1" 
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

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
        <button
          onClick={onRemove}
          className="p-1 hover:bg-destructive/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {renderChart()}
    </div>
  );
};

export default VisualizationCard;
