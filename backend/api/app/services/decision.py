"""Decision service for determining which analysis to run."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

from app.models.schemas import (
    ColumnType,
    DatasetSchema,
    DecisionResult,
    DecisionSource,
    ParameterMapping
)
from app.services.llm_adapter import llm_adapter

logger = logging.getLogger(__name__)


class DecisionService:
    """Service for making analysis decisions using deterministic rules."""

    def __init__(self):
        """Initialize decision service and load rules."""
        self.rules: List[Dict] = []
        self._load_rules()

    def _load_rules(self) -> None:
        """Load deterministic rules from JSON configuration."""
        rules_path = Path(__file__).parent.parent / "config" / "deterministic_rules.json"
        try:
            with open(rules_path, "r") as f:
                data = json.load(f)
                self.rules = data.get("rules", [])
            logger.info(f"Loaded {len(self.rules)} deterministic rules")
        except Exception as e:
            logger.error(f"Failed to load rules: {str(e)}")
            self.rules = []

    def analyze_dataset_schema(self, dataset_schema: DatasetSchema) -> Dict[str, any]:
        """
        Analyze dataset schema conservatively.

        Args:
            dataset_schema: Dataset schema information

        Returns:
            Dictionary with schema analysis
        """
        numeric_cols = [
            col.name for col in dataset_schema.columns
            if col.type == ColumnType.NUMERIC
        ]
        categorical_cols = [
            col.name for col in dataset_schema.columns
            if col.type == ColumnType.CATEGORICAL
        ]

        # Identify potential grouping variables (categorical with reasonable unique count)
        grouping_candidates = []
        for col in dataset_schema.columns:
            if col.type == ColumnType.CATEGORICAL and col.unique_count:
                if 2 <= col.unique_count <= 20:  # Reasonable number of groups
                    grouping_candidates.append(col.name)

        analysis = {
            "numeric_count": len(numeric_cols),
            "categorical_count": len(categorical_cols),
            "has_group_column": len(grouping_candidates) > 0,
            "grouping_candidates": grouping_candidates,
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols
        }

        logger.debug(f"Schema analysis: {analysis}")
        return analysis

    def match_rules(
        self,
        prompt: str,
        schema_analysis: Dict[str, any]
    ) -> List[Dict]:
        """
        Match rules against prompt and schema.

        Args:
            prompt: Natural language analysis request
            schema_analysis: Result from analyze_dataset_schema

        Returns:
            List of matching rules with confidence scores
        """
        prompt_lower = prompt.lower()
        matches = []

        for rule in self.rules:
            # Check match terms
            term_matches = sum(
                1 for term in rule.get("match_terms", [])
                if term.lower() in prompt_lower
            )

            if term_matches == 0:
                continue

            # Check schema requirements
            required = rule.get("required_schema", {})
            schema_match = True

            # Check minimum numeric columns
            min_numeric = required.get("min_numeric_columns", 0)
            if schema_analysis["numeric_count"] < min_numeric:
                schema_match = False
                logger.debug(
                    f"Rule {rule['id']} rejected: insufficient numeric columns "
                    f"(need {min_numeric}, have {schema_analysis['numeric_count']})"
                )

            # Check group column requirement
            needs_group = required.get("has_group_column", False)
            if needs_group and not schema_analysis["has_group_column"]:
                schema_match = False
                logger.debug(f"Rule {rule['id']} rejected: no grouping column")

            if not schema_match:
                continue

            # Calculate confidence based on term matches
            max_terms = len(rule.get("match_terms", []))
            confidence = min(term_matches / max_terms, 1.0) if max_terms > 0 else 0.5

            matches.append({
                "rule": rule,
                "confidence": confidence,
                "term_matches": term_matches
            })

        # Sort by confidence (descending)
        matches.sort(key=lambda x: x["confidence"], reverse=True)

        logger.info(f"Found {len(matches)} matching rules for prompt")
        return matches

    def select_best_rule(self, matched_rules: List[Dict]) -> Optional[Dict]:
        """
        Select the best rule from matches.

        Returns a rule only if there's exactly one clear match.
        Returns None if no matches or ambiguous.

        Args:
            matched_rules: List of matched rules with confidence scores

        Returns:
            Selected rule or None
        """
        if len(matched_rules) == 0:
            logger.info("No rules matched")
            return None

        if len(matched_rules) == 1:
            logger.info(f"Single rule matched: {matched_rules[0]['rule']['id']}")
            return matched_rules[0]["rule"]

        # Check if top match is significantly better than others
        top_match = matched_rules[0]
        second_match = matched_rules[1]

        confidence_gap = top_match["confidence"] - second_match["confidence"]

        if confidence_gap >= 0.2:  # Significant gap
            logger.info(
                f"Clear top match: {top_match['rule']['id']} "
                f"(confidence: {top_match['confidence']:.2f} vs {second_match['confidence']:.2f})"
            )
            return top_match["rule"]

        # Ambiguous - multiple good matches
        logger.info(
            f"Ambiguous match: top candidates are {top_match['rule']['id']} "
            f"and {second_match['rule']['id']} with similar confidence"
        )
        return None

    async def get_decision(
        self,
        prompt: str,
        dataset_schema: Optional[DatasetSchema] = None,
        dataset_path: Optional[str] = None,
        use_reasoning: bool = False
    ) -> DecisionResult:
        """
        Get analysis decision for a prompt and dataset.

        Uses deterministic rules first, then falls back to LLM if no rules match.

        Args:
            prompt: Natural language analysis request
            dataset_schema: Dataset schema information (optional)
            dataset_path: Optional path to dataset file for LLM fallback
            use_reasoning: Use reasoning model for fallback (shows thinking process)

        Returns:
            DecisionResult with analysis recommendation
        """
        # Analyze schema (skip if not provided)
        if dataset_schema is not None:
            schema_analysis = self.analyze_dataset_schema(dataset_schema)
        else:
            # No schema provided - use empty analysis (will skip to LLM)
            logger.info("No dataset schema provided, will use LLM for decision")
            schema_analysis = {
                "numeric_count": 0,
                "categorical_count": 0,
                "has_group_column": False,
                "grouping_candidates": [],
                "numeric_columns": [],
                "categorical_columns": []
            }

        # Match rules
        matched_rules = self.match_rules(prompt, schema_analysis)

        # Select best rule
        best_rule = self.select_best_rule(matched_rules)

        if best_rule is None:
            # No deterministic rule matched - try LLM fallback
            logger.info("No deterministic rule matched, attempting LLM fallback")

            try:
                # Prepare schema dict for LLM
                schema_dict = {
                    "numeric_columns": schema_analysis["numeric_columns"],
                    "categorical_columns": schema_analysis["categorical_columns"],
                    "row_count": dataset_schema.row_count if dataset_schema else None
                }

                # Use reasoning model if requested
                if use_reasoning:
                    logger.info("Using reasoning model for fallback decision")
                    llm_decision = await llm_adapter.get_fallback_decision_with_reasoning(
                        prompt=prompt,
                        dataset_schema=schema_dict
                    )
                    # Add reasoning to explanation
                    explanation = llm_decision.get("explanation", "")
                    if llm_decision.get("reasoning"):
                        explanation += f"\n\nReasoning: {llm_decision['reasoning'][:500]}..."
                else:
                    # Use standard LLM with optional dataset
                    llm_decision = await llm_adapter.get_fallback_decision(
                        prompt=prompt,
                        dataset_schema=schema_dict,
                        dataset_path=dataset_path
                    )
                    explanation = llm_decision.get("explanation", "")

                # Check if LLM provided a valid decision
                if llm_decision.get("library") and llm_decision.get("function"):
                    logger.info(
                        f"LLM fallback decision: {llm_decision['library']}.{llm_decision['function']}"
                    )

                    # Parse param_map from LLM response
                    param_map = {}
                    if llm_decision.get("param_map"):
                        for param_name, column_name in llm_decision["param_map"].items():
                            param_map[param_name] = ParameterMapping(
                                type="column_name",
                                column=column_name
                            )

                    return DecisionResult(
                        rule_id=None,
                        library=llm_decision["library"],
                        function=llm_decision["function"],
                        param_map=param_map,
                        confidence=0.6,  # Lower confidence for LLM decisions
                        source=DecisionSource.LLM,
                        explanation=explanation
                    )
                else:
                    # LLM also couldn't decide
                    logger.warning("LLM fallback did not provide a valid decision")
                    return DecisionResult(
                        rule_id=None,
                        library=None,
                        function=None,
                        param_map=None,
                        confidence=0.0,
                        source=DecisionSource.NONE,
                        explanation=f"No deterministic rule matched and LLM fallback was inconclusive. {explanation}"
                    )

            except Exception as e:
                logger.error(f"LLM fallback failed: {str(e)}")
                return DecisionResult(
                    rule_id=None,
                    library=None,
                    function=None,
                    param_map=None,
                    confidence=0.0,
                    source=DecisionSource.NONE,
                    explanation=f"No deterministic rule matched and LLM fallback failed: {str(e)}"
                )

        # Convert param_map to ParameterMapping objects
        param_map = {}
        for param_name, param_hint in best_rule.get("param_map", {}).items():
            param_map[param_name] = ParameterMapping(**param_hint)

        # Get confidence from matched rule
        confidence = next(
            (m["confidence"] for m in matched_rules if m["rule"]["id"] == best_rule["id"]),
            0.8
        )

        return DecisionResult(
            rule_id=best_rule["id"],
            library=best_rule["library"],
            function=best_rule["function"],
            param_map=param_map,
            confidence=confidence,
            source=DecisionSource.DETERMINISTIC,
            explanation=best_rule.get("explanation")
        )


# Global decision service instance
decision_service = DecisionService()
