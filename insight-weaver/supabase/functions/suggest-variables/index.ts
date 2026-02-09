import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SuggestedVariable {
  name: string;
  formula: string;
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sampleRows, columns, researchQuestion } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a data analysis assistant specializing in behavioral research data. 
Your task is to analyze the provided data columns and sample rows, then suggest derived variables that would be useful for analysis.

For each variable, provide:
- name: A clear, descriptive name
- formula: A pseudo-code formula showing how to compute it
- description: A brief explanation of what it measures

Focus on common behavioral metrics like:
- Reaction times (RT) between events
- Accuracy/error rates
- Choice patterns
- Performance metrics
- Aggregated measures

IMPORTANT: Order your suggestions by relevance. If a research question is provided, ensure the first 1-2 suggestions are directly relevant to answering that research question. The remaining suggestions can be general-purpose behavioral metrics.

Return your suggestions as a JSON array of objects with name, formula, and description fields.
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

    console.log('Requesting variable suggestions from AI...');
    
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
