import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Link2, AlertTriangle, CheckCircle2, Plus, Trash2, ArrowRight } from "lucide-react";
import { Dataset, JoinWarning } from "@/hooks/useDataWrangling";

interface StructureJoinTabProps {
  datasets: Dataset[];
  joinKeys: string[];
  joinWarnings: JoinWarning[];
  availableColumns: string[];
  onAddDataset: (dataset: Dataset) => void;
  onRemoveDataset: (datasetId: string) => void;
  onUpdateJoinKeys: (keys: string[]) => void;
}

const StructureJoinTab = ({
  datasets,
  joinKeys,
  joinWarnings,
  availableColumns,
  onAddDataset,
  onRemoveDataset,
  onUpdateJoinKeys,
}: StructureJoinTabProps) => {
  const [selectedKey, setSelectedKey] = useState<string>("");

  // Sample dataset cards for demo
  const sampleDatasets: Dataset[] = datasets.length > 0 ? datasets : [
    { id: "1", name: "Behavioral trials", rowCount: 2400, columns: ["subject_id", "trial", "rt", "accuracy"], keyColumn: "subject_id" },
    { id: "2", name: "Questionnaires", rowCount: 120, columns: ["subject_id", "anxiety_score", "depression_score"], keyColumn: "subject_id" },
    { id: "3", name: "Demographics", rowCount: 120, columns: ["subject_id", "age", "gender", "education"], keyColumn: "subject_id" },
  ];

  const sampleWarnings: JoinWarning[] = joinWarnings.length > 0 ? joinWarnings : [
    { type: "missing", message: "3 subjects in Behavioral trials not found in Demographics", affectedRows: 72 },
    { type: "duplicate", message: "2 duplicate subject IDs detected in Questionnaires", affectedRows: 4 },
  ];

  const handleAddKey = () => {
    if (selectedKey && !joinKeys.includes(selectedKey)) {
      onUpdateJoinKeys([...joinKeys, selectedKey]);
      setSelectedKey("");
    }
  };

  const handleRemoveKey = (key: string) => {
    onUpdateJoinKeys(joinKeys.filter(k => k !== key));
  };

  // Calculate join preview stats
  const beforeRows = sampleDatasets.reduce((sum, d) => sum + d.rowCount, 0);
  const afterRows = Math.min(...sampleDatasets.map(d => d.rowCount));
  const droppedRows = beforeRows - afterRows;

  return (
    <div className="space-y-6">
      {/* Intro text */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Multi-source data integration.</span>{" "}
          Connect behavioral data with questionnaires, demographics, or external datasets. 
          Define join keys and review potential data loss before merging.
        </p>
      </div>

      {/* Dataset cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {sampleDatasets.map((dataset) => (
          <Card key={dataset.id} className="relative group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">{dataset.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveDataset(dataset.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                {dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} columns
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {dataset.columns.slice(0, 4).map((col) => (
                  <Badge 
                    key={col} 
                    variant={col === dataset.keyColumn ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {col === dataset.keyColumn && <Link2 className="h-2.5 w-2.5 mr-1" />}
                    {col}
                  </Badge>
                ))}
                {dataset.columns.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{dataset.columns.length - 4} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Add dataset card */}
        <Card className="border-dashed flex items-center justify-center min-h-[140px] cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
          <div className="text-center p-4">
            <Plus className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Add dataset</p>
          </div>
        </Card>
      </div>

      {/* Join key configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Join Keys
          </CardTitle>
          <CardDescription>
            Select columns to use as keys when merging datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {(availableColumns.length > 0 ? availableColumns : ["subject_id", "session_id", "participant_id"]).map((col) => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddKey} disabled={!selectedKey}>
              Add Key
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(joinKeys.length > 0 ? joinKeys : ["subject_id"]).map((key) => (
              <Badge key={key} variant="outline" className="pl-2 pr-1 py-1 gap-1">
                <Link2 className="h-3 w-3 text-primary" />
                {key}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-destructive/20"
                  onClick={() => handleRemoveKey(key)}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {sampleWarnings.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Join Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {sampleWarnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <span>
                    {warning.message}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {warning.affectedRows} rows affected
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Join preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Join Preview</CardTitle>
          <CardDescription>
            Estimated impact of merging datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-center">Before Join</TableHead>
                  <TableHead className="text-center w-12"></TableHead>
                  <TableHead className="text-center">After Join</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Total Rows</TableCell>
                  <TableCell className="text-center font-mono">{beforeRows.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>
                  <TableCell className="text-center font-mono">{afterRows.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Merged
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Dropped Rows</TableCell>
                  <TableCell className="text-center font-mono">—</TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>
                  <TableCell className="text-center font-mono text-destructive">{droppedRows.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Review
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Unique Subjects</TableCell>
                  <TableCell className="text-center font-mono">120</TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>
                  <TableCell className="text-center font-mono">117</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      3 missing
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StructureJoinTab;
