import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SuggestedVariable {
  name: string;
  formula: string;
  formula_type?: string;
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sampleRows, columns, researchQuestion } = await req.json();
    
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    if (!XAI_API_KEY) {
      throw new Error('XAI_API_KEY is not configured');
    }

    const systemPrompt = `You are a data analysis assistant specializing in behavioral research data.
Your task is to analyze the provided data columns and sample rows, then suggest derived variables that would be useful for analysis.

FORMULA TYPES:
1. **Multi-line Python formulas** - You can write multiple lines! This allows you to map categorical→numeric, then compute composites in ONE variable.
2. The last line or 'result' variable will be assigned to the new column

AVAILABLE TRANSFORMATION FUNCTIONS:
- map_binary(df, column, mapping_dict) - Convert categorical to 0/1
  Example: map_binary(df, 'Status', {'Yes': 1, 'No': 0})
- map_categorical(df, column, mapping_dict) - Convert categorical to numeric
  Example: map_categorical(df, 'Emotion', {'Sad': 1, 'Neutral': 2, 'Happy': 3})
- composite_score(df, columns_list) - Weighted average of numeric columns (auto-normalizes)
  Example: composite_score(df, ['score1', 'score2', 'score3'])
- normalize(df, column) - Scale numeric column 0-1
- z_score(df, column) - Standardize numeric column
- For basic math: df['col1'] + df['col2'], np.log(df['col']), etc.

MULTI-LINE FORMULA EXAMPLE for composite of categorical columns:
  sadness = map_binary(df, 'Sadness', {'Usually': 1, 'Sometimes': 0.5, 'Seldom': 0})
  exhausted = map_binary(df, 'Exhausted', {'Usually': 1, 'Sometimes': 0.5, 'Seldom': 0})
  sleep_issues = map_binary(df, 'Sleep dissorder', {'Yes': 1, 'No': 0})
  result = composite_score(df, [sadness, exhausted, sleep_issues])

IMPORTANT RULES:
1. Check sample data to identify column types (strings → categorical, numbers → numeric)
2. For composite scores of categorical data, use multi-line formulas to map first
3. Always pass 'df' as first argument to transformation functions
4. The last expression or 'result =' becomes the column value

For each variable, provide:
- name: A clear, descriptive name
- formula: Python code (can be multi-line)
- formula_type: MUST be "python" for multi-line formulas, "transform" for single-line transformation functions, or "eval" for simple math
- description: A brief explanation of what it measures

**CRITICAL**: If your formula contains multiple lines or uses variables (like sadness = ...), you MUST set formula_type: "python"

Order suggestions by relevance. If a research question is provided, ensure the first 1-2 suggestions directly address it.

Return your suggestions as a JSON array of objects with name, formula, formula_type, and description fields.
Only return the JSON array, no other text.`;

    const userPrompt = researchQuestion 
      ? `Analyze this data and suggest 3-5 useful derived variables.

Research Question: "${researchQuestion}"

IMPORTANT: Your first 1-2 variable suggestions should be directly relevant to answering the research question above. The remaining suggestions can be general behavioral metrics.

Columns: ${columns.join(', ')}

Sample data (first rows):
${JSON.stringify(sampleRows.slice(0, 20), null, 2)}

Return only a JSON array.`
      : `Analyze this data and suggest 3-5 useful derived variables.

Columns: ${columns.join(', ')}

Sample data (first rows):
${JSON.stringify(sampleRows.slice(0, 20), null, 2)}

Suggest derived variables that would help analyze this behavioral data. Return only a JSON array.`;

    console.log('Requesting variable suggestions from XAI Grok...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '[]';
    
    console.log('AI response content:', content);
    
    // Parse the JSON response
    let suggestions: SuggestedVariable[] = [];
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      suggestions = [];
    }

    // Post-process suggestions to ensure correct formula_type
    suggestions = suggestions.map(s => {
      // If formula_type not set or if formula contains newlines/multiple lines, set to "python"
      if (!s.formula_type || s.formula.includes('\n') || /^[a-zA-Z_]\w*\s*=/.test(s.formula)) {
        return { ...s, formula_type: 'python' };
      }
      return s;
    });

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('suggest-variables error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
