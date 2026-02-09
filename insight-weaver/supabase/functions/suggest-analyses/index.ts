import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SuggestedAnalysis {
  id: string;
  title: string;
  description: string;
  complexity: 'Basic' | 'Intermediate' | 'Advanced';
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      columns, 
      sampleRows, 
      researchQuestion, 
      distributionType, 
      hasOutliers,
      derivedVariables,
      trialsDetected 
    } = await req.json();
    
    console.log('Received context:', { 
      columns: columns?.length, 
      sampleRows: sampleRows?.length, 
      researchQuestion,
      derivedVariables: derivedVariables?.length,
      trialsDetected
    });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a statistical methods expert for behavioral research. 
Your task is to recommend appropriate analysis methods based on the data structure, research question, and available derived variables.

For each recommendation, provide:
- id: A unique snake_case identifier
- title: The analysis method name
- description: A brief explanation of what the method does
- complexity: One of "Basic", "Intermediate", or "Advanced"
- reasoning: Why this method is appropriate for this specific data

Consider factors like:
- Data distribution (normal vs non-normal)
- Sample size and trial counts
- Whether it's a trial-based experiment
- The research question's nature (if provided)
- Available derived variables and what they measure
- Presence of repeated measures
- Need for hierarchical modeling

IMPORTANT: If a research question is provided, make sure at least 2 of your recommendations directly address it. If derived variables are available, recommend analyses that utilize them.

Return exactly 4 analysis recommendations as a JSON array.
Only return the JSON array, no other text.`;

    // Build derived variables context with formulas
    const derivedVarsContext = derivedVariables && derivedVariables.length > 0
      ? `\n\nDerived variables created by user:\n${derivedVariables.map((v: { name: string; formula?: string }) => 
          `- ${v.name}${v.formula ? ` (formula: ${v.formula})` : ''}`
        ).join('\n')}`
      : '';
    
    const researchContext = researchQuestion 
      ? `Research question: "${researchQuestion}"\nIMPORTANT: At least 2 of your recommendations should directly help answer this research question.`
      : 'Research question: Not specified';

    const userPrompt = `Recommend 4 appropriate analysis methods for this behavioral research data.

Data columns: ${columns.join(', ')}
Row count: ${sampleRows?.length || 0} sample rows provided

Sample data structure:
${JSON.stringify(sampleRows?.slice(0, 5), null, 2)}

Research context:
- ${researchContext}
- Data distribution: ${distributionType || 'Unknown'}
- Known outliers: ${hasOutliers ? 'Yes' : 'No or unknown'}
- Trials detected: ${trialsDetected || 'N/A (non-trial data)'}${derivedVarsContext}

Recommend 4 appropriate statistical analysis methods, ranging from basic to advanced. Make sure recommendations leverage the derived variables if available. Return only a JSON array.`;

    console.log('Requesting analysis suggestions from AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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
    let suggestions: SuggestedAnalysis[] = [];
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

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('suggest-analyses error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
