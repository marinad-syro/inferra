import { FileCheck, Trash2, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatasetWithData } from "@/hooks/useMultiFileUpload";

interface DatasetCardProps {
  dataset: DatasetWithData;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onRemove: () => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DatasetCard = ({
  dataset,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  onRemove,
}: DatasetCardProps) => {
  const { file, parsedData } = dataset;

  return (
    <div
      className={`border rounded-lg transition-all ${
        isActive
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onSelect}
      >
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
          <FileCheck className="w-5 h-5 text-success" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {file.file_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file_size)} • {parsedData?.rowCount || file.row_count} rows • {parsedData?.columns.length || file.column_names?.length} columns
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isActive && (
            <Badge variant="default" className="text-xs">
              Active
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && parsedData && (
        <div className="border-t px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Columns</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {parsedData.columns.slice(0, 10).map((col) => (
              <Badge key={col} variant="secondary" className="text-xs font-mono">
                {col}
              </Badge>
            ))}
            {parsedData.columns.length > 10 && (
              <Badge variant="outline" className="text-xs">
                +{parsedData.columns.length - 10} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetCard;
