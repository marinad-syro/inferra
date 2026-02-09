import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisResult {
  title: string;
  analysisType: string;
  description?: string;
  parameters: { name: string; value: string; interpretation?: string }[];
  metrics: { name: string; value: string; highlight?: boolean }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { result, researchContext } = await req.json() as {
      result: AnalysisResult;
      researchContext?: {
        researchQuestion?: string;
        distributionType?: string;
        hasOutliers?: boolean;
      };
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for interpretation
    const parametersText = result.parameters
      .map(p => `${p.name}: ${p.value}${p.interpretation ? ` (${p.interpretation})` : ''}`)
      .join('\n');
    
    const metricsText = result.metrics
      .map(m => `${m.name}: ${m.value}${m.highlight ? ' [significant]' : ''}`)
      .join('\n');

    const systemPrompt = `You are a statistician providing clear, accessible interpretations of statistical results for behavioral psychology researchers.

Your interpretations should:
1. Explain what the numbers mean in plain language
2. Describe the practical significance, not just statistical significance
3. Note any caveats or limitations
4. Suggest what this might mean for the research question
5. Be concise (2-3 paragraphs max)

Avoid jargon where possible, but use proper statistical terminology when needed.`;

    const userPrompt = `Please interpret these statistical results:

**Analysis:** ${result.title}
${result.description ? `\n**Description:** ${result.description}` : ''}

**Parameters:**
${parametersText || 'None computed'}

**Test Results:**
${metricsText || 'None computed'}

${researchContext?.researchQuestion ? `\n**Research Question:** ${researchContext.researchQuestion}` : ''}
${researchContext?.distributionType ? `\n**Data Distribution:** ${researchContext.distributionType}` : ''}
${researchContext?.hasOutliers ? '\n**Note:** Data contains outliers' : ''}

Provide a clear interpretation of these results for a behavioral psychology researcher.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate interpretation");
    }

    const data = await response.json();
    const interpretation = data.choices?.[0]?.message?.content || "Unable to generate interpretation.";

    return new Response(
      JSON.stringify({ interpretation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in interpret-results:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
