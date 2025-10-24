import jsep from "jsep";

const ALLOWED_FUNCTIONS = new Map([
  ["abs", Math.abs],
  ["sin", Math.sin],
  ["cos", Math.cos],
  ["log", Math.log],
  ["exp", Math.exp],
]);

const ALLOWED_CONSTANTS = new Map([
  ["PI", Math.PI],
  ["E", Math.E],
]);

const SPECIAL_IDENTIFIERS = new Set(["error"]);

let configured = false;

function normalize(name) {
  return String(name || "").toLowerCase();
}

export function ensureExpressionParserConfigured() {
  if (configured) return;
  jsep.addBinaryOp("^", 10);
  configured = true;
}

export function isAllowedFunction(name) {
  return ALLOWED_FUNCTIONS.has(normalize(name));
}

export function getAllowedFunction(name) {
  return ALLOWED_FUNCTIONS.get(normalize(name));
}

export function getAllowedFunctionNames() {
  return [...ALLOWED_FUNCTIONS.keys()];
}

export function getAllowedConstant(name) {
  return ALLOWED_CONSTANTS.get(name);
}

export function listAllowedConstants() {
  return [...ALLOWED_CONSTANTS.keys()];
}

export function isSpecialIdentifier(name) {
  return SPECIAL_IDENTIFIERS.has(name);
}
