import jStat from 'jstat';

// Descriptive statistics
export const mean = (data: number[]): number => {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
};

export const std = (data: number[], ddof: number = 1): number => {
  if (data.length <= ddof) return 0;
  const m = mean(data);
  const squaredDiffs = data.map(x => Math.pow(x - m, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (data.length - ddof));
};

export const variance = (data: number[], ddof: number = 1): number => {
  return Math.pow(std(data, ddof), 2);
};

export const median = (data: number[]): number => {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const min = (data: number[]): number => Math.min(...data);
export const max = (data: number[]): number => Math.max(...data);

// Standard error of mean
export const sem = (data: number[]): number => {
  return std(data) / Math.sqrt(data.length);
};

// Confidence interval for mean
export const confidenceInterval = (data: number[], confidence: number = 0.95): [number, number] => {
  const n = data.length;
  const m = mean(data);
  const se = sem(data);
  const alpha = 1 - confidence;
  const tCrit = jStat.studentt.inv(1 - alpha / 2, n - 1);
  return [m - tCrit * se, m + tCrit * se];
};

// One-sample t-test
export interface TTestResult {
  tStatistic: number;
  pValue: number;
  degreesOfFreedom: number;
  meanDifference: number;
  confidenceInterval: [number, number];
  significant: boolean;
}

export const tTestOneSample = (data: number[], populationMean: number = 0, alpha: number = 0.05): TTestResult => {
  const n = data.length;
  const m = mean(data);
  const se = sem(data);
  const df = n - 1;
  const t = (m - populationMean) / se;
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const ci = confidenceInterval(data, 1 - alpha);
  
  return {
    tStatistic: t,
    pValue,
    degreesOfFreedom: df,
    meanDifference: m - populationMean,
    confidenceInterval: ci,
    significant: pValue < alpha,
  };
};

// Independent samples t-test (two-sample)
export interface TTestTwoSampleResult {
  tStatistic: number;
  pValue: number;
  degreesOfFreedom: number;
  meanDifference: number;
  cohensD: number;
  significant: boolean;
}

export const tTestIndependent = (group1: number[], group2: number[], alpha: number = 0.05): TTestTwoSampleResult => {
  const n1 = group1.length;
  const n2 = group2.length;
  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = variance(group1);
  const v2 = variance(group2);
  
  // Welch's t-test (does not assume equal variances)
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;
  
  // Welch-Satterthwaite degrees of freedom
  const num = Math.pow(v1 / n1 + v2 / n2, 2);
  const denom = Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1);
  const df = num / denom;
  
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  
  // Cohen's d effect size
  const pooledStd = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const cohensD = (m1 - m2) / pooledStd;
  
  return {
    tStatistic: t,
    pValue,
    degreesOfFreedom: df,
    meanDifference: m1 - m2,
    cohensD,
    significant: pValue < alpha,
  };
};

// Paired t-test
export const tTestPaired = (before: number[], after: number[], alpha: number = 0.05): TTestResult => {
  if (before.length !== after.length) {
    throw new Error('Paired samples must have equal length');
  }
  const differences = before.map((b, i) => after[i] - b);
  return tTestOneSample(differences, 0, alpha);
};

// One-way ANOVA
export interface AnovaResult {
  fStatistic: number;
  pValue: number;
  dfBetween: number;
  dfWithin: number;
  ssBetween: number;
  ssWithin: number;
  msBetween: number;
  msWithin: number;
  etaSquared: number;
  significant: boolean;
}

export const anovaOneWay = (groups: number[][], alpha: number = 0.05): AnovaResult => {
  const allData = groups.flat();
  const grandMean = mean(allData);
  const n = allData.length;
  const k = groups.length;
  
  // Between-group sum of squares
  let ssBetween = 0;
  groups.forEach(group => {
    const groupMean = mean(group);
    ssBetween += group.length * Math.pow(groupMean - grandMean, 2);
  });
  
  // Within-group sum of squares
  let ssWithin = 0;
  groups.forEach(group => {
    const groupMean = mean(group);
    group.forEach(x => {
      ssWithin += Math.pow(x - groupMean, 2);
    });
  });
  
  const dfBetween = k - 1;
  const dfWithin = n - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msBetween / msWithin;
  const pValue = 1 - jStat.centralF.cdf(f, dfBetween, dfWithin);
  const etaSquared = ssBetween / (ssBetween + ssWithin);
  
  return {
    fStatistic: f,
    pValue,
    dfBetween,
    dfWithin,
    ssBetween,
    ssWithin,
    msBetween,
    msWithin,
    etaSquared,
    significant: pValue < alpha,
  };
};

// Pearson correlation
export interface CorrelationResult {
  r: number;
  pValue: number;
  rSquared: number;
  significant: boolean;
}

export const pearsonCorrelation = (x: number[], y: number[], alpha: number = 0.05): CorrelationResult => {
  if (x.length !== y.length) {
    throw new Error('Arrays must have equal length');
  }
  const n = x.length;
  const r = jStat.corrcoeff(x, y);
  
  // t-test for correlation significance
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(t), n - 2));
  
  return {
    r,
    pValue,
    rSquared: r * r,
    significant: pValue < alpha,
  };
};

