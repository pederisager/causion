const BINARY_PRECEDENCE = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
  "^": 7,
};

export function deriveEffectLabel(model, source, target) {
  if (!model || !model.has(target)) {
    return "";
  }
  const entry = model.get(target);
  if (!entry || !entry.ast || !entry.dependencies || !entry.dependencies.has(source)) {
    return "";
  }
  const raw = formatEffect(entry.ast, source);
  return postProcessLabel(raw, source);
}

function formatEffect(node, identifier) {
  if (!node || !containsTarget(node, identifier)) {
    return "";
  }

  switch (node.type) {
    case "Literal":
      return literalToString(node);
    case "Identifier":
      return node.name;
    case "UnaryExpression": {
      const inner = formatEffect(node.argument, identifier);
      if (!inner) return "";
      const wrapped = needsParensForUnary(node.argument) ? `(${inner})` : inner;
      return `${node.operator}${wrapped}`;
    }
    case "BinaryExpression":
    case "LogicalExpression":
      return formatBinary(node, identifier);
    case "ConditionalExpression":
      return formatConditional(node, identifier);
    case "CallExpression":
      return formatCall(node, identifier);
    default:
      return "";
  }
}

function formatBinary(node, identifier) {
  const leftHas = containsTarget(node.left, identifier);
  const rightHas = containsTarget(node.right, identifier);
  const op = node.operator;

  if (!leftHas && !rightHas) {
    return "";
  }

  if (op === "+") {
    const left = leftHas ? postProcessLabel(formatEffect(node.left, identifier), identifier) : "";
    const right = rightHas ? postProcessLabel(formatEffect(node.right, identifier), identifier) : "";
    if (left && right) return `${left} + ${right}`;
    return left || right || "";
  }

  if (op === "-") {
    const left = leftHas ? postProcessLabel(formatEffect(node.left, identifier), identifier) : "";
    const right = rightHas ? postProcessLabel(formatEffect(node.right, identifier), identifier) : "";
    if (left && right) {
      return `${wrapIfNeeded(left, node.left, "-", "left")} - ${wrapIfNeeded(
        right,
        node.right,
        "-",
        "right"
      )}`;
    }
    if (left) return left;
    if (right) {
      const wrapped = needsParensForUnary(node.right) ? `(${right})` : right;
      return `-${wrapped}`;
    }
    return "";
  }

  if (op === "*") {
    const left = leftHas
      ? postProcessLabel(formatEffect(node.left, identifier), identifier)
      : formatFull(node.left);
    const right = rightHas
      ? postProcessLabel(formatEffect(node.right, identifier), identifier)
      : formatFull(node.right);
    if (!leftHas && rightHas) {
      return joinWithOperator(
        op,
        right,
        left,
        { operator: op, left: node.right, right: node.left }
      );
    }
    return joinWithOperator(op, left, right, node);
  }

  if (op === "/") {
    const left = leftHas
      ? postProcessLabel(formatEffect(node.left, identifier), identifier)
      : formatFull(node.left);
    const right = rightHas
      ? postProcessLabel(formatEffect(node.right, identifier), identifier)
      : formatFull(node.right);
    return joinWithOperator(op, left, right, node);
  }

  if (op === "^" || op === "%") {
    const left = leftHas
      ? postProcessLabel(formatEffect(node.left, identifier), identifier)
      : formatFull(node.left);
    const right = rightHas
      ? postProcessLabel(formatEffect(node.right, identifier), identifier)
      : formatFull(node.right);
    return joinWithOperator(op, left, right, node);
  }

  // Logical expressions – keep only relevant side(s)
  const left = leftHas ? formatEffect(node.left, identifier) : "";
  const right = rightHas ? formatEffect(node.right, identifier) : "";
  if (left && right) return `${left} ${op} ${right}`;
  return left || right || "";
}

