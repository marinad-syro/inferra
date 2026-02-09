"""LLM adapter service using XAI SDK."""

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from xai_sdk import AsyncClient
from xai_sdk.chat import file, user

from app.config.settings import settings
from app.models.schemas import LLMProxyResponse, LLMUsage

logger = logging.getLogger(__name__)


class LLMAdapter:
    """Adapter for XAI/Grok using official XAI SDK."""

    def __init__(self):
        """Initialize XAI SDK client."""
        # Check if using placeholder credentials
        if "placeholder" in settings.xai_api_key.lower():
            logger.warning("LLM adapter initialized with placeholder credentials - LLM calls will fail")
            self.client = None
            self.model = settings.xai_model
            self.reasoning_model = settings.xai_reasoning_model
            self.fast_model = settings.xai_fast_model
        else:
            self.client = AsyncClient(
                api_key=settings.xai_api_key,
                timeout=300  # 5 minute timeout
            )
            self.model = settings.xai_model
            self.reasoning_model = settings.xai_reasoning_model
            self.fast_model = settings.xai_fast_model
            logger.info(f"XAI SDK adapter initialized (default model: {self.model})")

        # Simple cache for responses
        self.cache: Dict[str, LLMProxyResponse] = {}
        # File upload cache to avoid re-uploading same file
        self.file_cache: Dict[str, str] = {}

    async def upload_dataset(self, file_path: str) -> str:
        """
        Upload a dataset file to XAI and return file ID.

        Args:
            file_path: Path to dataset file

        Returns:
            File ID for use in chat

        Raises:
            Exception: If upload fails
        """
        if self.client is None:
            raise Exception("XAI client not initialized (placeholder credentials)")

        # Check cache
        if file_path in self.file_cache:
            logger.info(f"Using cached file ID for {file_path}")
            return self.file_cache[file_path]

        try:
            logger.info(f"Uploading dataset: {file_path}")
            uploaded_file = await self.client.files.upload(file_path)
            file_id = uploaded_file.id
            logger.info(f"Dataset uploaded with ID: {file_id}")

            # Cache the file ID
            self.file_cache[file_path] = file_id

            return file_id
        except Exception as e:
            logger.error(f"Failed to upload dataset: {str(e)}")
            raise

    async def delete_file(self, file_id: str) -> None:
        """
        Delete a file from XAI storage.

        Args:
            file_id: File ID to delete
        """
        if self.client is None:
            return

        try:
            await self.client.files.delete(file_id)
            logger.info(f"Deleted file: {file_id}")

            # Remove from cache
            for path, cached_id in list(self.file_cache.items()):
                if cached_id == file_id:
                    del self.file_cache[path]
                    break
        except Exception as e:
            logger.warning(f"Failed to delete file {file_id}: {str(e)}")

    async def call_llm(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        model: Optional[str] = None
    ) -> LLMProxyResponse:
        """
        Call XAI LLM using SDK.

        Args:
            prompt: Prompt to send to LLM
            context: Additional context
            metadata: Request metadata
            max_tokens: Maximum tokens in response
            temperature: LLM temperature
            model: Optional model override

        Returns:
            LLMProxyResponse with response and usage info

        Raises:
            Exception: If API call fails
        """
        if self.client is None:
            raise Exception("XAI client not initialized (placeholder credentials)")

        # Check cache
        cache_key = f"{prompt}:{max_tokens}:{temperature}"
        if cache_key in self.cache:
            logger.info("Returning cached LLM response")
            return self.cache[cache_key]

        # Construct full prompt with context
        full_prompt = prompt
        if context:
            context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
            full_prompt = f"{context_str}\n\n{prompt}"

        # Use specified model or default
        use_model = model or self.model

        try:
            # Create chat
            chat = self.client.chat.create(model=use_model)
            chat.append(user(full_prompt))

            # Measure latency
            import time
            start_time = time.time()

            # Sample response
            response = await chat.sample()

            elapsed_ms = (time.time() - start_time) * 1000

            # Create response object
            usage = LLMUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            )

            llm_response = LLMProxyResponse(
                response=response.content,
                usage=usage,
                latency_ms=elapsed_ms,
                model=use_model
            )

            # Cache response
            self.cache[cache_key] = llm_response

            logger.info(
                f"LLM call successful (latency: {elapsed_ms:.0f}ms, "
                f"tokens: {usage.total_tokens})"
            )

            return llm_response

        except Exception as e:
            logger.error(f"LLM API call failed: {str(e)}")
            raise

    async def call_llm_with_dataset(
        self,
        prompt: str,
        dataset_path: str,
        context: Optional[Dict[str, Any]] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        model: Optional[str] = None
    ) -> LLMProxyResponse:
        """
        Call XAI LLM with dataset file attached.

        This is the key feature - the LLM can see the actual dataset content!

        Args:
            prompt: Prompt to send to LLM
            dataset_path: Path to dataset file (CSV, JSON, etc.)
            context: Additional context
            max_tokens: Maximum tokens in response
            temperature: LLM temperature
            model: Optional model override (defaults to fast_model)

        Returns:
            LLMProxyResponse with response and usage info

        Raises:
            Exception: If API call fails
        """
        if self.client is None:
            raise Exception("XAI client not initialized (placeholder credentials)")

        # Upload dataset
        file_id = await self.upload_dataset(dataset_path)

        # Construct full prompt with context
        full_prompt = prompt
        if context:
            context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
            full_prompt = f"{context_str}\n\n{prompt}"

        # Use fast model by default for file-based queries
        use_model = model or self.fast_model

        try:
            # Create chat
            chat = self.client.chat.create(model=use_model)

            # Append message with file attachment
            chat.append(user(full_prompt, file(file_id)))

            # Measure latency
            import time
            start_time = time.time()

            # Sample response
            response = await chat.sample()

            elapsed_ms = (time.time() - start_time) * 1000

            # Create response object
            usage = LLMUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            )

            llm_response = LLMProxyResponse(
                response=response.content,
                usage=usage,
                latency_ms=elapsed_ms,
                model=use_model
            )

            logger.info(
                f"LLM call with dataset successful (file: {file_id}, "
                f"latency: {elapsed_ms:.0f}ms, tokens: {usage.total_tokens})"
            )

            return llm_response

        except Exception as e:
            logger.error(f"LLM API call with dataset failed: {str(e)}")
            raise

    async def call_reasoning_model(
        self,
        prompt: str,
        reasoning_effort: str = "low",
        context: Optional[Dict[str, Any]] = None,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        Call reasoning model (grok-3-mini) which shows its thinking process.

        Args:
            prompt: Prompt to send to LLM
            reasoning_effort: "low" or "high"
            context: Additional context
            max_tokens: Maximum tokens in response

        Returns:
            Dictionary with reasoning_content, response, and usage
        """
        if self.client is None:
            raise Exception("XAI client not initialized (placeholder credentials)")

        # Construct full prompt with context
        full_prompt = prompt
        if context:
            context_str = "\n".join(f"{k}: {v}" for k, v in context.items())
            full_prompt = f"{context_str}\n\n{prompt}"

        try:
            # Create chat with reasoning model
            chat = self.client.chat.create(
                model=self.reasoning_model,
                reasoning_effort=reasoning_effort
            )
            chat.append(user(full_prompt))

            # Measure latency
            import time
            start_time = time.time()

            # Sample response
            response = await chat.sample()

            elapsed_ms = (time.time() - start_time) * 1000

            result = {
                "reasoning_content": response.reasoning_content,
                "response": response.content,
                "reasoning_tokens": response.usage.reasoning_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
                "latency_ms": elapsed_ms,
                "model": self.reasoning_model
            }

            logger.info(
                f"Reasoning model call successful (latency: {elapsed_ms:.0f}ms, "
                f"reasoning_tokens: {response.usage.reasoning_tokens}, "
                f"total_tokens: {response.usage.total_tokens})"
            )

            return result

        except Exception as e:
            logger.error(f"Reasoning model call failed: {str(e)}")
            raise

    async def get_fallback_decision(
        self,
        prompt: str,
        dataset_schema: Dict[str, Any],
        dataset_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Use LLM (with optional dataset) to provide fallback analysis decision.

        If dataset_path is provided, the LLM will see the actual data,
        leading to much better decisions!

        Args:
            prompt: User's analysis request
            dataset_schema: Dataset schema information
            dataset_path: Optional path to actual dataset file

        Returns:
            Dictionary with suggested library, function, and parameters
        """
        # Construct structured prompt for LLM
        decision_prompt = f"""Given the following analysis request and dataset schema, suggest the most appropriate Python statistical analysis or visualization.

Analysis Request: {prompt}

Dataset Schema:
- Numeric columns: {dataset_schema.get('numeric_columns', [])}
- Categorical columns: {dataset_schema.get('categorical_columns', [])}
- Row count: {dataset_schema.get('row_count', 'unknown')}

{"NOTE: I have access to the actual dataset file you uploaded, so I can see the data values to make a better recommendation." if dataset_path else ""}

Please respond with a JSON object containing:
- library: Python library name (e.g., "scipy.stats", "seaborn", "statsmodels.formula.api")
- function: Function name (e.g., "ttest_ind", "pearsonr", "boxplot")
- param_map: Object mapping parameter names to column names from the dataset (e.g., {{"group_col": "bipolar_disorder_binary", "value_col": "cognitive_control_score"}})
- explanation: Brief explanation of why this analysis is appropriate

For ttest_ind: use param_map with "group_col" (binary categorical) and "value_col" (numeric)
For mannwhitneyu: use param_map with "group_col" (binary categorical) and "value_col" (numeric)
For pearsonr/spearmanr/kendalltau: use "x_col" and "y_col" (both numeric)
For f_oneway: use "group_col" (categorical) and "value_col" (numeric)
For kruskal: use "group_col" (categorical) and "value_col" (numeric)
For chi2_contingency: use "row_col" and "col_col" (both categorical)
For wilcoxon: use "col1" and "col2" (paired numeric columns)

Respond only with valid JSON, no additional text."""

        try:
            # If dataset provided, use file-based call for better context
            if dataset_path:
                response = await self.call_llm_with_dataset(
                    prompt=decision_prompt,
                    dataset_path=dataset_path,
                    max_tokens=500,
                    temperature=0.3  # Lower temperature for more deterministic output
                )
                response_text = response.response
            else:
                response = await self.call_llm(
                    prompt=decision_prompt,
                    max_tokens=500,
                    temperature=0.3
                )
                response_text = response.response

            # Try to parse JSON response
            import json
            try:
                decision_data = json.loads(response_text)
                logger.info(f"LLM fallback decision: {decision_data}")
                return decision_data
            except json.JSONDecodeError:
                logger.warning("Failed to parse LLM response as JSON")
                return {
                    "library": None,
                    "function": None,
                    "explanation": "LLM did not provide a structured response"
                }

        except Exception as e:
            logger.error(f"LLM fallback decision failed: {str(e)}")
            return {
                "library": None,
                "function": None,
                "explanation": f"LLM fallback failed: {str(e)}"
            }

    async def get_fallback_decision_with_reasoning(
        self,
        prompt: str,
        dataset_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Use reasoning model for fallback decision - shows thinking process.

        Args:
            prompt: User's analysis request
            dataset_schema: Dataset schema information

        Returns:
            Dictionary with reasoning, decision, and usage stats
        """
        # Construct structured prompt for reasoning model
        decision_prompt = f"""Given the following analysis request and dataset schema, suggest the most appropriate Python statistical analysis or visualization.

Analysis Request: {prompt}

Dataset Schema:
- Numeric columns: {dataset_schema.get('numeric_columns', [])}
- Categorical columns: {dataset_schema.get('categorical_columns', [])}
- Row count: {dataset_schema.get('row_count', 'unknown')}

Please think through:
1. What type of analysis is being requested?
2. What are the data characteristics (types, relationships)?
3. Which statistical method is most appropriate and why?
4. Are there any assumptions or limitations to consider?

Then suggest:
- library: Python library name (e.g., "scipy.stats", "seaborn")
- function: Function name (e.g., "ttest_ind", "pearsonr")
- explanation: Brief explanation

Format your final answer as JSON."""

        try:
            result = await self.call_reasoning_model(
                prompt=decision_prompt,
                reasoning_effort="high",  # Use high effort for better decisions
                max_tokens=2000
            )

            # Try to parse the final answer as JSON
            import json
            try:
                decision_data = json.loads(result["response"])
                decision_data["reasoning"] = result["reasoning_content"]
                decision_data["reasoning_tokens"] = result["reasoning_tokens"]
                logger.info(f"Reasoning-based fallback decision: {decision_data}")
                return decision_data
            except json.JSONDecodeError:
                logger.warning("Failed to parse reasoning model response as JSON")
                return {
                    "library": None,
                    "function": None,
                    "explanation": "Reasoning model did not provide structured response",
                    "reasoning": result["reasoning_content"]
                }

        except Exception as e:
            logger.error(f"Reasoning-based fallback failed: {str(e)}")
            return {
                "library": None,
                "function": None,
                "explanation": f"Reasoning fallback failed: {str(e)}",
                "reasoning": None
            }

    async def suggest_visualizations(
        self,
        columns: list,
        research_question: Optional[str] = None,
        distribution_type: Optional[str] = None,
        has_outliers: Optional[bool] = None,
        dataset_path: Optional[str] = None
    ) -> list:
        """
        Generate visualization suggestions based on data characteristics and user context.

        Args:
            columns: List of column names from the dataset
            research_question: Optional research question from user
            distribution_type: Optional distribution type (normal, skewed, etc.)
            has_outliers: Optional whether dataset has outliers
            dataset_path: Optional path to dataset for better suggestions

        Returns:
            List of visualization suggestions with plot_type, columns, title, description
        """
        # Build context about the data
        context_parts = [
            f"Dataset columns: {', '.join(columns)}",
        ]

        if research_question:
            context_parts.append(f"Research question: {research_question}")
        if distribution_type:
            context_parts.append(f"Data distribution: {distribution_type}")
        if has_outliers is not None:
            outlier_text = "has outliers" if has_outliers else "no significant outliers"
            context_parts.append(f"Dataset {outlier_text}")

        context = "\n".join(context_parts)

        # Construct visualization suggestion prompt
        viz_prompt = f"""{context}

Suggest 3-5 effective visualizations to explore this data and answer the research question.

Available plot types:
- histogram: Distribution of a single numeric variable with KDE
- scatter: Relationship between two numeric variables
- line: Trend over time or continuous variable
- bar: Comparisons across categories or counts
- boxplot: Distribution summary showing median, quartiles, and outliers
- violin: Distribution shape comparison across categories
- density: Smooth density estimate (KDE plot)
- heatmap: Correlation matrix for multiple numeric variables
- pairplot: Pairwise relationships between multiple variables
- count: Frequency counts for categorical variables
- strip: Individual points for categorical comparisons
- swarm: Non-overlapping points for categorical data

For each visualization, provide:
- plot_type: One of the types listed above
- columns: Array of column names to use (1-3 columns depending on plot type)
  - 1 column: histogram, boxplot, density, bar, count
  - 2 columns: scatter, line, violin, strip, swarm
  - 0-2 columns: heatmap (uses all numeric), pairplot (uses multiple numeric)
- title: Short descriptive title (5-8 words)
- description: Brief explanation of what this visualization reveals (10-15 words)

Respond ONLY with a JSON array of visualization objects. Example format:
[
  {{
    "plot_type": "histogram",
    "columns": ["reaction_time"],
    "title": "Distribution of Reaction Times",
    "description": "Shows the frequency distribution to identify patterns and outliers"
  }},
  {{
    "plot_type": "scatter",
    "columns": ["trial_number", "accuracy"],
    "title": "Accuracy Over Trials",
    "description": "Reveals learning effects or performance changes over time"
  }},
  {{
    "plot_type": "boxplot",
    "columns": ["response_time"],
    "title": "Response Time Distribution Summary",
    "description": "Displays median, quartiles, and potential outliers in response times"
  }}
]"""

        try:
            # If dataset provided, use file-based call for better context
            if dataset_path:
                response = await self.call_llm_with_dataset(
                    prompt=viz_prompt,
                    dataset_path=dataset_path,
                    max_tokens=1500,
                    temperature=0.7
                )
                response_text = response.response
            else:
                response = await self.call_llm(
                    prompt=viz_prompt,
                    max_tokens=1500,
                    temperature=0.7
                )
                response_text = response.response

            # Parse JSON response
            import json
            # Clean markdown code blocks if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            suggestions = json.loads(response_text)

            # Validate suggestions
            if not isinstance(suggestions, list):
                logger.warning("LLM returned non-list for visualization suggestions")
                return []

            # Ensure each suggestion has required fields
            valid_suggestions = []
            for sug in suggestions:
                if all(key in sug for key in ["plot_type", "columns", "title", "description"]):
                    valid_suggestions.append(sug)

            logger.info(f"Generated {len(valid_suggestions)} visualization suggestions")
            return valid_suggestions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM visualization response: {str(e)}")
            logger.error(f"Response text: {response_text[:500]}")
            return []
        except Exception as e:
            logger.error(f"Visualization suggestion failed: {str(e)}")
            return []


# Global LLM adapter instance
llm_adapter = LLMAdapter()
