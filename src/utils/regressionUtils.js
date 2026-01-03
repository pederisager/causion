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

export const __TEST_ONLY__ = {
  solveLinearSystem,
  getSampleValue,
};
