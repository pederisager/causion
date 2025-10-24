import {
  getAllowedConstant,
  getAllowedFunction,
  getAllowedFunctionNames,
  isSpecialIdentifier,
} from "./expressionRegistry.js";

const BINARY_OPERATORS = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "^": (a, b) => a ** b,
  "%": (a, b) => a % b,
  ">": (a, b) => (a > b ? 1 : 0),
  ">=": (a, b) => (a >= b ? 1 : 0),
  "<": (a, b) => (a < b ? 1 : 0),
  "<=": (a, b) => (a <= b ? 1 : 0),
  "==": (a, b) => (a === b ? 1 : 0),
  "!=": (a, b) => (a !== b ? 1 : 0),
  "&&": (a, b) => (truthy(a) && truthy(b) ? 1 : 0),
  "||": (a, b) => (truthy(a) || truthy(b) ? 1 : 0),
};

const UNARY_OPERATORS = {
  "-": (a) => -a,
  "+": (a) => +a,
  "!": (a) => (truthy(a) ? 0 : 1),
};

function truthy(value) {
  return Boolean(value);
}

/**
 * Evaluate a parsed expression against the provided scope.
 *
 * @param {import("jsep").Expression | null} ast
 * @param {Record<string, number>} scope
 * @returns {number}
 */
export function evaluateExpression(ast, scope) {
  if (!ast) return 0;
  return evalNode(ast, scope);
}

function evalNode(node, scope) {
  switch (node.type) {
    case "Literal":
      return node.value;
    case "Identifier":
      return resolveIdentifier(node.name, scope);
    case "UnaryExpression": {
      const fn = UNARY_OPERATORS[node.operator];
      if (!fn) {
        throw new Error(`Unsupported unary operator "${node.operator}"`);
      }
      return fn(evalNode(node.argument, scope));
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      const fn = BINARY_OPERATORS[node.operator];
      if (!fn) {
        throw new Error(`Unsupported operator "${node.operator}"`);
      }
      return fn(evalNode(node.left, scope), evalNode(node.right, scope));
    }
    case "ConditionalExpression": {
      const test = evalNode(node.test, scope);
      return truthy(test) ? evalNode(node.consequent, scope) : evalNode(node.alternate, scope);
    }
    case "CallExpression": {
      if (node.callee.type !== "Identifier") {
        throw new Error("Only simple function calls like sin(x) are allowed.");
      }
      const name = node.callee.name;
      const fn = getAllowedFunction(name);
      if (!fn) {
        const allowed = getAllowedFunctionNames().join(", ");
        throw new Error(`Function "${name}" is not allowed. Supported: ${allowed}.`);
      }
      const args = node.arguments.map((arg) => evalNode(arg, scope));
      return fn(...args);
    }
    default:
      throw new Error(`Unsupported expression node "${node.type}"`);
  }
}

function resolveIdentifier(name, scope) {
  const constant = getAllowedConstant(name);
  if (constant !== undefined) return constant;
  if (isSpecialIdentifier(name)) {
    return scope[name];
  }
  if (name in scope) return scope[name];
  throw new Error(`Unknown variable "${name}"`);
}
