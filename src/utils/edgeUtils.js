export function applyEdgeVisualState(
  edges,
  edgeHot,
  { causalFlow, flowPulseMs, edgeStraightening, stylePreset }
) {
  if (!Array.isArray(edges) || edges.length === 0) {
    return edges;
  }
  const baseType = causalFlow ? "causal" : edgeStraightening ? "straight" : undefined;
  let mutated = false;
  const nextEdges = edges.map((edge) => {
    const prevData = edge.data || {};
    const nextHot = causalFlow ? !!edgeHot?.[edge.id] : false;
    const nextData = {
      ...prevData,
      hot: nextHot,
      pulseMs: flowPulseMs,
      stylePreset,
    };
    if (
      edge.type === baseType &&
      prevData.hot === nextHot &&
      prevData.pulseMs === flowPulseMs &&
      prevData.stylePreset === stylePreset
    ) {
      return edge;
    }
    mutated = true;
    return {
      ...edge,
      type: baseType,
      data: nextData,
    };
  });
  return mutated ? nextEdges : edges;
}

export default applyEdgeVisualState;
