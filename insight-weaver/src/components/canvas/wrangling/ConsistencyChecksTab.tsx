import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronRight, FileSearch } from "lucide-react";
import { ConsistencyCheck } from "@/hooks/useDataWrangling";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import InconsistencyResolver, { InconsistencyGroup } from "./InconsistencyResolver";
import { toast } from "sonner";

interface ConsistencyChecksTabProps {
  checks: ConsistencyCheck[];
  isRunning?: boolean;
  onRunChecks: () => void;
  onSaveLabelStandardization?: (resolutions: Record<string, Record<string, string>>) => void;
}

const ConsistencyChecksTab = ({
  checks,
  isRunning = false,
  onRunChecks,
  onSaveLabelStandardization,
}: ConsistencyChecksTabProps) => {
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [resolvingCheck, setResolvingCheck] = useState<ConsistencyCheck | null>(null);
  const resolverRef = useRef<HTMLDivElement>(null);

  // Sample checks for demo
  const sampleChecks: ConsistencyCheck[] = checks.length > 0 ? checks : [
    { 
      id: "dup_subject_id", 
      name: "Duplicate subject IDs", 
      description: "Check for duplicate values in subject_id column",
      status: "passed",
      details: "All 120 subject IDs are unique"
    },
    { 
      id: "neg_rt", 
      name: "Negative reaction times", 
      description: "Check for impossible negative values in RT column",
      status: "failed",
      details: "Found 3 rows with negative RT values",
      affectedRows: 3
    },
    { 
      id: "outlier_rt", 
      name: "Extreme reaction times", 
      description: "Check for outlier RTs (>3 SD from mean)",
      status: "warning",
      details: "Found 12 trials with RT > 3 SD from mean",
      affectedRows: 12
    },
    { 
      id: "missing_sessions", 
      name: "Missing sessions", 
      description: "Check for subjects with incomplete session data",
      status: "warning",
      details: "5 subjects are missing session 3 data",
      affectedRows: 5
    },
    { 
      id: "label_condition", 
      name: "Inconsistent condition labels", 
      description: "Check for case-inconsistent category labels",
      status: "passed",
      details: "All condition labels are consistent"
    },
    { 
      id: "range_accuracy", 
      name: "Accuracy values in valid range", 
      description: "Check that accuracy is between 0 and 1",
      status: "passed",
      details: "All accuracy values are within [0, 1]"
    },
    { 
      id: "trial_count", 
      name: "Expected trial counts", 
      description: "Check that each subject has expected number of trials",
      status: "warning",
      details: "3 subjects have fewer than expected trials (< 100)",
      affectedRows: 3
    },
  ];

  const toggleExpanded = (checkId: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  };

  const handleResolve = (check: ConsistencyCheck) => {
    console.log('[ConsistencyChecksTab] Resolve clicked for check:', check.id);
    console.log('[ConsistencyChecksTab] Inconsistencies:', check.inconsistencies);

    // Validate that inconsistencies exist and are valid
    if (!check.inconsistencies || !Array.isArray(check.inconsistencies)) {
      toast.error("No inconsistency data available for this check");
      console.error('[ConsistencyChecksTab] Invalid inconsistencies:', check.inconsistencies);
      return;
    }

    if (check.inconsistencies.length === 0) {
      toast.error("No inconsistencies to resolve");
      return;
    }

    setResolvingCheck(check);
  };

  // Scroll to resolver when it opens
  useEffect(() => {
    if (resolvingCheck && resolverRef.current) {
      setTimeout(() => {
        resolverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [resolvingCheck]);

  const handleResolveComplete = async (resolutions: Record<string, Record<string, string>>) => {
    console.log('[ConsistencyChecksTab] Resolutions submitted:', resolutions);

    if (onSaveLabelStandardization) {
      toast.success("Applying label standardization...");
      await onSaveLabelStandardization(resolutions);
      toast.success("Label standardization applied! Checks updated.");
    }

    setResolvingCheck(null);
  };

  const handleCancelResolve = () => {
    setResolvingCheck(null);
  };

  const getStatusIcon = (status: ConsistencyCheck['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'failed': return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: ConsistencyCheck['status']) => {
    switch (status) {
      case 'passed': 
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Passed</Badge>;
      case 'warning': 
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Needs Review</Badge>;
      case 'failed': 
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Failed</Badge>;
    }
  };

  const passedCount = sampleChecks.filter(c => c.status === 'passed').length;
  const warningCount = sampleChecks.filter(c => c.status === 'warning').length;
  const failedCount = sampleChecks.filter(c => c.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Intro text */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Automated data quality diagnostics.</span>{" "}
          Run consistency checks to identify common data issues like duplicates, impossible values,
          and inconsistent labels before proceeding with analysis.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{sampleChecks.length}</p>
                <p className="text-xs text-muted-foreground">Total Checks</p>
              </div>
              <FileSearch className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-success/5 border-success/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-success">{passedCount}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-warning">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-destructive">{failedCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run checks button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium">Diagnostic Results</h3>
          <p className="text-sm text-muted-foreground">
            {sampleChecks.length} checks completed
          </p>
        </div>
        <Button onClick={onRunChecks} disabled={isRunning}>
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-run Checks
            </>
          )}
        </Button>
      </div>

      {/* Check results list */}
      <Card>
        <CardContent className="pt-4 divide-y">
          {sampleChecks.map((check) => (
            <Collapsible
              key={check.id}
              open={expandedChecks.has(check.id)}
              onOpenChange={() => toggleExpanded(check.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 -mx-4 px-4 transition-colors">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <div className="font-medium text-sm">{check.name}</div>
                      <div className="text-xs text-muted-foreground">{check.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.affectedRows !== undefined && check.affectedRows > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {check.affectedRows} rows
                      </Badge>
                    )}
                    {getStatusBadge(check.status)}
                    {expandedChecks.has(check.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="py-3 pl-11 pr-4 bg-muted/20 -mx-4 px-4 text-sm">
                  <p className="text-muted-foreground">{check.details}</p>
                  {check.status !== 'passed' && (
                    <div className="mt-3 flex gap-2">
                      {check.inconsistencies && check.inconsistencies.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleResolve(check)}
                        >
                          Resolve Inconsistencies
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {(warningCount > 0 || failedCount > 0) && (
        <Card className="bg-info/5 border-info/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {failedCount > 0 && (
              <p className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span>
                  <strong>Critical issues found.</strong> The {failedCount} failed check(s) indicate data problems
                  that should be resolved before analysis. Review the affected rows and apply fixes.
                </span>
              </p>
            )}
            {warningCount > 0 && (
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span>
                  <strong>Potential issues detected.</strong> The {warningCount} warning(s) may or may not require action.
                  Review each case to determine if correction is needed for your specific analysis goals.
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inconsistency Resolver */}
      {resolvingCheck && resolvingCheck.inconsistencies && resolvingCheck.inconsistencies.length > 0 && (
        <div ref={resolverRef} className="mt-6">
          <InconsistencyResolver
            inconsistencies={resolvingCheck.inconsistencies}
            onResolve={handleResolveComplete}
            onCancel={handleCancelResolve}
          />
        </div>
      )}
    </div>
  );
};

export default ConsistencyChecksTab;
