import jsep from "jsep";
import { ensureExpressionParserConfigured } from "./expressionRegistry.js";
import { parseSCM } from "./parser.js";
import {
  buildLinearExpression,
  getLinearSummary,
  updateLinearCoefficient,
} from "../utils/linearExpression.js";

const ASSIGNMENT_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseAssignments(text) {
  const rows = String(text || "")
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean);
  return rows.map((line) => {
    const match = line.match(ASSIGNMENT_RE);
    if (!match) {
      throw new Error(`Cannot parse: "${line}"`);
    }
    return { name: match[1], rhs: match[2].trim() };
  });
}

function serializeAssignments(assignments) {
  return assignments.map((entry) => `${entry.name} = ${entry.rhs}`).join("\n");
}

function findAssignmentIndex(assignments, name) {
  return assignments.findIndex((entry) => entry.name === name);
}

function parseRhsToAst(rhs) {
  if (!rhs || !rhs.trim()) return null;
  ensureExpressionParserConfigured();
  return jsep(rhs);
}

function ensureValidName(name) {
  if (!NAME_RE.test(name)) {
    throw new Error("Names must start with a letter or underscore and contain only letters, numbers, or underscores.");
  }
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceIdentifier(rhs, from, to) {
  if (!rhs) return rhs;
  const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
  return rhs.replace(pattern, to);
}

export function isValidScmName(name) {
  return NAME_RE.test(String(name || "").trim());
}

export function addNodeToScm(text, name) {
  const trimmed = String(name || "").trim();
  ensureValidName(trimmed);
  const assignments = parseAssignments(text);
  if (assignments.some((entry) => entry.name === trimmed)) {
    throw new Error(`Variable "${trimmed}" already exists.`);
  }
  assignments.push({ name: trimmed, rhs: "0" });
  return serializeAssignments(assignments);
}

export function renameNodeInScm(text, previousName, nextName) {
  const from = String(previousName || "").trim();
  const to = String(nextName || "").trim();
  ensureValidName(from);
  ensureValidName(to);
  if (from === to) return text;

  const assignments = parseAssignments(text);
  const names = new Set(assignments.map((entry) => entry.name));
  const rhsPattern = new RegExp(`\\b${escapeRegExp(from)}\\b`);
  const appearsInRhs = assignments.some((entry) => rhsPattern.test(entry.rhs));
  if (!names.has(from) && !appearsInRhs) {
    throw new Error(`Variable "${from}" does not exist.`);
  }
  if (names.has(to)) {
    throw new Error(`Variable "${to}" already exists.`);
  }

  const nextAssignments = assignments.map((entry) => ({
    name: entry.name === from ? to : entry.name,
    rhs: replaceIdentifier(entry.rhs, from, to),
  }));

  return serializeAssignments(nextAssignments);
}

export function removeNodeFromScm(text, name) {
  const trimmed = String(name || "").trim();
  ensureValidName(trimmed);
  const parsed = parseSCM(text);
  const removedDependencies = parsed.model.get(trimmed)?.dependencies ?? new Set();
  const assignments = parseAssignments(text);
  const rhsPattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`);
  let removedAssignment = false;
  let removedReference = false;

  const nextAssignments = assignments.reduce((acc, entry) => {
    if (entry.name === trimmed) {
      removedAssignment = true;
      return acc;
    }

    if (!rhsPattern.test(entry.rhs)) {
      acc.push(entry);
      return acc;
    }

    removedReference = true;
    let nextRhs = entry.rhs;
    const ast = parseRhsToAst(entry.rhs);
    const summary = ast ? getLinearSummary(ast) : null;
    if (summary && summary.terms.has(trimmed)) {
      const updated = updateLinearCoefficient(summary, trimmed, 0);
      nextRhs = buildLinearExpression(updated);
    } else {
      nextRhs = replaceIdentifier(entry.rhs, trimmed, "0");
    }
    acc.push({ ...entry, rhs: nextRhs });
    return acc;
  }, []);

  if (!removedAssignment && !removedReference) {
    throw new Error(`Variable "${trimmed}" does not exist.`);
  }

  if (removedDependencies.size) {
    const nextText = serializeAssignments(nextAssignments);
    const nextParsed = parseSCM(nextText);
    for (const dep of removedDependencies) {
      if (dep === trimmed) continue;
      if (nextParsed.allVars.has(dep)) continue;
      nextAssignments.push({ name: dep, rhs: "0" });
    }
  }

  return serializeAssignments(nextAssignments);
}

export function removeEdgeFromScm(text, parent, child) {
  const parentId = String(parent || "").trim();
  const childId = String(child || "").trim();
  ensureValidName(parentId);
  ensureValidName(childId);

  const assignments = parseAssignments(text);
  const parentIndex = findAssignmentIndex(assignments, parentId);
  const index = findAssignmentIndex(assignments, childId);
  if (index < 0) {
    throw new Error(`Variable "${childId}" does not exist.`);
  }

  const rhs = assignments[index].rhs;
  const rhsPattern = new RegExp(`\\b${escapeRegExp(parentId)}\\b`);
  if (!rhsPattern.test(rhs)) {
    throw new Error(`No edge from "${parentId}" to "${childId}".`);
  }

  const ast = parseRhsToAst(rhs);
  const summary = ast ? getLinearSummary(ast) : null;
  let nextRhs = rhs;

  if (summary && summary.terms.has(parentId)) {
    const updated = updateLinearCoefficient(summary, parentId, 0);
    nextRhs = buildLinearExpression(updated);
  } else {
    nextRhs = replaceIdentifier(rhs, parentId, "0");
  }

  assignments[index] = { ...assignments[index], rhs: nextRhs };
  if (parentIndex < 0) {
    const nextText = serializeAssignments(assignments);
    const nextParsed = parseSCM(nextText);
    if (!nextParsed.allVars.has(parentId)) {
      assignments.push({ name: parentId, rhs: "0" });
    }
  }
  return serializeAssignments(assignments);
}

export function upsertEdgeCoefficient(text, parent, child, coefficient, options = {}) {
  const { requireExistingTerm = false } = options;
  const parentId = String(parent || "").trim();
  const childId = String(child || "").trim();
  ensureValidName(parentId);
  ensureValidName(childId);

  if (!Number.isFinite(coefficient)) {
    throw new Error("Coefficient must be a finite number.");
  }

  const assignments = parseAssignments(text);
  let index = findAssignmentIndex(assignments, childId);
  let rhs = index >= 0 ? assignments[index].rhs : "";
  const ast = parseRhsToAst(rhs);
  const summary = ast ? getLinearSummary(ast) : { terms: new Map(), order: [], constant: 0 };
  if (!summary) {
    throw new Error("Only simple linear equations can be edited from the DAG.");
  }

  const hasTerm = summary.terms.has(parentId);
  if (requireExistingTerm && !hasTerm) {
    throw new Error(`No linear term for ${parentId} exists in ${childId}.`);
  }

  const updated = updateLinearCoefficient(summary, parentId, coefficient);
  const nextRhs = buildLinearExpression(updated);

  if (index >= 0) {
    assignments[index] = { name: childId, rhs: nextRhs };
  } else {
    assignments.push({ name: childId, rhs: nextRhs });
  }

  return serializeAssignments(assignments);
}
