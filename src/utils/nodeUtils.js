export function applyNodeData(nodes, displayValues, ranges, stylePreset, interventions, controlledVars) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return nodes;
  }
  const controlledLookup = controlledVars
    ? controlledVars instanceof Set
      ? controlledVars
      : new Set(controlledVars)
    : null;
  let mutated = false;
  const nextNodes = nodes.map((node) => {
    const currentData = node.data || {};
    const range = ranges?.[node.id] || { min: -100, max: 100 };
    const nextValue = displayValues?.[node.id] ?? 0;
    const shouldTrackControlled =
      !!controlledLookup || Object.prototype.hasOwnProperty.call(currentData, "isControlled");
    const nextControlled = controlledLookup ? controlledLookup.has(node.id) : currentData.isControlled;
    const nextData = {
      ...currentData,
      id: node.id,
      value: nextValue,
      min: range.min,
      max: range.max,
      stylePreset,
      doActive: !!interventions?.[node.id],
      ...(shouldTrackControlled ? { isControlled: !!nextControlled } : {}),
    };
    if (
      currentData.value === nextValue &&
      currentData.min === range.min &&
      currentData.max === range.max &&
      currentData.id === node.id &&
      currentData.stylePreset === stylePreset &&
      !!currentData.doActive === !!nextData.doActive &&
      (!shouldTrackControlled || !!currentData.isControlled === !!nextData.isControlled)
    ) {
      return node;
    }
    mutated = true;
    return {
      ...node,
      data: nextData,
    };
  });
  return mutated ? nextNodes : nodes;
}

export default applyNodeData;
