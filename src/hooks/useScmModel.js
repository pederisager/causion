import { useMemo, useState } from "react";
import { parseSCM } from "../graph/parser.js";
import { depsFromModel, topoSort } from "../graph/topology.js";
import { buildGraphSignature } from "../utils/graphSignature.js";

const EMPTY_RESULT = {
  model: new Map(),
  eqs: new Map(),
  allVars: new Set(),
};

export function useScmModel(initialText) {
  const [scmText, setScmText] = useState(initialText);

  const parsed = useMemo(() => {
    try {
      const res = parseSCM(scmText);
      const eqs = depsFromModel(res.model);
      topoSort(eqs);
      return {
        model: res.model,
        eqs,
        allVars: res.allVars,
        error: "",
      };
    } catch (error) {
      return {
        ...EMPTY_RESULT,
        error: error.message || String(error),
      };
    }
  }, [scmText]);

  const graphSignature = useMemo(() => buildGraphSignature(parsed.eqs), [parsed.eqs]);

  return {
    scmText,
    setScmText,
    error: parsed.error,
    model: parsed.model,
    eqs: parsed.eqs,
    allVars: parsed.allVars,
    graphSignature,
  };
}
