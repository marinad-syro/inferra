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

  # Create isolated environment
  env <- new.env(parent = emptyenv())

  # Load safe libraries into environment
  env$dplyr <- dplyr
  env$tidyr <- tidyr
  env$stats <- stats
  env$base <- base
  env$`%>%` <- dplyr::`%>%`

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

  # Execute code with error handling and timeout
  result <- tryCatch({
    # Set timeout (30 seconds)
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)

    # Parse and evaluate code
    parsed_code <- parse(text = code)
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
