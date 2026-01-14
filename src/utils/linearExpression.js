import { getAllowedConstant } from "../graph/expressionRegistry.js";

const EPSILON = 1e-10;
const ROUND_PLACES = 4;

function isZero(value) {
  return Math.abs(value) < EPSILON;
}

function roundNumber(value) {
  const factor = 10 ** ROUND_PLACES;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = roundNumber(value);
  return rounded.toString();
}

function createLinear(terms = new Map(), order = [], constant = 0) {
  return {
    terms,
    order,
    constant: Number.isFinite(constant) ? constant : 0,
  };
}

function mergeLinear(left, right, sign = 1) {
  const terms = new Map(left.terms);
  const order = [...left.order];
  for (const [id, coef] of right.terms) {
    const next = (terms.get(id) || 0) + coef * sign;
    if (!terms.has(id)) {
      order.push(id);
    }
    terms.set(id, next);
  }
  return createLinear(terms, order, left.constant + right.constant * sign);
}

function scaleLinear(linear, scale) {
  if (!Number.isFinite(scale)) return null;
  const terms = new Map();
  for (const [id, coef] of linear.terms) {
    terms.set(id, coef * scale);
  }
  return createLinear(terms, [...linear.order], linear.constant * scale);
}

function literalToNumber(node) {
  if (!node || node.type !== "Literal") return null;
  return typeof node.value === "number" ? node.value : null;
}

function parseIdentifier(node) {
  if (!node || node.type !== "Identifier") return null;
  const constant = getAllowedConstant(node.name);
  if (typeof constant === "number") {
    return createLinear(new Map(), [], constant);
  }
  const terms = new Map([[node.name, 1]]);
  return createLinear(terms, [node.name], 0);
}

function parseLinear(node) {
  if (!node) return null;

  if (node.type === "Literal") {
    const value = literalToNumber(node);
    if (!Number.isFinite(value)) return null;
    return createLinear(new Map(), [], value);
  }

  if (node.type === "Identifier") {
    return parseIdentifier(node);
  }

  if (node.type === "UnaryExpression") {
    const inner = parseLinear(node.argument);
    if (!inner) return null;
    if (node.operator === "+") return inner;
    if (node.operator === "-") {
      return scaleLinear(inner, -1);
    }
    return null;
  }

  if (node.type === "BinaryExpression") {
    const op = node.operator;
    if (op === "+" || op === "-") {
      const left = parseLinear(node.left);
      const right = parseLinear(node.right);
      if (!left || !right) return null;
      return mergeLinear(left, right, op === "-" ? -1 : 1);
    }
    if (op === "*") {
      const left = parseLinear(node.left);
      const right = parseLinear(node.right);
      if (!left || !right) return null;
      const leftHasTerms = left.terms.size > 0;
      const rightHasTerms = right.terms.size > 0;
      if (leftHasTerms && rightHasTerms) return null;
      if (leftHasTerms) return scaleLinear(left, right.constant);
      if (rightHasTerms) return scaleLinear(right, left.constant);
      return createLinear(new Map(), [], left.constant * right.constant);
    }
    if (op === "/") {
      const left = parseLinear(node.left);
      const right = parseLinear(node.right);
      if (!left || !right) return null;
      if (right.terms.size > 0) return null;
      if (isZero(right.constant)) return null;
      return scaleLinear(left, 1 / right.constant);
    }
    return null;
  }

  return null;
}

function normalizeLinear(linear) {
  const terms = new Map();
  for (const [id, coef] of linear.terms) {
    if (!Number.isFinite(coef) || isZero(coef)) continue;
    terms.set(id, coef);
  }
  return createLinear(terms, linear.order.filter((id) => terms.has(id)), linear.constant);
}

export function getLinearSummary(ast) {
  const parsed = parseLinear(ast);
  if (!parsed) return null;
  return normalizeLinear(parsed);
}

export function getLinearCoefficient(ast, identifier) {
  const summary = getLinearSummary(ast);
  if (!summary) return null;
  return summary.terms.get(identifier) ?? 0;
}

export function updateLinearCoefficient(summary, identifier, coefficient) {
  const terms = new Map(summary.terms);
  const order = summary.order.includes(identifier)
    ? [...summary.order]
    : [...summary.order, identifier];
  if (!Number.isFinite(coefficient) || isZero(coefficient)) {
    terms.delete(identifier);
  } else {
    terms.set(identifier, coefficient);
  }
  return normalizeLinear(createLinear(terms, order, summary.constant));
}

export function buildLinearExpression(summary) {
  if (!summary) return "0";
  const normalized = normalizeLinear(summary);
  const pieces = [];
  for (const id of normalized.order) {
    const coef = normalized.terms.get(id);
    if (!Number.isFinite(coef) || isZero(coef)) continue;
    const abs = Math.abs(coef);
    const term = abs === 1 ? id : `${formatNumber(abs)}*${id}`;
    if (!pieces.length) {
      pieces.push(coef < 0 ? `-${term}` : term);
    } else {
      pieces.push(`${coef < 0 ? "-" : "+"} ${term}`);
    }
  }

  if (Number.isFinite(normalized.constant) && !isZero(normalized.constant)) {
    const absConst = Math.abs(normalized.constant);
    const constText = formatNumber(absConst);
    if (!pieces.length) {
      pieces.push(normalized.constant < 0 ? `-${constText}` : constText);
    } else {
      pieces.push(`${normalized.constant < 0 ? "-" : "+"} ${constText}`);
    }
  }

  return pieces.length ? pieces.join(" ") : "0";
}