function formatConditional(node, identifier) {
  const testHas = containsTarget(node.test, identifier);
  const consHas = containsTarget(node.consequent, identifier);
  const altHas = containsTarget(node.alternate, identifier);

  const test = testHas ? formatEffect(node.test, identifier) : formatFull(node.test);
  const consequent = consHas ? formatEffect(node.consequent, identifier) : formatFull(node.consequent);
  const alternate = altHas ? formatEffect(node.alternate, identifier) : formatFull(node.alternate);

  return `${test} ? ${consequent} : ${alternate}`;
}

function formatCall(node, identifier) {
  if (node.callee.type !== "Identifier") {
    return "";
  }
  const args = node.arguments || [];
  const relevant = args.filter((arg) => containsTarget(arg, identifier));
  if (!relevant.length) {
    return "";
  }
  const name = node.callee.name;
  const formattedArgs = args.map((arg) =>
    containsTarget(arg, identifier) ? formatEffect(arg, identifier) : formatFull(arg)
  );
  if (args.length === 1 && formattedArgs.length === 1) {
    const soleArg = formattedArgs[0]?.trim();
    if (soleArg === identifier || soleArg === "1" || soleArg === "-1") {
      return `${name}()`;
    }
  }
  return `${name}(${formattedArgs.join(", ")})`;
}

function joinWithOperator(operator, left, right, node) {
  const leftString = wrapIfNeeded(left, node.left, operator, "left");
  const rightString = wrapIfNeeded(right, node.right, operator, "right");
  return `${leftString} ${operator} ${rightString}`;
}

function wrapIfNeeded(text, originalNode, parentOp, position) {
  if (!text) return text;
  if (!originalNode) return text;
  if (!originalNode.type || originalNode.type === "Literal" || originalNode.type === "Identifier") {
    return text;
  }
  if (originalNode.type === "UnaryExpression") {
    return text;
  }
  if (originalNode.type === "CallExpression") {
    return text;
  }
  if (originalNode.type === "ConditionalExpression") {
    return `(${text})`;
  }
  if (originalNode.type === "BinaryExpression" || originalNode.type === "LogicalExpression") {
    const childOp = originalNode.operator;
    if (shouldWrap(childOp, parentOp, position)) {
      return `(${text})`;
    }
  }
  return text;
}

function shouldWrap(childOp, parentOp, position) {
  if (!parentOp || !childOp) return false;
  const parentPrec = BINARY_PRECEDENCE[parentOp] ?? 0;
  const childPrec = BINARY_PRECEDENCE[childOp] ?? 0;
  if (childPrec < parentPrec) return true;
  if (childPrec > parentPrec) return false;

  if (parentOp === "-" && position === "right") return true;
  if (parentOp === "/" && position === "right") return true;
  if (parentOp === "^" && position === "left") return true;
  return false;
}

function needsParensForUnary(node) {
  if (!node) return false;
  const type = node.type;
  if (type === "Literal" || type === "Identifier") return false;
  return true;
}

function containsTarget(node, identifier) {
  if (!node) return false;
  switch (node.type) {
    case "Identifier":
      return node.name === identifier;
    case "Literal":
      return false;
    case "UnaryExpression":
      return containsTarget(node.argument, identifier);
    case "BinaryExpression":
    case "LogicalExpression":
      return containsTarget(node.left, identifier) || containsTarget(node.right, identifier);
    case "ConditionalExpression":
      return (
        containsTarget(node.test, identifier) ||
        containsTarget(node.consequent, identifier) ||
        containsTarget(node.alternate, identifier)
      );
    case "CallExpression":
      return node.arguments.some((arg) => containsTarget(arg, identifier));
    default:
      return false;
  }
}

