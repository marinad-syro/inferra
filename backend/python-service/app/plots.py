"""Plotting utilities using seaborn."""

import logging
from pathlib import Path
from typing import Dict

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

logger = logging.getLogger(__name__)

# Configure seaborn style
sns.set_theme(style="whitegrid")

# Output directory - use temp dir for local development, /app/outputs/plots for Docker
import os
OUTPUT_DIR = Path(os.getenv("PLOT_OUTPUT_DIR", "/tmp/inferra/plots"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def create_plot(
    function: str,
    dataset: pd.DataFrame,
    params: Dict[str, str],
    job_id: str
) -> str:
    """
    Create a plot using seaborn.

    Args:
        function: Seaborn function name
        dataset: DataFrame to plot
        params: Parameter mapping
        job_id: Job ID for filename

    Returns:
        Path to saved plot file
    """
    # Create figure
    plt.figure(figsize=(10, 6))

    if function == "boxplot":
        x = params.get("x")
        y = params.get("y")
        sns.boxplot(data=dataset, x=x, y=y)
        plt.title(f"Box Plot: {y} by {x}")

    elif function == "scatterplot":
        x = params.get("x")
        y = params.get("y")
        hue = params.get("hue")
        if hue:
            sns.scatterplot(data=dataset, x=x, y=y, hue=hue)
        else:
            sns.scatterplot(data=dataset, x=x, y=y)
        plt.title(f"Scatter Plot: {y} vs {x}")

    elif function == "histplot":
        x = params.get("x")
        sns.histplot(data=dataset, x=x, bins=30)
        plt.title(f"Histogram: {x}")

    elif function == "kdeplot":
        x = params.get("x")
        hue = params.get("hue")
        if hue:
            sns.kdeplot(data=dataset, x=x, hue=hue, fill=True)
        else:
            sns.kdeplot(data=dataset, x=x, fill=True)
        plt.title(f"Kernel Density: {x}")

    elif function == "regplot":
        x = params.get("x")
        y = params.get("y")
        sns.regplot(data=dataset, x=x, y=y)
        plt.title(f"Regression Plot: {y} vs {x}")

    else:
        raise ValueError(f"Unsupported plot function: {function}")

    # Save plot
    output_path = OUTPUT_DIR / f"{job_id}_{function}.png"
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches='tight')
    plt.close()

    logger.info(f"Saved plot to {output_path}")
    return str(output_path)
