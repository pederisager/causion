import { useMemo, useReducer, useCallback } from "react";
import { parseSCM } from "../graph/parser.js";
import { depsFromModel, topoSort } from "../graph/topology.js";
import { buildGraphSignature } from "../utils/graphSignature.js";

function createEmptyResult() {
  return {
    model: new Map(),
    eqs: new Map(),
    allVars: new Set(),
  };
}

function buildParsedScm(text) {
  const res = parseSCM(text);
  const eqs = depsFromModel(res.model);
  topoSort(eqs);
  return {
    model: res.model,
    eqs,
    allVars: res.allVars,
  };
}

function initScmState(initialText) {
  try {
    return {
      draftText: initialText,
      committedText: initialText,
      committed: buildParsedScm(initialText),
      error: "",
    };
  } catch (error) {
    return {
      draftText: initialText,
      committedText: "",
      committed: createEmptyResult(),
      error: error.message || String(error),
    };
  }
}

function scmModelReducer(state, action) {
  switch (action.type) {
    case "setDraft":
      return {
        ...state,
        draftText: action.text,
      };
    case "commit":
      return {
        draftText: action.text,
        committedText: action.text,
        committed: action.payload,
        error: "",
      };
    case "error":
      return {
        ...state,
        error: action.message,
      };
    default:
      return state;
  }
}

export function useScmModel(initialText) {
  const [state, dispatch] = useReducer(scmModelReducer, initialText, initScmState);

  const setScmText = useCallback((nextText) => {
    dispatch({ type: "setDraft", text: nextText });
  }, []);

  const applyScmChanges = useCallback(() => {
    try {
      const parsed = buildParsedScm(state.draftText);
      dispatch({ type: "commit", text: state.draftText, payload: parsed });
      return { ok: true, error: "" };
    } catch (error) {
      const message = error.message || String(error);
      dispatch({ type: "error", message });
      return { ok: false, error: message };
    }
  }, [state.draftText]);

  const graphSignature = useMemo(
    () => buildGraphSignature(state.committed.eqs),
    [state.committed.eqs]
  );

  return {
    scmText: state.draftText,
    setScmText,
    applyScmChanges,
    hasPendingChanges: state.draftText !== state.committedText,
    error: state.error,
    model: state.committed.model,
    eqs: state.committed.eqs,
    allVars: state.committed.allVars,
    graphSignature,
    appliedScmText: state.committedText,
  };
}

export { buildParsedScm, initScmState, scmModelReducer };