function formatFull(node, parentOp, position) {
  if (!node) return "";
  switch (node.type) {
    case "Literal":
      return literalToString(node);
    case "Identifier":
      return node.name;
    case "UnaryExpression": {
      const inner = formatFull(node.argument, node.operator, "right");
      const needsWrap = needsParensForUnary(node.argument);
      return `${node.operator}${needsWrap ? `(${inner})` : inner}`;
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      const left = formatFull(node.left, node.operator, "left");
      const right = formatFull(node.right, node.operator, "right");
      const body = `${left} ${node.operator} ${right}`;
      if (shouldWrap(node.operator, parentOp, position)) {
        return `(${body})`;
      }
      return body;
    }
    case "ConditionalExpression": {
      const test = formatFull(node.test);
      const consequent = formatFull(node.consequent);
      const alternate = formatFull(node.alternate);
      return `${test} ? ${consequent} : ${alternate}`;
    }
    case "CallExpression": {
      if (node.callee.type !== "Identifier") {
        return "";
      }
      const args = (node.arguments || []).map((arg) => formatFull(arg));
      return `${node.callee.name}(${args.join(", ")})`;
    }
    default:
      return "";
  }
}

function literalToString(node) {
  if (node.raw !== undefined) return String(node.raw);
  const value = node.value;
  if (Number.isFinite(value)) {
    return trimTrailingZeros(String(value));
  }
  return String(value);
}

function trimTrailingZeros(value) {
  if (!/^-?\d+\.\d+/.test(value)) return value;
  return value.replace(/\.?0+$/, "");
}

function postProcessLabel(raw, identifier) {
  if (!raw) return "";
  let text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "";

  const idPattern = escapeRegExp(identifier);
  const directCoeff = new RegExp(`^([-+]?\\d*\\.?\\d+(?:e[+-]?\\d+)?)\\s*\\*\\s*${idPattern}$`, "i");
  const reverseCoeff = new RegExp(`^${idPattern}\\s*\\*\\s*([-+]?\\d*\\.?\\d+(?:e[+-]?\\d+)?)$`, "i");
  const unaryPlus = new RegExp(`^\\+\\s*${idPattern}$`);
  const unaryMinus = new RegExp(`^-\\s*${idPattern}$`);

  if (directCoeff.test(text)) {
    return text.replace(directCoeff, "$1");
  }
  if (reverseCoeff.test(text)) {
    return text.replace(reverseCoeff, "$1");
  }
  if (text === identifier) {
    return "1";
  }
  if (unaryPlus.test(text)) {
    return "1";
  }
  if (unaryMinus.test(text)) {
    return "-1";
  }

  if (text.includes("*")) {
    const tokens = text
      .split("*")
      .map((part) => part.trim())
      .filter(Boolean);
    const filtered = tokens.filter((part) => {
      if (part === identifier || part === `(${identifier})`) {
        return false;
      }
      if ((part === "1" || part === "(1)") && tokens.length > 1) {
        return false;
      }
      return true;
    });
    if (filtered.length && filtered.length < tokens.length) {
      if (filtered.length === 1) {
        text = filtered[0];
      } else {
        const [first, ...rest] = filtered;
        const tail = rest.join(" * ");
        text = `${first} * ${rest.length > 1 ? `(${tail})` : tail}`;
      }
    }
  }

  const fnMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (fnMatch) {
    const inner = (fnMatch[2] || "").trim();
    if (inner === identifier || inner === "1" || inner === "-1") {
      text = `${fnMatch[1]}()`;
    }
  }

  if (/^\((.*)\)$/.test(text)) {
    text = text.replace(/^\((.*)\)$/, "$1");
  }
  text = text
    .replace(/\b1\s*\*\s*/g, "")
    .replace(/\*\s*1\b/g, "")
    .replace(/\b1\s*\/\s*/g, "1 /")
    .replace(/\/\s*1\b/g, "");
  const hasAdditive = /\s[+\-]\s/.test(text);
  if (!hasAdditive && text.includes("*") && !text.includes("(")) {
    const segments = text
      .split("*")
      .map((part) => part.trim())
      .filter(Boolean);
    if (segments.length > 2) {
      const [first, ...rest] = segments;
      const restText = rest.join(" * ");
      text = `${first} * (${restText})`;
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const __TEST_ONLY__ = {
  formatEffect,
  containsTarget,
  postProcessLabel,
  formatFull,
};
