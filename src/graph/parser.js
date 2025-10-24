import jsep from "jsep";
import {
  ensureExpressionParserConfigured,
  getAllowedConstant,
  getAllowedFunctionNames,
  isAllowedFunction,
  isSpecialIdentifier,
} from "./expressionRegistry.js";

/**
 * Parse a textual structural causal model (SCM) specification into AST-backed
 * expressions keyed by variable name.
 *
 * The parser accepts assignments separated by new lines or semicolons. Each
 * right-hand side may contain arithmetic, logical, and supported function
 * calls. Identifiers discovered in the expression become dependencies for
 * downstream propagation. Identifiers that appear only as dependencies are
 * hoisted into the returned map as derived nodes so later code can assume every
 * symbol has an entry.
 *
 * @param {string} text - Raw SCM specification provided by the user.
 * @returns {{
 *   model: Map<string, { ast: import("jsep").Expression | null, dependencies: Set<string>, source: string, derived: boolean }>,
 *   allVars: Set<string>
 * }} Parsed expressions organised by variable.
 * @throws {Error} If a line cannot be parsed or contains duplicate variables.
 */
export function parseSCM(text) {
  ensureExpressionParserConfigured();

  const lines = String(text || "")
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const model = new Map();
  const allVars = new Set();

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) {
      throw new Error(`Cannot parse: "${line}"`);
    }

    const child = match[1];
    const rhs = match[2];

    if (model.has(child)) {
      throw new Error(`Duplicate definition for ${child}`);
    }

    let ast;
    try {
      ast = jsep(rhs);
    } catch (error) {
      const message = error?.message || String(error);
      throw new Error(`Failed to parse expression for ${child}: ${message}`);
    }

    const dependencies = collectDependencies(ast, child, rhs);

    model.set(child, {
      ast,
      dependencies,
      source: rhs,
      derived: false,
    });

    allVars.add(child);
    dependencies.forEach((dep) => allVars.add(dep));
  }

  for (const variable of allVars) {
    if (!model.has(variable)) {
      model.set(variable, {
        ast: null,
        dependencies: new Set(),
        source: "",
        derived: true,
      });
    }
  }

  return { model, allVars };
}

/**
 * Walk a parsed expression tree and extract identifiers that should be treated
 * as dependencies.
 *
 * @param {import("jsep").Expression} node
 * @param {string} owner
 * @param {string} source
 * @returns {Set<string>}
 */
function collectDependencies(node, owner, source) {
  const deps = new Set();
  traverse(node, deps, owner, source);
  return deps;
}

function traverse(node, deps, owner, source) {
  if (!node) return;

  switch (node.type) {
    case "Literal":
      return;
    case "Identifier": {
      const name = node.name;
      if (isAllowedFunction(name)) return;
      if (getAllowedConstant(name) !== undefined) return;
      if (isSpecialIdentifier(name)) return;
      deps.add(name);
      return;
    }
    case "UnaryExpression":
      traverse(node.argument, deps, owner, source);
      return;
    case "BinaryExpression":
    case "LogicalExpression":
      traverse(node.left, deps, owner, source);
      traverse(node.right, deps, owner, source);
      return;
    case "ConditionalExpression":
      traverse(node.test, deps, owner, source);
      traverse(node.consequent, deps, owner, source);
      traverse(node.alternate, deps, owner, source);
      return;
    case "CallExpression": {
      const callee = node.callee;
      if (callee.type !== "Identifier") {
        throw new Error(
          `Unsupported function call in ${owner}: only direct calls like sin(x) are allowed.`
        );
      }
      const fnName = callee.name;
      if (!isAllowedFunction(fnName)) {
        const allowed = getAllowedFunctionNames().join(", ");
        throw new Error(
          `Function "${fnName}" used in ${owner} is not allowed. Supported functions: ${allowed}.`
        );
      }
      node.arguments.forEach((arg) => traverse(arg, deps, owner, source));
      return;
    }
    default:
      throw new Error(
        `Unsupported expression construct "${node.type}" in definition ${owner} = ${source}`
      );
  }
}
