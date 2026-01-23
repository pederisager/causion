const DEFAULT_EPSILON = 1e-10;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function getSampleValue(sample, key) {
  if (!sample) return NaN;
  if (sample.values && Object.prototype.hasOwnProperty.call(sample.values, key)) {
    return sample.values[key];
  }
  if (Object.prototype.hasOwnProperty.call(sample, key)) {
    return sample[key];
  }
  return NaN;
}

function solveLinearSystem(matrix, vector, epsilon = DEFAULT_EPSILON) {
  const size = matrix.length;
  if (!size) return null;
  const a = matrix.map((row) => row.slice());
  const b = vector.slice();

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;
    let pivotValue = Math.abs(a[col][col]);
    for (let row = col + 1; row < size; row += 1) {
      const candidate = Math.abs(a[row][col]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < epsilon) return null;
    if (pivotRow !== col) {
      const tempRow = a[col];
      a[col] = a[pivotRow];
      a[pivotRow] = tempRow;
      const tempVal = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tempVal;
    }

    const pivot = a[col][col];
    for (let row = col + 1; row < size; row += 1) {
      const factor = a[row][col] / pivot;
      if (!Number.isFinite(factor) || factor === 0) continue;
      for (let c = col; c < size; c += 1) {
        a[row][c] -= factor * a[col][c];
      }
      b[row] -= factor * b[col];
    }
  }

  const solution = Array(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let col = row + 1; col < size; col += 1) {
      sum -= a[row][col] * solution[col];
    }
    const diag = a[row][row];
    if (Math.abs(diag) < epsilon) return null;
    solution[row] = sum / diag;
  }

  return solution;
}

export function fitLinearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let varX = 0;
  let covXY = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    varX += dx * dx;
    covXY += dx * (point.y - meanY);
  }
  if (Math.abs(varX) < DEFAULT_EPSILON) return null;
  const slope = covXY / varX;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

export function buildLinearLine(points) {
  if (points.length < 2) return null;
  const fit = fitLinearRegression(points);
  if (!fit) return null;
  const xs = points.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  const start = { x: minX, y: fit.intercept + fit.slope * minX };
  const end = { x: maxX, y: fit.intercept + fit.slope * maxX };
  return [start, end];
}

