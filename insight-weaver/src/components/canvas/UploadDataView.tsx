import { useCallback, useState } from "react";
import { Upload, FileUp, Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import DatasetCard from "./upload/DatasetCard";
import DatasetPreview from "./upload/DatasetPreview";

interface UploadDataViewProps {
  onContinue: () => void;
}

const UploadDataView = ({ onContinue }: UploadDataViewProps) => {
  const { 
    uploadFile, 
    uploading, 
    session, 
    updateMetadata,
    datasets,
    activeDataset,
    activeDatasetId,
    setActiveDatasetId,
    removeDataset,
  } = useWorkflow();
  
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [studyInfoOpen, setStudyInfoOpen] = useState(false);
  
  // Local state for metadata (syncs on blur)
  const [researchQuestion, setResearchQuestion] = useState(session?.research_question || "");
  const [distributionType, setDistributionType] = useState(session?.distribution_type || "unknown");
  const [hasOutliers, setHasOutliers] = useState(session?.has_outliers || false);
  const [outlierNotes, setOutlierNotes] = useState(session?.outlier_notes || "");

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleMetadataBlur = useCallback(() => {
    updateMetadata({
      research_question: researchQuestion || undefined,
      distribution_type: distributionType,
      has_outliers: hasOutliers,
      outlier_notes: outlierNotes || undefined,
    });
  }, [researchQuestion, distributionType, hasOutliers, outlierNotes, updateMetadata]);

  const hasDatasets = datasets.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <Upload className="w-5 h-5" />
          <span className="text-sm font-medium">Step 1 of 7</span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Upload Data</h2>
        <p className="text-muted-foreground mt-1">
          Import one or more datasets to begin analysis. You can combine behavioral data with questionnaires, demographics, or other sources.
        </p>
      </div>

      {/* Dataset List */}
      {hasDatasets && (
        <div className="card-section mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">
              Datasets ({datasets.length})
            </h3>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              Add Dataset
              <input
                type="file"
                accept=".csv,.tsv,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
          
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <DatasetCard
                key={dataset.file.id}
                dataset={dataset}
                isActive={dataset.file.id === activeDatasetId}
                isExpanded={dataset.file.id === expandedDatasetId}
                onSelect={() => setActiveDatasetId(dataset.file.id)}
                onToggleExpand={() => setExpandedDatasetId(
                  expandedDatasetId === dataset.file.id ? null : dataset.file.id
                )}
                onRemove={() => removeDataset(dataset.file.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload Zone (shown when no datasets or as additional upload option) */}
      {!hasDatasets && (
        <div className="card-section mb-6">
          <div 
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              uploading 
                ? 'border-primary/50 bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Processing file...
                </h3>
                <p className="text-sm text-muted-foreground">
                  Parsing and validating your data
                </p>
              </>
            ) : (
              <>
                <FileUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Drop your file here
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports CSV, TSV, or JSON event logs
                </p>
                <label className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    accept=".csv,.tsv,.json"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active Dataset Preview */}
      {activeDataset?.parsedData && (
        <DatasetPreview parsedData={activeDataset.parsedData} />
      )}

      {/* Study Information */}
      {hasDatasets && (
        <Collapsible open={studyInfoOpen} onOpenChange={setStudyInfoOpen} className="card-section mb-6 mt-6">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <h3 className="text-base font-semibold text-foreground">Study Information</h3>
            {studyInfoOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Research Question
              </label>
              <Textarea
                placeholder="What is the main question your analysis aims to answer?"
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                onBlur={handleMetadataBlur}
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Data Distribution
                </label>
                <select
                  value={distributionType}
                  onChange={(e) => {
                    setDistributionType(e.target.value);
                    updateMetadata({ distribution_type: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="unknown">Unknown / Not sure</option>
                  <option value="normal">Normal distribution</option>
                  <option value="non_normal">Non-normal distribution</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Known Outliers?
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="outliers"
                      checked={!hasOutliers}
                      onChange={() => {
                        setHasOutliers(false);
                        updateMetadata({ has_outliers: false });
                      }}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">No</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="outliers"
                      checked={hasOutliers}
                      onChange={() => {
                        setHasOutliers(true);
                        updateMetadata({ has_outliers: true });
                      }}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                </div>
              </div>
            </div>
            {hasOutliers && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Outlier Details
                </label>
                <Textarea
                  placeholder="Describe the outliers (e.g., subjects with extreme RTs, missing data patterns)"
                  value={outlierNotes}
                  onChange={(e) => setOutlierNotes(e.target.value)}
                  onBlur={handleMetadataBlur}
                  className="min-h-[60px]"
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Supported Formats */}
      <div className="card-section">
        <h3 className="text-base font-semibold text-foreground mb-4">Supported Formats</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-foreground">Event-based logs</span>
              <p className="text-xs text-muted-foreground">One row per event with timestamps</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-foreground">Trial-based tables</span>
              <p className="text-xs text-muted-foreground">One row per trial with aggregated data</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-foreground">Multi-subject datasets</span>
              <p className="text-xs text-muted-foreground">Combined data with subject identifiers</p>
            </div>
          </li>
        </ul>
      </div>

      {/* Continue button */}
      {hasDatasets && (
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onContinue}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Continue to Wrangling & Cleaning
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadDataView;
