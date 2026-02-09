interface DataTableProps {
  data: Record<string, unknown>[];
  columns: string[];
  highlightEvent?: string;
}

const DataTable = ({ data, columns, highlightEvent }: DataTableProps) => {
  // Use provided columns or derive from data - show ALL columns with horizontal scroll
  const displayColumns = columns.length > 0 
    ? columns 
    : data.length > 0 
      ? Object.keys(data[0]) 
      : ['#', 'event_type', 'timestamp_ms', 'trial_num', 'stimulus', 'response'];

  // If no data, show sample data
  const displayData = data.length > 0 ? data : [
    { id: 1, event_type: "ons_ms1", timestamp_ms: 0, trial_num: 1, stimulus: "A" },
    { id: 2, event_type: "stim_on", timestamp_ms: 250, trial_num: 1, stimulus: "A" },
    { id: 3, event_type: "response", timestamp_ms: 487, trial_num: 1, stimulus: "A", response: "left" },
    { id: 4, event_type: "feedback", timestamp_ms: 550, trial_num: 1, stimulus: "A" },
    { id: 5, event_type: "ons_ms1", timestamp_ms: 1500, trial_num: 2, stimulus: "B" },
    { id: 6, event_type: "stim_on", timestamp_ms: 1750, trial_num: 2, stimulus: "B" },
    { id: 7, event_type: "response", timestamp_ms: 2103, trial_num: 2, stimulus: "B", response: "right" },
    { id: 8, event_type: "feedback", timestamp_ms: 2180, trial_num: 2, stimulus: "B" },
    { id: 9, event_type: "ons_ms1", timestamp_ms: 3200, trial_num: 3, stimulus: "A" },
    { id: 10, event_type: "stim_on", timestamp_ms: 3450, trial_num: 3, stimulus: "A" },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--table-border))]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(var(--table-header))]">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
              {displayColumns.map((col) => (
                <th key={col} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card">
            {displayData.map((row, index) => {
              const isHighlighted = highlightEvent && row.event_type === highlightEvent;
              return (
                <tr
                  key={index}
                  className={`border-t border-[hsl(var(--table-border))] transition-colors ${
                    isHighlighted ? "data-table-highlight" : "hover:bg-muted/30"
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  {displayColumns.map((col) => (
                    <td key={col} className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                      <span className={isHighlighted && col === 'event_type' ? "text-primary font-medium" : ""}>
                        {String(row[col] ?? '—')}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
