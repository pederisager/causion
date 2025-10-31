export function applyNodeData(nodes, displayValues, ranges, stylePreset, interventions) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return nodes;
  }
  let mutated = false;
  const nextNodes = nodes.map((node) => {
    const currentData = node.data || {};
    const range = ranges?.[node.id] || { min: -100, max: 100 };
    const nextValue = displayValues?.[node.id] ?? 0;
    const nextData = {
      ...currentData,
      id: node.id,
      value: nextValue,
      min: range.min,
      max: range.max,
      stylePreset,
      doActive: !!interventions?.[node.id],
    };
    if (
      currentData.value === nextValue &&
      currentData.min === range.min &&
      currentData.max === range.max &&
      currentData.id === node.id &&
      currentData.stylePreset === stylePreset &&
      !!currentData.doActive === !!nextData.doActive
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
