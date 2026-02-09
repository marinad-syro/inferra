# Inferra R Service

R code execution service using Plumber for data transformations and statistical analyses.

## Features

- Execute R code in sandboxed environment
- Support for dplyr, tidyr, and stats operations
- Safe code validation (blocks dangerous functions)
- 30-second execution timeout
- JSON API compatible with Python service

## API Endpoints

### Health Check
```
GET /health
```

Returns service status and version information.

### Execute Code
```
POST /execute-code
Content-Type: application/json

{
  "code": "df <- df %>% mutate(new_col = old_col * 2)",
  "session_id": "optional-session-id",
  "dataset_reference": "optional-dataset-ref"
}
```

**Response:**
```json
{
  "success": true,
  "row_count": 100,
  "column_names": ["col1", "col2", "new_col"],
  "column_types": {"col1": "numeric", "col2": "character", "new_col": "numeric"},
  "dataset": [...]
}
```

## Running Locally

### With Docker
```bash
docker build -t inferra-r-service .
docker run -p 8002:8002 inferra-r-service
```

### Without Docker (requires R 4.3+)
```bash
# Install dependencies
R -e "install.packages(c('plumber', 'dplyr', 'tidyr', 'jsonlite', 'ggplot2', 'httr'), repos='https://cloud.r-project.org/')"

# Run service
R -e "pr <- plumber::plumb('app/main.R'); pr$run(host='0.0.0.0', port=8002)"
```

## Testing

```bash
# Health check
curl http://localhost:8002/health

# Execute simple R code
curl -X POST http://localhost:8002/execute-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "df <- data.frame(x=1:5, y=6:10)\ndf <- df %>% mutate(z = x + y)"
  }'
```

## Security

The service implements several security measures:

- **Code validation**: Blocks dangerous functions (system, file operations, etc.)
- **Sandboxed execution**: Code runs in isolated environment
- **Resource limits**: 30-second timeout, limited memory
- **No file system access**: Cannot read/write files outside container
- **No network access**: Cannot make external API calls (except internal services)

## Forbidden Operations

The following operations are blocked for security:
- `system()`, `system2()`
- File operations: `file.`, `readLines()`, `writeLines()`
- `source()`, `Sys.setenv()`
- `setwd()`, `unlink()`
- `download.file()`

## Supported Libraries

- **dplyr**: Data manipulation (`mutate`, `filter`, `select`, `group_by`, etc.)
- **tidyr**: Data tidying (`pivot_longer`, `pivot_wider`, `drop_na`, etc.)
- **stats**: Statistical functions (`t.test`, `chisq.test`, `lm`, etc.)
- **base**: Core R functions (math, string manipulation, etc.)

## Example Transformations

### Label Standardization
```r
df <- df %>%
  mutate(emotion = recode(emotion, 'sadness' = 'Sadness', 'excitement' = 'Excitement'))
```

### Missing Data Handling
```r
# Drop missing
df <- df %>% drop_na(reaction_time)

# Impute with mean
df <- df %>%
  mutate(age = replace_na(age, mean(age, na.rm=TRUE)))
```

### Derived Variables
```r
# Log transformation
df <- df %>% mutate(rt_log = log(reaction_time))

# Categorization
df <- df %>%
  mutate(age_group = cut(age, breaks=c(0, 30, 50, 100),
                         labels=c('Young', 'Middle', 'Senior')))
```

## Development

The service follows the same architecture as the Python service:
1. Receive code via POST request
2. Validate code for dangerous operations
3. Execute in sandboxed environment
4. Return results or error

To add new safe functions, update the `env$` assignments in `main.R`.

## Integration with API

The main API service routes requests to this service based on the `language` parameter:
- `language: "python"` → Python service (port 8001)
- `language: "r"` → R service (port 8002)
