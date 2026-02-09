import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export interface InconsistencyGroup {
  column: string;
  variations: Array<{
    value: string;
    count: number;
  }>;
}

interface InconsistencyResolverProps {
  inconsistencies: InconsistencyGroup[];
  onResolve: (resolutions: Record<string, Record<string, string>>) => void;
  onCancel: () => void;
}

const InconsistencyResolver = ({ inconsistencies, onResolve, onCancel }: InconsistencyResolverProps) => {
  console.log('[InconsistencyResolver] Rendering with inconsistencies:', inconsistencies);

  // State: for each column, map variations to their standardized form
  const [resolutions, setResolutions] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};

    // Safety check: ensure inconsistencies is an array
    if (!Array.isArray(inconsistencies)) {
      console.error('InconsistencyResolver: inconsistencies is not an array', inconsistencies);
      return initial;
    }

    inconsistencies.forEach(group => {
      // Ensure group has required fields
      if (!group || !group.column || !Array.isArray(group.variations)) {
        console.warn('InconsistencyResolver: Invalid group', group);
        return;
      }
      // Group by lowercase to find case variations
      const lowercaseMap = new Map<string, Array<{ value: string; count: number }>>();

      group.variations.forEach(v => {
        // Ensure value exists and is a string
        if (!v || v.value === undefined || v.value === null) {
          console.warn('InconsistencyResolver: Invalid variation', v);
          return;
        }
        const valueStr = String(v.value).trim();
        // Skip empty strings
        if (valueStr === '') {
          console.warn('InconsistencyResolver: Skipping empty string variation', v);
          return;
        }
        const key = valueStr.toLowerCase();
        if (!lowercaseMap.has(key)) {
          lowercaseMap.set(key, []);
        }
        lowercaseMap.get(key)!.push({ ...v, value: valueStr });
      });

      // For each group of case variations, default to the most common one
      initial[group.column] = {};

      lowercaseMap.forEach((variants) => {
        if (variants.length > 1) {
          // Sort by count descending
          const sorted = [...variants].sort((a, b) => b.count - a.count);
          const standard = String(sorted[0]?.value || '');

          // Map all variants to the most common one
          variants.forEach(v => {
            const valueStr = String(v.value);
            initial[group.column][valueStr] = standard;
          });
        }
      });
    });

    return initial;
  });

  const handleChangeStandard = (column: string, variant: string, newStandard: string) => {
    setResolutions(prev => ({
      ...prev,
      [column]: {
        ...prev[column],
        [variant]: newStandard
      }
    }));
  };

  const handleApply = () => {
    onResolve(resolutions);
  };

  // Group variations by their standard value for display
  const getGroupedVariations = (column: string, variations: Array<{ value: string; count: number }>) => {
    const groups = new Map<string, Array<{ value: string; count: number }>>();

    variations.forEach(v => {
      // Ensure we always have a valid string value
      const valueStr = String(v.value || '').trim();

      // Skip empty values
      if (valueStr === '') {
        console.warn('getGroupedVariations: Skipping empty value', v);
        return;
      }

      const standard = resolutions[column]?.[valueStr] || valueStr;
      if (!groups.has(standard)) {
        groups.set(standard, []);
      }
      groups.get(standard)!.push({ ...v, value: valueStr });
    });

    return Array.from(groups.entries());
  };

  const totalInconsistencies = inconsistencies.reduce(
    (sum, group) => sum + (group.variations?.length || 0),
    0
  );

  // Early return if no inconsistencies
  if (!Array.isArray(inconsistencies) || inconsistencies.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Resolve Inconsistent Labels
              </CardTitle>
              <CardDescription className="mt-2">
                Found {totalInconsistencies} label variations across {inconsistencies.length} column
                {inconsistencies.length === 1 ? '' : 's'}. Choose how to standardize them.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {inconsistencies
            .filter(group => group && group.column && Array.isArray(group.variations) && group.variations.length > 0)
            .map((group) => {
              const groupedVariations = getGroupedVariations(group.column, group.variations);

              return (
                <div key={group.column} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm font-mono">
                    {group.column}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {group.variations.length} variations found
                  </span>
                </div>

                <div className="space-y-3 pl-4 border-l-2 border-border">
                  {groupedVariations.map(([standard, variants], groupIndex) => {
                    // Safety check
                    if (!variants || !Array.isArray(variants) || variants.length === 0) {
                      console.warn('InconsistencyResolver: Invalid variants for group', groupIndex);
                      return null;
                    }

                    return (
                    <div key={groupIndex} className="bg-muted/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            Group {groupIndex + 1}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {variants.reduce((sum, v) => sum + v.count, 0)} total rows
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Standardize to:</span>
                          <Select
                            value={String(standard || '')}
                            onValueChange={(newStandard) => {
                              // Update all variants in this group to the new standard
                              variants.forEach(v => {
                                handleChangeStandard(group.column, String(v.value), newStandard);
                              });
                            }}
                          >
                            <SelectTrigger className="w-[200px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {variants
                                .filter(v => v.value !== null && v.value !== undefined && String(v.value).trim() !== '')
                                .map((v, idx) => {
                                  const valueStr = String(v.value).trim();
                                  return (
                                    <SelectItem key={`${valueStr}-${idx}`} value={valueStr}>
                                      {valueStr} ({v.count} rows)
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {variants
                          .filter(v => v.value !== null && v.value !== undefined && String(v.value).trim() !== '')
                          .map((v, vIdx) => {
                            const valueStr = String(v.value).trim();
                            return (
                              <div
                                key={`${valueStr}-${vIdx}`}
                                className={`px-3 py-1.5 rounded-md text-xs font-mono border ${
                                  valueStr === standard
                                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                                    : 'bg-background border-border text-muted-foreground'
                                }`}
                              >
                                {valueStr}
                                <span className="ml-2 text-xs opacity-70">({v.count})</span>
                                {valueStr === standard && (
                                  <CheckCircle2 className="inline ml-1.5 h-3 w-3" />
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              All changes will be applied when you run your analysis
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleApply}>
                Apply Standardization
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InconsistencyResolver;
