// Place each topological rank on a vertical grid. Searching a small set of
// rows keeps long causal edges out of unrelated nodes without drifting the
// whole graph into a diagonal staircase.

function rowChoices(rowCount, nodeCount, start = 0, chosen = [], result = []) {
  if (chosen.length === nodeCount) {
    result.push([...chosen]);
    return result;
  }
  for (let row = start; row <= rowCount - (nodeCount - chosen.length); row += 1) {
    chosen.push(row);
    rowChoices(rowCount, nodeCount, row + 1, chosen, result);
    chosen.pop();
  }
  return result;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fraction = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  ));
  return Math.hypot(
    point.x - start.x - fraction * dx,
    point.y - start.y - fraction * dy
  );
}

function edgesCross(first, second) {
  if (
    first.source === second.source || first.source === second.target ||
    first.target === second.source || first.target === second.target
  ) return false;

  const side = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const a = side(first.start, first.end, second.start);
  const b = side(first.start, first.end, second.end);
  const c = side(second.start, second.end, first.start);
  const d = side(second.start, second.end, first.end);
  return a * b < 0 && c * d < 0;
}

export function placeLayers(layers, parentMap, rank, {
  nodeWidth,
  nodeHeight,
  nodeSeparation,
  rankSeparation,
}) {
  if (!layers.length) return {};

  const maxRows = Math.max(...layers.map((layer) => layer.length));
  const rowCount = Math.max(3, maxRows + 2);
  const rowStep = nodeHeight + nodeSeparation;
  // Deeper graphs need shorter gaps so fitView does not shrink every node.
  const rankGap = Math.max(50, rankSeparation - 30 * Math.max(0, layers.length - 3));
  const xForRank = (index) => 50 + index * (nodeWidth + rankGap);
  const center = (node) => ({
    x: node.x + nodeWidth / 2,
    y: node.y + nodeHeight / 2,
  });

  // Very large graphs use the same aligned rows without the combinatorial
  // search, keeping Apply Changes responsive as the graph grows.
  if (maxRows > 10 || layers.reduce((count, layer) => count + layer.length, 0) > 50) {
    const positions = {};
    layers.forEach((layer, index) => {
      const firstRow = Math.floor((maxRows - layer.length) / 2);
      layer.forEach((id, offset) => {
        positions[id] = { x: xForRank(index), y: 50 + (firstRow + offset) * rowStep };
      });
    });
    return positions;
  }

  const choicesBySize = new Map();
  const getChoices = (size) => {
    if (!choicesBySize.has(size)) choicesBySize.set(size, rowChoices(rowCount, size));
    return choicesBySize.get(size);
  };

  let beam = [{ positions: {}, edges: [], score: 0, maxRow: 0, signature: "" }];
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    const candidates = [];
    for (const state of beam) {
      for (const rows of getChoices(layer.length)) {
        // Moving every node down produces the same drawing, so anchor rank 0.
        if (index === 0 && rows[0] !== 0) continue;
        const positions = { ...state.positions };
        layer.forEach((id, offset) => {
          positions[id] = {
            x: xForRank(index),
            y: 50 + rows[offset] * rowStep,
            row: rows[offset],
          };
        });

        const newEdges = [];
        let addedScore = rows.reduce((sum, row) => sum + row / 2, 0);
        for (const child of layer) {
          for (const parent of parentMap.get(child) ?? []) {
            const edge = {
              source: parent,
              target: child,
              start: center(positions[parent]),
              end: center(positions[child]),
            };
            const gap = index - (rank.get(parent) ?? 0);
            addedScore += Math.abs(positions[child].row - positions[parent].row) *
              (gap > 1 ? 16 * gap : 8);

            // A line through another node is worse than a crossing, and a
            // crossing is worse than using one more row.
            for (const [id, node] of Object.entries(positions)) {
              if (id === parent || id === child) continue;
              if (distanceToSegment(center(node), edge.start, edge.end) < nodeWidth / 2 + 8) {
                addedScore += 10000;
              }
            }
            for (const other of [...state.edges, ...newEdges]) {
              if (edgesCross(edge, other)) addedScore += 250;
            }
            newEdges.push(edge);
          }
        }

        const maxRow = Math.max(state.maxRow, ...rows);
        candidates.push({
          positions,
          edges: [...state.edges, ...newEdges],
          score: state.score + addedScore + (maxRow - state.maxRow) * 20,
          maxRow,
          signature: state.signature + rows.map((row) => String(row).padStart(2, "0")).join(""),
        });
      }
    }
    candidates.sort((a, b) => a.score - b.score || a.signature.localeCompare(b.signature));
    beam = candidates.slice(0, 128);
  }

  const result = {};
  for (const [id, { x, y }] of Object.entries(beam[0].positions)) {
    result[id] = { x, y };
  }
  return result;
}
