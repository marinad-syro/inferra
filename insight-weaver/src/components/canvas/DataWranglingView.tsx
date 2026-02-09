import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Database, AlertCircle, CheckSquare, Layers } from "lucide-react";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { useDataWrangling } from "@/hooks/useDataWrangling";
import StructureJoinTab from "./wrangling/StructureJoinTab";
import MissingDataTab from "./wrangling/MissingDataTab";
import ConsistencyChecksTab from "./wrangling/ConsistencyChecksTab";
import { toast } from "sonner";

interface DataWranglingViewProps {
  onContinue: () => void;
}

const DataWranglingView = ({ onContinue }: DataWranglingViewProps) => {
  const { session, parsedData, datasets, allColumns } = useWorkflow();
  const {
    config,
    loading,
    createConfig,
    updateConfig,
    addDataset,
    removeDataset,
    runConsistencyChecks,
  } = useDataWrangling(session?.id);

  // Determine if we have multiple datasets (show Structure & Join tab)
  const hasMultipleDatasets = datasets.length > 1;
  
  // Default to "missing" tab if only 1 dataset, "structure" if multiple
  const defaultTab = hasMultipleDatasets ? "structure" : "missing";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [checkingConsistency, setCheckingConsistency] = useState(false);

  // Keep track of cleaned data (starts with original, gets updated as user applies cleanings)
  const [cleanedData, setCleanedData] = useState<Record<string, unknown>[]>([]);

  // Update active tab when dataset count changes
  useEffect(() => {
    if (!hasMultipleDatasets && activeTab === "structure") {
      setActiveTab("missing");
    }
  }, [hasMultipleDatasets, activeTab]);

  // Initialize config if not exists
  useEffect(() => {
    if (session?.id && !config && !loading) {
      createConfig();
    }
  }, [session?.id, config, loading, createConfig]);

  // Initialize cleaned data when parsedData changes
  useEffect(() => {
    if (parsedData?.rows && parsedData.rows.length > 0) {
      console.log('[DataWranglingView] Initializing cleaned data with', parsedData.rows.length, 'rows');
      setCleanedData(parsedData.rows);
    }
  }, [parsedData?.rows]);

  // Use allColumns from all datasets for wrangling options
  const columns = allColumns.length > 0 ? allColumns : (parsedData?.columns || []);

  // Use cleaned data if available, otherwise fall back to original
  const data = cleanedData.length > 0 ? cleanedData : (parsedData?.rows || []);

  const handleRunConsistencyChecks = async () => {
    if (!data.length) return;
    setCheckingConsistency(true);
    await runConsistencyChecks(data);
    setCheckingConsistency(false);
  };

  const handleUpdateMissingStrategy = async (column: string, strategy: 'keep' | 'drop' | 'impute_mean' | 'impute_median') => {
    console.log(`[DataWranglingView] Applying missing data strategy: ${column} = ${strategy}`);

    // Update config
    await updateConfig({
      missing_data_strategy: {
        ...(config?.missing_data_strategy || {}),
        [column]: strategy,
      }
    });

    // Apply the strategy to the cleaned data
    if (data && data.length > 0) {
      let newCleanedData = [...data];

      if (strategy === 'drop') {
        // Drop rows with missing values in this column
        const beforeCount = newCleanedData.length;
        newCleanedData = newCleanedData.filter(row => {
          const value = row[column];
          return value !== null && value !== undefined && value !== '';
        });
        console.log(`[DataWranglingView] Dropped ${beforeCount - newCleanedData.length} rows with missing ${column}`);
      } else if (strategy === 'impute_mean' || strategy === 'impute_median') {
        // Calculate mean or median of non-missing values
        const values = newCleanedData
          .map(row => row[column])
          .filter(val => val !== null && val !== undefined && val !== '' && typeof val === 'number') as number[];

        if (values.length > 0) {
          let imputeValue: number;
          if (strategy === 'impute_mean') {
            imputeValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          } else {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            imputeValue = sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];
          }

          // Apply imputation
          let imputedCount = 0;
          newCleanedData = newCleanedData.map(row => {
            const value = row[column];
            if (value === null || value === undefined || value === '') {
              imputedCount++;
              return { ...row, [column]: imputeValue };
            }
            return row;
          });

          console.log(`[DataWranglingView] Imputed ${imputedCount} values in ${column} with ${strategy === 'impute_mean' ? 'mean' : 'median'}: ${imputeValue.toFixed(2)}`);
        }
      }
      // If strategy is 'keep', do nothing (keep missing values as-is)

      setCleanedData(newCleanedData);

      // Show feedback
      if (strategy === 'drop') {
        toast.success(`Applied: Rows with missing ${column} dropped`);
      } else if (strategy === 'impute_mean') {
        toast.success(`Applied: ${column} missing values imputed with mean`);
      } else if (strategy === 'impute_median') {
        toast.success(`Applied: ${column} missing values imputed with median`);
      } else {
        toast.success(`Applied: ${column} will keep missing values`);
      }
    }
  };

  const handleUpdateJoinKeys = (keys: string[]) => {
    updateConfig({ join_keys: keys });
  };

  const handleUpdateCritical = (variables: string[]) => {
    updateConfig({ critical_variables: variables });
  };

  const handleUpdateOptional = (variables: string[]) => {
    updateConfig({ optional_variables: variables });
  };

  const handleSaveLabelStandardization = async (resolutions: Record<string, Record<string, string>>) => {
    console.log('[DataWranglingView] Saving label standardization:', resolutions);

    // Get current label_standardization config and merge with new resolutions
    const existingStandardization = config?.label_standardization || {};
    const mergedStandardization: Record<string, Record<string, string>> = { ...existingStandardization };

    // Merge new resolutions into existing standardization
    Object.entries(resolutions).forEach(([column, mappings]) => {
      if (!mergedStandardization[column]) {
        mergedStandardization[column] = {};
      }
      Object.entries(mappings).forEach(([from, to]) => {
        mergedStandardization[column][from] = to;
      });
    });

    // Save the merged label standardization config
    await updateConfig({ label_standardization: mergedStandardization });
    console.log('[DataWranglingView] Config updated with merged standardization:', mergedStandardization);

    // Apply the standardization to the current cleaned data
    if (data && data.length > 0) {
      console.log('[DataWranglingView] Applying standardization to', data.length, 'rows');

      const newCleanedData = data.map(row => {
        const cleanedRow = { ...row };

        // Apply standardization for each column
        Object.entries(resolutions).forEach(([column, mappings]) => {
          if (column in cleanedRow) {
            const originalValue = cleanedRow[column];
            if (typeof originalValue === 'string' && mappings[originalValue]) {
              console.log(`[DataWranglingView] Replacing "${originalValue}" with "${mappings[originalValue]}" in column "${column}"`);
              cleanedRow[column] = mappings[originalValue];
            }
          }
        });

        return cleanedRow;
      });

      // Update the cleaned data state
      setCleanedData(newCleanedData);
      console.log('[DataWranglingView] Updated cleaned data state');

      // Re-run consistency checks on the newly cleaned data
      if (config?.id) {
        setCheckingConsistency(true);
        const updatedChecks = await runConsistencyChecks(newCleanedData);
        setCheckingConsistency(false);
        console.log('[DataWranglingView] Checks completed, found:', updatedChecks?.length || 0, 'checks');
      }
    }
  };

  const completedSteps = [
    config?.datasets?.length || 0 > 0 || true, // Structure - always show as available
    Object.keys(config?.missing_data_strategy || {}).length > 0 || true, // Missing data
    config?.consistency_checks?.length || 0 > 0, // Consistency
  ];

  const passedChecks = config?.consistency_checks?.filter(c => c.status === 'passed').length || 0;
  const totalChecks = config?.consistency_checks?.length || 0;

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Data Cleaning
          </h2>
          <p className="text-muted-foreground mt-1">
            Prepare large, messy datasets for analysis — join tables, handle missing values,
            and run quality checks.
          </p>
        </div>

        {/* Multi-stage progress indicator */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {[
                ...(hasMultipleDatasets ? [{ id: "structure", label: "Structure", icon: Database, step: 0 }] : []),
                { id: "missing", label: "Missing Data", icon: AlertCircle, step: hasMultipleDatasets ? 1 : 0 },
                { id: "consistency", label: "Consistency", icon: CheckSquare, step: hasMultipleDatasets ? 2 : 1 },
              ].map((stage, index, arr) => (
                <div 
                  key={stage.id}
                  className={`flex items-center gap-2 cursor-pointer transition-colors ${
                    activeTab === stage.id 
                      ? "text-primary" 
                      : completedSteps[stage.step] 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab(stage.id)}
                >
                  <div className={`p-1.5 rounded-lg ${
                    activeTab === stage.id 
                      ? "bg-primary/10" 
                      : completedSteps[stage.step]
                        ? "bg-success/10"
                        : "bg-muted"
                  }`}>
                    <stage.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium hidden md:inline">{stage.label}</span>
                  {index < arr.length - 1 && (
                    <div className="w-8 h-px bg-border ml-2 hidden md:block" />
                  )}
                </div>
              ))}
            </div>
            
            {totalChecks > 0 && (
              <div className="text-sm text-muted-foreground">
                {passedChecks}/{totalChecks} checks passed
              </div>
            )}
          </div>
        </div>

        {/* Tab content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${hasMultipleDatasets ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {hasMultipleDatasets && (
              <TabsTrigger value="structure" className="gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Structure & Join</span>
                <span className="sm:hidden">Structure</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="missing" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Missing Data</span>
              <span className="sm:hidden">Missing</span>
            </TabsTrigger>
            <TabsTrigger value="consistency" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Consistency</span>
              <span className="sm:hidden">Checks</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {hasMultipleDatasets && (
              <TabsContent value="structure" className="m-0">
                <StructureJoinTab
                  datasets={config?.datasets || []}
                  joinKeys={config?.join_keys || []}
                  joinWarnings={config?.join_warnings || []}
                  availableColumns={columns}
                  onAddDataset={addDataset}
                  onRemoveDataset={removeDataset}
                  onUpdateJoinKeys={handleUpdateJoinKeys}
                />
              </TabsContent>
            )}

            <TabsContent value="missing" className="m-0">
              <MissingDataTab
                columns={columns}
                missingDataStrategy={config?.missing_data_strategy || {}}
                criticalVariables={config?.critical_variables || []}
                optionalVariables={config?.optional_variables || []}
                data={data}
                onUpdateStrategy={handleUpdateMissingStrategy}
                onUpdateCritical={handleUpdateCritical}
                onUpdateOptional={handleUpdateOptional}
              />
            </TabsContent>

            <TabsContent value="consistency" className="m-0">
              <ConsistencyChecksTab
                checks={config?.consistency_checks || []}
                isRunning={checkingConsistency}
                onRunChecks={handleRunConsistencyChecks}
                onSaveLabelStandardization={handleSaveLabelStandardization}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Continue button */}
        <div className="flex justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            <Layers className="h-4 w-4 inline mr-1" />
            Cleaning configurations are saved automatically
          </div>
          <Button onClick={onContinue} className="gap-2">
            Continue to Parse Events
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DataWranglingView;
