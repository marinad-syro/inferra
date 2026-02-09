# Setup script for R Service
# Install all required packages

cat("Installing R packages for Inferra R Service...\n\n")

packages <- c(
  'plumber',
  'dplyr',
  'tidyr',
  'jsonlite',
  'ggplot2',
  'httr'
)

for (pkg in packages) {
  if (!require(pkg, character.only = TRUE)) {
    cat(paste("Installing", pkg, "...\n"))
    install.packages(pkg, repos = 'https://cloud.r-project.org/')
  } else {
    cat(paste(pkg, "is already installed\n"))
  }
}

cat("\n✓ All packages installed successfully!\n")
cat("\nYou can now run the R service with:\n")
cat("R -e \"pr <- plumber::plumb('app/main.R'); pr$run(host='0.0.0.0', port=8002)\"\n")
