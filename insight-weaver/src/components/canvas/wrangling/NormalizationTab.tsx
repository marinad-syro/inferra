import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, RefreshCw, Hash, BarChart3, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Transformation } from "@/hooks/useDataWrangling";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";

interface NormalizationTabProps {
  columns: string[];
  transformations: Transformation[];
  data?: Record<string, unknown>[];
  onAddTransformation: (transformation: Transformation) => void;
  onToggleTransformation: (transformationId: string) => void;
  onRemoveTransformation: (transformationId: string) => void;
}

// Generate histogram data from values
const generateHistogramData = (values: number[], bins: number = 20) => {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins;
  
  const histogram = Array.from({ length: bins }, (_, i) => ({
    x: min + (i + 0.5) * binWidth,
    count: 0,
  }));
  
  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    if (binIndex >= 0) histogram[binIndex].count++;
  });
  
  return histogram;
};

// Apply transformation to values
const applyTransformation = (values: number[], type: string): number[] => {
  if (values.length === 0) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  switch (type) {
    case 'standardize':
      return values.map(v => (v - mean) / (std || 1));
    case 'normalize':
      return values.map(v => (v - min) / ((max - min) || 1));
    case 'reverse_score':
      return values.map(v => max - v + min);
    default:
      return values;
  }
};

const MiniHistogram = ({ data, color = "hsl(var(--primary))" }: { data: { x: number; count: number }[]; color?: string }) => (
  <ResponsiveContainer width="100%" height={60}>
    <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
          <stop offset="95%" stopColor={color} stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="count"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#gradient-${color})`}
      />
    </AreaChart>
  </ResponsiveContainer>
);

const NormalizationTab = ({
  columns,
  transformations,
  data,
  onAddTransformation,
  onToggleTransformation,
  onRemoveTransformation,
}: NormalizationTabProps) => {
  const [newTransform, setNewTransform] = useState<{
    type: 'recode' | 'reverse_score' | 'standardize' | 'normalize';
    column: string;
  }>({ type: 'standardize', column: '' });

  // Use actual transformations only - no demo fallback
  const displayTransformations = transformations;

  // Generate sample data for visualizations
  const sampleOriginalData = Array.from({ length: 200 }, () => Math.random() * 100 + 200);
  const sampleTransformedData = applyTransformation(sampleOriginalData, 'standardize');

  const handleAddTransformation = () => {
    if (newTransform.column) {
      onAddTransformation({
        id: crypto.randomUUID(),
        ...newTransform,
        config: {},
        enabled: true,
      });
      setNewTransform({ type: 'standardize', column: '' });
    }
  };

  const getTransformIcon = (type: string) => {
    switch (type) {
      case 'standardize': return <BarChart3 className="h-4 w-4" />;
      case 'normalize': return <Hash className="h-4 w-4" />;
      case 'reverse_score': return <RefreshCw className="h-4 w-4" />;
      default: return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getTransformLabel = (type: string) => {
    switch (type) {
      case 'standardize': return 'Standardize (z-score)';
      case 'normalize': return 'Normalize (0-1)';
      case 'reverse_score': return 'Reverse score';
      case 'recode': return 'Recode categories';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro text */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Transform variables for analysis.</span>{" "}
          Standardize numeric variables, reverse-score questionnaire items, or recode categorical variables.
          Each transformation shows before/after distributions for transparency.
        </p>
      </div>

      {/* Transformation cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Standardize card */}
        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setNewTransform({ ...newTransform, type: 'standardize' })}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Standardize</CardTitle>
                <CardDescription className="text-xs">z-score transformation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Center to mean=0, scale to SD=1
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">Before</div>
                <MiniHistogram data={generateHistogramData(sampleOriginalData)} color="hsl(var(--muted-foreground))" />
              </div>
              <div className="bg-primary/5 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">After</div>
                <MiniHistogram data={generateHistogramData(sampleTransformedData)} color="hsl(var(--primary))" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Normalize card */}
        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setNewTransform({ ...newTransform, type: 'normalize' })}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10">
                <Hash className="h-4 w-4 text-info" />
              </div>
              <div>
                <CardTitle className="text-sm">Normalize</CardTitle>
                <CardDescription className="text-xs">Scale to 0-1 range</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Min-max scaling to [0, 1]
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">Before</div>
                <MiniHistogram data={generateHistogramData(sampleOriginalData)} color="hsl(var(--muted-foreground))" />
              </div>
              <div className="bg-info/5 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">After</div>
                <MiniHistogram data={generateHistogramData(applyTransformation(sampleOriginalData, 'normalize'))} color="hsl(var(--info))" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reverse score card */}
        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setNewTransform({ ...newTransform, type: 'reverse_score' })}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <RefreshCw className="h-4 w-4 text-warning" />
              </div>
              <div>
                <CardTitle className="text-sm">Reverse Score</CardTitle>
                <CardDescription className="text-xs">Flip scale direction</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              For negatively-keyed questionnaire items
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">Before</div>
                <MiniHistogram data={generateHistogramData(sampleOriginalData)} color="hsl(var(--muted-foreground))" />
              </div>
              <div className="bg-warning/5 rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">After</div>
                <MiniHistogram data={generateHistogramData(applyTransformation(sampleOriginalData, 'reverse_score'))} color="hsl(var(--warning))" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add transformation form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Transformation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Column</Label>
              <Select value={newTransform.column} onValueChange={(value) => setNewTransform({ ...newTransform, column: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {(columns.length > 0 ? columns : ["reaction_time", "accuracy", "anxiety_score", "age"]).map((col) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Transformation</Label>
              <Select value={newTransform.type} onValueChange={(value: 'recode' | 'reverse_score' | 'standardize' | 'normalize') => setNewTransform({ ...newTransform, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standardize">Standardize (z-score)</SelectItem>
                  <SelectItem value="normalize">Normalize (0-1)</SelectItem>
                  <SelectItem value="reverse_score">Reverse score</SelectItem>
                  <SelectItem value="recode">Recode categories</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddTransformation} disabled={!newTransform.column}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active transformations list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transformation Pipeline</CardTitle>
          <CardDescription>
            Transformations are applied in order from top to bottom
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayTransformations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transformations added yet</p>
              <p className="text-xs mt-1">Select a column above and add a transformation to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayTransformations.map((transform, index) => (
                <div
                  key={transform.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    transform.enabled ? 'bg-card' : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}.</span>
                    <div className="p-1.5 rounded bg-primary/10">
                      {getTransformIcon(transform.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{transform.column}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">
                          {getTransformLabel(transform.type)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={transform.enabled}
                      onCheckedChange={() => onToggleTransformation(transform.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRemoveTransformation(transform.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary of changes */}
      {displayTransformations.filter(t => t.enabled).length > 0 && (
        <Card className="bg-success/5 border-success/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">
                  {displayTransformations.filter(t => t.enabled).length} transformation(s) will be applied
                </p>
                <ul className="text-muted-foreground space-y-0.5">
                  {displayTransformations.filter(t => t.enabled).map(t => (
                    <li key={t.id}>
                      • {t.column} → {getTransformLabel(t.type)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NormalizationTab;
