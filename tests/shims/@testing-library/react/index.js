import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let lastMarkup = "";

export function cleanup() {
  lastMarkup = "";
}

export function render(ui) {
  lastMarkup = renderToStaticMarkup(ui);
  return {
    container: {
      innerHTML: lastMarkup,
    },
  };
}

function ensureMarkup() {
  if (!lastMarkup) {
    throw new Error("No markup rendered yet. Call render() first.");
  }
}

function normalize(str) {
  return str.replace(/\s+/g, " ").trim();
}

export const screen = {
  getByText(text) {
    ensureMarkup();
    const pattern = new RegExp(`>\\s*${text.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`);
    if (!pattern.test(lastMarkup)) {
      throw new Error(`Unable to find an element with text: ${text}`);
    }
    return { textContent: text };
  },
  getByDisplayValue(value) {
    ensureMarkup();
    const pattern = new RegExp(`value=\\"${value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\"`);
    if (!pattern.test(lastMarkup)) {
      throw new Error(`Unable to find control with value: ${value}`);
    }
    return { value };
  },
};

export function getMarkup() {
  ensureMarkup();
  return normalize(lastMarkup);
}