export function buildLoessLine(points, options = {}) {
  const n = points.length;
  if (n < 3) return null;
  const bandwidth = Math.min(1, Math.max(0.2, options.bandwidth ?? 0.6));
  const steps = Math.max(12, options.steps ?? Math.min(36, n * 2));
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const xs = sorted.map((point) => point.x);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const span = maxX - minX;
  if (!Number.isFinite(span) || span === 0) return null;
  const neighbors = Math.max(3, Math.round(bandwidth * n));
  const line = [];

  const weightsFor = (targetX) => {
    const distances = sorted.map((point) => Math.abs(point.x - targetX));
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const maxDistance = sortedDistances[Math.min(neighbors - 1, sortedDistances.length - 1)];
    if (maxDistance === 0) {
      return distances.map(() => 1);
    }
    return distances.map((distance) => {
      if (distance > maxDistance) return 0;
      const ratio = distance / maxDistance;
      const weight = 1 - ratio * ratio * ratio;
      return weight * weight * weight;
    });
  };

  for (let i = 0; i < steps; i += 1) {
    const targetX = minX + (span * i) / (steps - 1);
    const weights = weightsFor(targetX);
    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    for (let j = 0; j < n; j += 1) {
      const w = weights[j];
      if (w === 0) continue;
      const x = sorted[j].x;
      const y = sorted[j].y;
      sumW += w;
      sumX += w * x;
      sumY += w * y;
      sumXX += w * x * x;
      sumXY += w * x * y;
    }
    if (sumW === 0) continue;
    const denom = sumW * sumXX - sumX * sumX;
    let slope = 0;
    let intercept = sumY / sumW;
    if (Math.abs(denom) > DEFAULT_EPSILON) {
      slope = (sumW * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / sumW;
    }
    const fittedY = intercept + slope * targetX;
    if (Number.isFinite(fittedY)) {
      line.push({ x: targetX, y: fittedY });
    }
  }

  return line.length >= 2 ? line : null;
}

export function computeResidualizedSamples(samples, xKey, yKey, controlKeys) {
  const points = samples.map((sample) => ({
    x: getSampleValue(sample, xKey),
    y: getSampleValue(sample, yKey),
    id: sample.id,
    timestamp: sample.timestamp,
  }));

  if (!controlKeys || controlKeys.length === 0) {
    return { points, status: "raw" };
  }

  const n = samples.length;
  const predictors = controlKeys.length + 1;
  if (n < predictors + 1) {
    return { points: [], status: "insufficient" };
  }

  const buildDesignMatrix = () => {
    return samples.map((sample) => {
      const row = [1];
      for (const key of controlKeys) {
        row.push(getSampleValue(sample, key));
      }
      return row;
    });
  };

  const xValues = samples.map((sample) => getSampleValue(sample, xKey));
  const yValues = samples.map((sample) => getSampleValue(sample, yKey));
  if (xValues.some((value) => !isFiniteNumber(value)) || yValues.some((value) => !isFiniteNumber(value))) {
    return { points: [], status: "invalid" };
  }

  const designMatrix = buildDesignMatrix();
  const coeffsX = fitRegressionCoefficients(designMatrix, xValues);
  const coeffsY = fitRegressionCoefficients(designMatrix, yValues);
  if (!coeffsX || !coeffsY) {
    return { points: [], status: "singular" };
  }

  const residualPoints = samples.map((sample, index) => {
    const row = designMatrix[index];
    const predictedX = dotRow(row, coeffsX);
    const predictedY = dotRow(row, coeffsY);
    const residualX = xValues[index] - predictedX;
    const residualY = yValues[index] - predictedY;
    return {
      x: residualX,
      y: residualY,
      id: sample.id,
      timestamp: sample.timestamp,
    };
  });

  return { points: residualPoints, status: "adjusted" };
}

function fitRegressionCoefficients(designMatrix, outcomes) {
  if (!designMatrix.length) return null;
  const rows = designMatrix.length;
  const cols = designMatrix[0].length;
  if (rows < cols) return null;
  const xtx = Array.from({ length: cols }, () => Array(cols).fill(0));
  const xty = Array(cols).fill(0);

  for (let i = 0; i < rows; i += 1) {
    const row = designMatrix[i];
    const y = outcomes[i];
    for (let col = 0; col < cols; col += 1) {
      const x = row[col];
      xty[col] += x * y;
      for (let j = 0; j < cols; j += 1) {
        xtx[col][j] += x * row[j];
      }
    }
  }

  return solveLinearSystem(xtx, xty);
}

function dotRow(row, coefficients) {
  let total = 0;
  for (let i = 0; i < row.length; i += 1) {
    total += row[i] * coefficients[i];
  }
  return total;
}

/**
 * Compute Pearson's correlation coefficient and related statistics.
 * Returns { r, slope, pValue, n } or null if computation is not possible.
 *
 * @param {Array<{x: number, y: number}>} points - Array of data points
 * @returns {{r: number, slope: number, pValue: number, n: number} | null}
 */
export function computeCorrelationStats(points) {
  const n = points.length;
  if (n < 3) return null;

  // Calculate means
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate variances and covariance
  let varX = 0;
  let varY = 0;
  let covXY = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    varX += dx * dx;
    varY += dy * dy;
    covXY += dx * dy;
  }

  // Handle zero variance (correlation undefined)
  if (Math.abs(varX) < DEFAULT_EPSILON || Math.abs(varY) < DEFAULT_EPSILON) {
    return null;
  }

  const r = covXY / Math.sqrt(varX * varY);
  const slope = covXY / varX;
  const pValue = computePValue(r, n);

  return { r, slope, pValue, n };
}

/**
 * Compute two-tailed p-value for testing H0: rho = 0
 * Uses t-distribution with df = n - 2
 *
 * @param {number} r - Pearson's correlation coefficient
 * @param {number} n - Sample size
 * @returns {number} Two-tailed p-value
 */
