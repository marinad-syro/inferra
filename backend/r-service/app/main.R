# Inferra R Service - Plumber API
# Code execution service for R transformations

library(plumber)
library(dplyr)
library(tidyr)
library(jsonlite)
library(httr)

#* @apiTitle Inferra R Service
#* @apiDescription Execute R code for data transformations and analyses

#* Health check
#* @get /health
function() {
  list(
    status = "healthy",
    service = "inferra-r-service",
    version = "1.0.0",
    timestamp = Sys.time()
  )
}

#* Execute R code
#* @post /execute-code
#* @serializer unboxedJSON
function(req, res) {
  # Parse request body
  body <- req$postBody
  request <- tryCatch({
    fromJSON(body, simplifyVector = FALSE)
  }, error = function(e) {
    res$status <- 400
    return(list(
      success = FALSE,
      error = paste("Invalid JSON:", as.character(e))
    ))
  })

  code <- request$code
  session_id <- request$session_id %||% NULL
  dataset_reference <- request$dataset_reference %||% NULL

  # Validate code (basic security checks)
  dangerous_patterns <- c(
    "system\\s*\\(",
    "file\\.",
    "readLines\\s*\\(",
    "writeLines\\s*\\(",
    "source\\s*\\(",
    "Sys\\.setenv",
    "setwd\\s*\\(",
    "unlink\\s*\\(",
    "download\\.file"
  )

  for (pattern in dangerous_patterns) {
    if (grepl(pattern, code, ignore.case = TRUE)) {
      res$status <- 403
      return(list(
        success = FALSE,
        error = paste("Forbidden function detected:", pattern)
      ))
    }
  }

  # Load dataset if provided
  df <- NULL
  if (!is.null(dataset_reference)) {
    tryCatch({
      # Load CSV file
      if (grepl("\\.csv$", dataset_reference, ignore.case = TRUE)) {
        df <- read.csv(dataset_reference, stringsAsFactors = FALSE)
      } else if (grepl("\\.json$", dataset_reference, ignore.case = TRUE)) {
        df <- fromJSON(dataset_reference)
      } else {
        # Try CSV by default
        df <- read.csv(dataset_reference, stringsAsFactors = FALSE)
      }
      message("Loaded dataset: ", nrow(df), " rows, ", ncol(df), " columns")
    }, error = function(e) {
      res$status <- 500
      return(list(
        success = FALSE,
        error = paste("Failed to load dataset:", as.character(e))
      ))
    })
  }

  # Create isolated environment with base R as parent
  # This provides operators like <-, +, -, etc.
  env <- new.env(parent = baseenv())

  # Set df in environment
  env$df <- df

  # dplyr functions
  env$`%>%` <- dplyr::`%>%`
  env$mutate <- dplyr::mutate
  env$select <- dplyr::select
  env$filter <- dplyr::filter
  env$arrange <- dplyr::arrange
  env$group_by <- dplyr::group_by
  env$summarise <- dplyr::summarise
  env$summarize <- dplyr::summarize
  env$rename <- dplyr::rename
  env$slice <- dplyr::slice
  env$pull <- dplyr::pull
  env$count <- dplyr::count
  env$distinct <- dplyr::distinct
  env$left_join <- dplyr::left_join
  env$right_join <- dplyr::right_join
  env$inner_join <- dplyr::inner_join
  env$full_join <- dplyr::full_join
  env$anti_join <- dplyr::anti_join
  env$semi_join <- dplyr::semi_join
  env$case_when <- dplyr::case_when
  env$recode <- dplyr::recode
  env$n <- dplyr::n
  env$row_number <- dplyr::row_number

  # tidyr functions
  env$pivot_longer <- tidyr::pivot_longer
  env$pivot_wider <- tidyr::pivot_wider
  env$drop_na <- tidyr::drop_na
  env$replace_na <- tidyr::replace_na
  env$fill <- tidyr::fill
  env$separate <- tidyr::separate
  env$unite <- tidyr::unite

  # Basic R functions needed for data manipulation
  env$c <- c
  env$list <- list
  env$data.frame <- data.frame
  env$as.data.frame <- as.data.frame
  env$names <- names
  env$nrow <- nrow
  env$ncol <- ncol
  env$head <- head
  env$tail <- tail
  env$summary <- summary
  env$str <- str
  env$length <- length
  env$mean <- mean
  env$median <- median
  env$sd <- sd
  env$var <- var
  env$min <- min
  env$max <- max
  env$sum <- sum
  env$log <- log
  env$exp <- exp
  env$sqrt <- sqrt
  env$abs <- abs
  env$round <- round
  env$floor <- floor
  env$ceiling <- ceiling
  env$is.na <- is.na
  env$na.omit <- na.omit
  env$complete.cases <- complete.cases
  env$table <- table
  env$cut <- cut
  env$ifelse <- ifelse
  env$paste <- paste
  env$paste0 <- paste0
  env$gsub <- gsub
  env$sub <- sub
  env$grepl <- grepl
  env$grep <- grep
  env$tolower <- tolower
  env$toupper <- toupper
  env$trimws <- trimws

  # Add data loading/saving functions (placeholders for now)
  env$load_dataset_version <- function(session_id, version_id = NULL) {
    # TODO: Implement actual data loading from storage
    # For now, return empty data frame
    message("Loading dataset for session: ", session_id)
    data.frame()
  }

  env$save_dataset_version <- function(session_id, df, parent_version_id = NULL) {
    # TODO: Implement actual data saving to storage
    message("Saving dataset for session: ", session_id)
    message("Rows: ", nrow(df), ", Columns: ", ncol(df))
    invisible(NULL)
  }

  # === Transformation Library Functions ===
  # R equivalents of Python TransformationLibrary functions

  env$map_binary <- function(df, column, mapping) {
    # Map categorical values to binary (0/1)
    df[[column]] <- mapping[as.character(df[[column]])]
    return(df[[column]])
  }

  env$map_categorical <- function(df, column, mapping) {
    # Map categorical values to other values
    df[[column]] <- mapping[as.character(df[[column]])]
    return(df[[column]])
  }

  env$normalize <- function(df, column, min_val = 0, max_val = 1) {
    # Min-max normalization
    col <- df[[column]]

    # Check if column is numeric
    if (!is.numeric(col)) {
      stop(paste0("Column '", column, "' must be numeric for normalization. Found type: ", class(col)[1]))
    }

    col_min <- min(col, na.rm = TRUE)
    col_max <- max(col, na.rm = TRUE)
    if (col_max == col_min) {
      return(rep(min_val, length(col)))
    }
    normalized <- (col - col_min) / (col_max - col_min)
    return(min_val + normalized * (max_val - min_val))
  }

  env$z_score <- function(df, column) {
    # Z-score normalization (standardization)
    col <- df[[column]]
    mean_val <- mean(col, na.rm = TRUE)
    sd_val <- sd(col, na.rm = TRUE)
    if (sd_val == 0) {
      return(rep(0, length(col)))
    }
    return((col - mean_val) / sd_val)
  }

  env$composite_score <- function(df, columns, weights = NULL, normalize_first = TRUE) {
    # Calculate weighted composite score

    # Validate columns are numeric
    for (column in columns) {
      col <- df[[column]]
      if (!is.numeric(col)) {
        stop(paste0("Column '", column, "' must be numeric for composite score. Found type: ", class(col)[1]))
      }
    }

    if (is.null(weights)) {
      weights <- rep(1.0 / length(columns), length(columns))
    }
    weights <- weights / sum(weights)

    result <- rep(0, nrow(df))
    for (i in seq_along(columns)) {
      col <- df[[columns[i]]]
      if (normalize_first) {
        col_min <- min(col, na.rm = TRUE)
        col_max <- max(col, na.rm = TRUE)
        if (col_max != col_min) {
          col <- (col - col_min) / (col_max - col_min)
        }
      }
      result <- result + weights[i] * col
    }
    return(result)
  }

  env$conditional_value <- function(df, condition_col, condition_val, true_val, false_val) {
    # Apply conditional logic
    return(ifelse(df[[condition_col]] == condition_val, true_val, false_val))
  }

  env$conditional_numeric <- function(df, condition_col, operator, threshold, true_val, false_val) {
    # Apply numeric conditional logic
    col <- df[[condition_col]]
    condition <- switch(operator,
      ">" = col > threshold,
      "<" = col < threshold,
      ">=" = col >= threshold,
      "<=" = col <= threshold,
      "==" = col == threshold,
      "!=" = col != threshold,
      stop("Invalid operator")
    )
    return(ifelse(condition, true_val, false_val))
  }

  env$percentile_rank <- function(df, column) {
    # Calculate percentile rank (0-100)
    col <- df[[column]]
    return(rank(col, na.last = "keep") / sum(!is.na(col)) * 100)
  }

  env$bin_numeric <- function(df, column, bins, labels = NULL) {
    # Bin numeric values into categories
    return(cut(df[[column]], breaks = bins, labels = labels, include.lowest = TRUE))
  }

  env$log_transform <- function(df, column, base = exp(1)) {
    # Apply logarithmic transformation
    col <- df[[column]]
    if (any(col <= 0, na.rm = TRUE)) {
      stop("Cannot apply log transform to column containing non-positive values")
    }
    return(log(col, base = base))
  }

  env$winsorize <- function(df, column, lower_percentile = 5, upper_percentile = 95) {
    # Winsorize (cap) extreme values
    col <- df[[column]]
    lower_val <- quantile(col, lower_percentile / 100, na.rm = TRUE)
    upper_val <- quantile(col, upper_percentile / 100, na.rm = TRUE)
    col[col < lower_val] <- lower_val
    col[col > upper_val] <- upper_val
    return(col)
  }

  # Preprocess code to remove library imports (they're already loaded)
  code_lines <- strsplit(code, "\n")[[1]]
  processed_lines <- sapply(code_lines, function(line) {
    trimmed <- trimws(line)
    # Comment out library() and require() calls for packages we already provide
    if (grepl("^library\\s*\\(\\s*(dplyr|tidyr|ggplot2|stats|base)", trimmed, ignore.case = TRUE) ||
        grepl("^require\\s*\\(\\s*(dplyr|tidyr|ggplot2|stats|base)", trimmed, ignore.case = TRUE)) {
      paste0("# ", line)
    } else {
      line
    }
  }, USE.NAMES = FALSE)
  processed_code <- paste(processed_lines, collapse = "\n")

  # Execute code with error handling and timeout
  result <- tryCatch({
    # Set timeout (30 seconds)
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)

    # Parse and evaluate code
    parsed_code <- parse(text = processed_code)
    eval(parsed_code, envir = env)

    # Reset timeout
    setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE)

    # Extract the modified dataframe
    df <- env$df
    if (is.null(df)) {
      stop("Code must define 'df' variable with the result")
    }

    if (!is.data.frame(df)) {
      stop("Variable 'df' must be a data frame")
    }

    # Convert data frame to JSON-friendly format
    dataset_json <- toJSON(df, dataframe = "rows", na = "null")
    dataset_list <- fromJSON(dataset_json, simplifyVector = FALSE)

    list(
      success = TRUE,
      row_count = nrow(df),
      column_names = colnames(df),
      column_types = sapply(df, class),
      dataset = dataset_list
    )
  }, error = function(e) {
    # Reset timeout in case of error
    setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE)

    res$status <- 500
    list(
      success = FALSE,
      error = as.character(e),
      traceback = capture.output(traceback())
    )
  })

  return(result)
}

#* Echo test endpoint for debugging
#* @post /echo
#* @serializer unboxedJSON
function(req) {
  list(
    method = req$REQUEST_METHOD,
    path = req$PATH_INFO,
    body = req$postBody,
    headers = as.list(req$HEADERS)
  )
}