// Linear regression
export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  standardErrorSlope: number;
  standardErrorIntercept: number;
  tStatisticSlope: number;
  pValueSlope: number;
  fStatistic: number;
  pValueF: number;
}

export const linearRegression = (x: number[], y: number[]): RegressionResult => {
  if (x.length !== y.length) {
    throw new Error('Arrays must have equal length');
  }
  const n = x.length;
  const xMean = mean(x);
  const yMean = mean(y);
  
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - xMean) * (y[i] - yMean);
    ssXX += Math.pow(x[i] - xMean, 2);
    ssYY += Math.pow(y[i] - yMean, 2);
  }
  
  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  
  // Residual sum of squares
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    ssResidual += Math.pow(y[i] - predicted, 2);
  }
  
  const rSquared = 1 - ssResidual / ssYY;
  const mse = ssResidual / (n - 2);
  const standardErrorSlope = Math.sqrt(mse / ssXX);
  const standardErrorIntercept = Math.sqrt(mse * (1 / n + Math.pow(xMean, 2) / ssXX));
  const tStatisticSlope = slope / standardErrorSlope;
  const pValueSlope = 2 * (1 - jStat.studentt.cdf(Math.abs(tStatisticSlope), n - 2));
  
  // F-statistic for regression
  const ssRegression = ssYY - ssResidual;
  const fStatistic = (ssRegression / 1) / (ssResidual / (n - 2));
  const pValueF = 1 - jStat.centralF.cdf(fStatistic, 1, n - 2);
  
  return {
    slope,
    intercept,
    rSquared,
    standardErrorSlope,
    standardErrorIntercept,
    tStatisticSlope,
    pValueSlope,
    fStatistic,
    pValueF,
  };
};

// Shapiro-Wilk test approximation (for normality testing)
export interface NormalityResult {
  wStatistic: number;
  pValue: number;
  isNormal: boolean;
}

export const testNormality = (data: number[], alpha: number = 0.05): NormalityResult => {
  // Use D'Agostino-Pearson test approximation via skewness and kurtosis
  const n = data.length;
  const m = mean(data);
  const s = std(data, 0);
  
  let skewness = 0, kurtosis = 0;
  for (const x of data) {
    skewness += Math.pow((x - m) / s, 3);
    kurtosis += Math.pow((x - m) / s, 4);
  }
  skewness /= n;
  kurtosis = kurtosis / n - 3; // Excess kurtosis
  
  // Jarque-Bera test statistic
  const jb = n * (Math.pow(skewness, 2) / 6 + Math.pow(kurtosis, 2) / 24);
  const pValue = 1 - jStat.chisquare.cdf(jb, 2);
  
  return {
    wStatistic: jb, // Note: This is JB stat, not W
    pValue,
    isNormal: pValue >= alpha,
  };
};

// Histogram binning (Freedman-Diaconis rule or Sturges)
export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binCenter: number;
  count: number;
  density: number;
}

export const histogram = (data: number[], numBins?: number): HistogramBin[] => {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => a - b);
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  
  // Freedman-Diaconis rule for optimal bin width
  if (!numBins) {
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const binWidth = 2 * iqr * Math.pow(data.length, -1/3);
    numBins = binWidth > 0 ? Math.ceil((maxVal - minVal) / binWidth) : 10;
    numBins = Math.max(5, Math.min(numBins, 50)); // Clamp between 5-50 bins
  }
  
  const binWidth = (maxVal - minVal) / numBins;
  const bins: HistogramBin[] = [];
  
  for (let i = 0; i < numBins; i++) {
    const binStart = minVal + i * binWidth;
    const binEnd = binStart + binWidth;
    bins.push({
      binStart,
      binEnd,
      binCenter: (binStart + binEnd) / 2,
      count: 0,
      density: 0,
    });
  }
  
  // Count values in each bin
  for (const value of data) {
    let binIndex = Math.floor((value - minVal) / binWidth);
    if (binIndex === numBins) binIndex = numBins - 1; // Include max value in last bin
    if (binIndex >= 0 && binIndex < numBins) {
      bins[binIndex].count++;
    }
  }
  
  // Calculate density
  const totalArea = data.length * binWidth;
  for (const bin of bins) {
    bin.density = bin.count / totalArea;
  }
  
  return bins;
};

// Format p-value for display
export const formatPValue = (p: number): string => {
  if (p < 0.001) return '< 0.001';
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
};

// Format number with appropriate precision
export const formatNumber = (n: number, decimals: number = 3): string => {
  if (Math.abs(n) < 0.001 && n !== 0) {
    return n.toExponential(2);
  }
  return n.toFixed(decimals);
};