function computePValue(r, n) {
  if (n < 3) return NaN;
  if (!Number.isFinite(r)) return NaN;

  // Perfect correlation: p = 0
  if (Math.abs(r) >= 1 - DEFAULT_EPSILON) return 0;

  const df = n - 2;
  const rSquared = r * r;
  const t = Math.abs(r) * Math.sqrt(df / (1 - rSquared));

  // Two-tailed p-value from t-distribution
  return tDistributionPValue(t, df);
}

/**
 * Compute two-tailed p-value from t-distribution using incomplete beta function.
 * P(|T| > t) = I_{x}(df/2, 1/2) where x = df / (df + t^2)
 *
 * @param {number} t - Absolute value of t-statistic
 * @param {number} df - Degrees of freedom
 * @returns {number} Two-tailed p-value
 */
function tDistributionPValue(t, df) {
  if (df <= 0 || !Number.isFinite(t)) return NaN;
  if (t === 0) return 1;

  const x = df / (df + t * t);
  return betaIncomplete(df / 2, 0.5, x);
}

/**
 * Regularized incomplete beta function I_x(a, b) using continued fraction expansion.
 * This is used for computing p-values from t-distribution.
 *
 * @param {number} a - First shape parameter
 * @param {number} b - Second shape parameter
 * @param {number} x - Upper limit of integration (0 <= x <= 1)
 * @returns {number} Value of regularized incomplete beta function
 */
function betaIncomplete(a, b, x) {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Use symmetry relation for numerical stability
  // I_x(a,b) = 1 - I_{1-x}(b,a)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaIncomplete(b, a, 1 - x);
  }

  // Continued fraction representation (Lentz's algorithm)
  const maxIterations = 200;
  const epsilon = 1e-14;

  // Compute ln(Beta(a,b)) using log-gamma approximation
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);

  // Front factor: x^a * (1-x)^b / (a * Beta(a,b))
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;

  // Continued fraction coefficients
  let f = 1;
  let c = 1;
  let d = 0;

  for (let m = 0; m <= maxIterations; m++) {
    let numerator;
    if (m === 0) {
      numerator = 1;
    } else if (m % 2 === 0) {
      // Even terms
      const k = m / 2;
      numerator = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
    } else {
      // Odd terms
      const k = (m - 1) / 2;
      numerator = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1));
    }

    d = 1 + numerator * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;

    c = 1 + numerator / c;
    if (Math.abs(c) < epsilon) c = epsilon;

    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < epsilon) {
      return front * (f - 1);
    }
  }

  // Convergence not achieved, return best estimate
  return front * (f - 1);
}

/**
 * Log-gamma function approximation using Stirling's series.
 * Accurate for x > 0.
 *
 * @param {number} x - Input value
 * @returns {number} ln(Gamma(x))
 */
function lnGamma(x) {
  if (x <= 0) return NaN;

  // Coefficients for Lanczos approximation of log-gamma function
  const coefficients = [
    76.1800917294715, -86.5053203294168, 24.0140982408309, -1.23173957245024,
    0.00120865097386618, -5.39523938495e-6,
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);

  let sum = 1.00000000019001;
  for (let i = 0; i < coefficients.length; i++) {
    y += 1;
    sum += coefficients[i] / y;
  }

  return -tmp + Math.log((2.506628274631 * sum) / x);
}

/**
 * Format a numeric statistic for display.
 *
 * @param {number | null | undefined} value - Value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted string or "NA"
 */
export function formatStat(value, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "NA";
  }
  return value.toFixed(decimals);
}

/**
 * Format a p-value for display with appropriate precision.
 * Uses scientific notation for very small values.
 *
 * @param {number | null | undefined} p - P-value to format
 * @returns {string} Formatted string or "NA"
 */
export function formatPValue(p) {
  if (p === null || p === undefined || !Number.isFinite(p)) {
    return "NA";
  }
  if (p < 0.001) {
    return "<.001";
  }
  if (p < 0.01) {
    return p.toFixed(3);
  }
  return p.toFixed(2);
}

export const __TEST_ONLY__ = {
  solveLinearSystem,
  getSampleValue,
  computePValue,
  betaIncomplete,
  lnGamma,
};
