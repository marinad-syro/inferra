import { toast } from "sonner";

interface AnalysisResult {
  analysisType: string;
  title: string;
  description?: string;
  parameters: { name: string; value: string; interpretation?: string }[];
  metrics: { name: string; value: string; highlight?: boolean }[];
  interpretation?: string;
}

// Convert parameters/metrics to stats object for export
const resultToStats = (result: AnalysisResult): Record<string, number | string> => {
  const stats: Record<string, number | string> = {};
  result.parameters.forEach(p => {
    stats[p.name] = p.value;
  });
  result.metrics.forEach(m => {
    stats[m.name] = m.value;
  });
  return stats;
};

// Export results as CSV
export const exportAsCSV = (results: AnalysisResult[], columns: string[]) => {
  if (results.length === 0) {
    toast.error("No results to export");
    return;
  }

  // Build CSV content
  let csvContent = "Analysis Type,Title,Description,Statistic,Value\n";
  
  results.forEach(result => {
    const stats = resultToStats(result);
    Object.entries(stats).forEach(([stat, value]) => {
      const escapedTitle = `"${(result.title || '').replace(/"/g, '""')}"`;
      const escapedDesc = `"${(result.description || '').replace(/"/g, '""')}"`;
      csvContent += `${result.analysisType},${escapedTitle},${escapedDesc},${stat},${value}\n`;
    });
  });

  // Add columns summary
  csvContent += "\n\nColumns Used\n";
  columns.forEach(col => {
    csvContent += `${col}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `behaviorlab_results_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success("Results exported as CSV");
};

// Export results as JSON
export const exportAsJSON = (
  results: AnalysisResult[], 
  columns: string[],
  metadata?: {
    trialCount?: number;
    researchQuestion?: string;
  }
) => {
  if (results.length === 0) {
    toast.error("No results to export");
    return;
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    metadata: {
      columnsUsed: columns,
      analysisCount: results.length,
      ...metadata,
    },
    results: results.map(r => ({
      analysisType: r.analysisType,
      title: r.title,
      description: r.description,
      parameters: r.parameters,
      metrics: r.metrics,
      interpretation: r.interpretation,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `behaviorlab_results_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success("Results exported as JSON");
};

interface DerivedVariable {
  name: string;
  formula: string;
  formula_type: string;
  description?: string;
}

interface DatasetPreview {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface VisualizationConfig {
  id: string;
  title: string;
  description: string;
  plotType: string;
  columns: string[];
}

// Export comprehensive PDF report with dataset, variables, analyses, and visualizations
export const exportAsPDF = (
  results: AnalysisResult[],
  columns: string[],
  options?: {
    datasetPreview?: DatasetPreview;
    derivedVariables?: DerivedVariable[];
    visualizations?: VisualizationConfig[];
  }
) => {
  if (results.length === 0 && (!options?.visualizations || options.visualizations.length === 0)) {
    toast.error("No results or visualizations to export");
    return;
  }

  // Build dataset preview section
  const datasetPreviewHTML = options?.datasetPreview ? `
    <h2>1. Dataset Preview</h2>
    <div class="section-card">
      <p class="section-desc">First ${Math.min(5, options.datasetPreview.rows.length)} rows of ${options.datasetPreview.rows.length} total rows</p>
      <table class="data-table">
        <thead>
          <tr>
            ${options.datasetPreview.columns.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${options.datasetPreview.rows.slice(0, 5).map(row => `
            <tr>
              ${options.datasetPreview.columns.map(col => `<td>${row[col] ?? ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  // Build derived variables section
  const derivedVariablesHTML = options?.derivedVariables && options.derivedVariables.length > 0 ? `
    <h2>2. Derived Variables</h2>
    <div class="section-card">
      <p class="section-desc">${options.derivedVariables.length} custom variable${options.derivedVariables.length === 1 ? '' : 's'} created</p>
      ${options.derivedVariables.map(v => `
        <div class="variable-card">
          <div class="variable-name">${v.name}</div>
          <div class="variable-formula"><strong>Formula:</strong> <code>${v.formula}</code></div>
          <div class="variable-type"><strong>Type:</strong> ${v.formula_type}</div>
          ${v.description ? `<div class="variable-desc">${v.description}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Build analyses section
  const analysesHTML = results.length > 0 ? `
    <h2>${options?.derivedVariables ? '3' : options?.datasetPreview ? '2' : '1'}. Statistical Analyses</h2>
    <div class="section-desc">${results.length} analysis${results.length === 1 ? '' : 'es'} performed</div>
    ${results.map(result => `
      <div class="result-card">
        <div class="result-title">${result.title}</div>
        <div class="result-desc">${result.description || ''}</div>
        <div class="stats-grid">
          ${result.parameters.map(p => `
            <div class="stat-item">
              <div class="stat-label">${p.name}</div>
              <div class="stat-value">${p.value}</div>
              ${p.interpretation ? `<div class="stat-interp">${p.interpretation}</div>` : ''}
            </div>
          `).join('')}
          ${result.metrics.map(m => `
            <div class="stat-item ${m.highlight ? 'stat-highlight' : ''}">
              <div class="stat-label">${m.name}</div>
              <div class="stat-value">${m.value}</div>
            </div>
          `).join('')}
        </div>
        ${result.interpretation ? `
          <div class="interpretation">
            <strong>Interpretation:</strong> ${result.interpretation}
          </div>
        ` : ''}
      </div>
    `).join('')}
  ` : '';

  // Build visualizations section
  const visualizationsHTML = options?.visualizations && options.visualizations.length > 0 ? `
    <h2>${[options?.datasetPreview, options?.derivedVariables, results.length > 0].filter(Boolean).length + 1}. Data Visualizations</h2>
    <div class="section-card">
      <p class="section-desc">${options.visualizations.length} visualization${options.visualizations.length === 1 ? '' : 's'} included</p>
      ${options.visualizations.map(viz => `
        <div class="viz-card">
          <div class="viz-title">${viz.title}</div>
          <div class="viz-desc">${viz.description}</div>
          <div class="viz-meta">
            <span class="viz-type">${viz.plotType}</span>
            <span class="viz-columns">Columns: ${viz.columns.join(', ')}</span>
          </div>
        </div>
      `).join('')}
      <p class="viz-note">Note: Charts are rendered in the application. For full visual output, use screenshot or export from the visualization panel.</p>
    </div>
  ` : '';

  // Build columns section (only if we have analyses)
  const columnsHTML = results.length > 0 && columns.length > 0 ? `
    <h2>Columns Used in Analyses</h2>
    <div class="columns-list">
      ${columns.map(col => `<span class="column-tag">${col}</span>`).join('')}
    </div>
  ` : '';

  // Create a printable HTML document
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Inferra Analysis Report</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          max-width: 900px;
          margin: 0 auto;
          color: #1a1a1a;
        }
        h1 {
          font-size: 28px;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 12px;
          margin-bottom: 10px;
        }
        h2 {
          font-size: 20px;
          margin-top: 40px;
          margin-bottom: 15px;
          color: #3b82f6;
          page-break-after: avoid;
        }
        .meta {
          color: #666;
          font-size: 14px;
          margin-bottom: 40px;
        }
        .section-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .section-desc {
          color: #666;
          font-size: 14px;
          margin-bottom: 15px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 10px;
        }
        .data-table th {
          background: #e0f2fe;
          color: #0369a1;
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          border: 1px solid #bae6fd;
        }
        .data-table td {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          background: white;
        }
        .data-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .variable-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
        }
        .variable-name {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 6px;
          color: #0369a1;
        }
        .variable-formula {
          font-size: 13px;
          margin-bottom: 4px;
        }
        .variable-formula code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        .variable-type {
          font-size: 13px;
          color: #666;
          margin-bottom: 4px;
        }
        .variable-desc {
          font-size: 13px;
          color: #666;
          margin-top: 8px;
          font-style: italic;
        }
        .result-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .result-title {
          font-weight: 600;
          font-size: 17px;
          margin-bottom: 8px;
          color: #1e40af;
        }
        .result-desc {
          color: #666;
          font-size: 14px;
          margin-bottom: 15px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 15px;
        }
        .stat-item {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
          text-align: center;
        }
        .stat-item.stat-highlight {
          background: #fef3c7;
          border-color: #fbbf24;
        }
        .stat-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 18px;
          font-weight: 600;
          font-family: 'Courier New', monospace;
        }
        .stat-interp {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
        }
        .columns-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .column-tag {
          background: #e0f2fe;
          color: #0369a1;
          padding: 5px 14px;
          border-radius: 20px;
          font-size: 13px;
        }
        .interpretation {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 14px 18px;
          margin-top: 15px;
          font-size: 14px;
          line-height: 1.6;
        }
        .viz-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
        }
        .viz-title {
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 6px;
          color: #0369a1;
        }
        .viz-desc {
          font-size: 13px;
          color: #666;
          margin-bottom: 8px;
        }
        .viz-meta {
          font-size: 12px;
          color: #666;
          display: flex;
          gap: 15px;
        }
        .viz-type {
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 3px;
          font-weight: 500;
        }
        .viz-note {
          font-size: 12px;
          color: #666;
          font-style: italic;
          margin-top: 15px;
          padding: 10px;
          background: #f8fafc;
          border-radius: 4px;
        }
        @media print {
          body { padding: 20px; }
          .result-card, .variable-card, .viz-card, .section-card {
            break-inside: avoid;
          }
          h2 { break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Inferra Analysis Report</h1>
      <div class="meta">
        Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
      </div>

      ${datasetPreviewHTML}
      ${derivedVariablesHTML}
      ${analysesHTML}
      ${visualizationsHTML}
      ${columnsHTML}
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
    toast.success("Comprehensive report opened for printing");
  } else {
    toast.error("Failed to open print window. Please check popup blocker settings.");
  }
};
