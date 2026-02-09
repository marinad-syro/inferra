FROM rocker/r-ver:4.3.0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('plumber', 'dplyr', 'tidyr', 'jsonlite', 'ggplot2', 'httr'), repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Create app directory
WORKDIR /app

# Copy application files
COPY app/ /app/

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD Rscript -e "httr::GET('http://localhost:8002/health')" || exit 1

# Run plumber API
CMD ["R", "-e", "pr <- plumber::plumb('/app/main.R'); pr$run(host='0.0.0.0', port=8002)"]
