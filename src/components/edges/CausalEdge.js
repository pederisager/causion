import React from "react";
import { getStraightPath } from "reactflow";

export default function CausalEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const hot = Boolean(data?.hot);
  const pulseMs = Math.max(100, Number(data?.pulseMs ?? 800));
  const animationSeconds = Math.max(0.3, pulseMs / 800);

  const basePath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "#111",
    strokeWidth: hot ? 3 : 2,
  });

  const marchingAnts = hot
    ? React.createElement("path", {
        d: edgePath,
        fill: "none",
        stroke: "#fff",
        strokeWidth: hot ? 3.5 : 3,
        strokeDasharray: "8 8",
        strokeLinecap: "butt",
        style: { animation: `antsForward ${animationSeconds}s linear infinite` },
      })
    : null;

  const markerDef = React.createElement(
    "defs",
    null,
    React.createElement("marker", {
      id: `arrow-${id}`,
      markerWidth: "10",
      markerHeight: "10",
      refX: "9",
      refY: "3",
      orient: "auto",
      markerUnits: "strokeWidth",
    }, React.createElement("path", { d: "M0,0 L0,6 L9,3 z", fill: "#111" }))
  );

  const arrowPath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "transparent",
    strokeWidth: 2,
    markerEnd: `url(#arrow-${id})`,
  });

  return React.createElement("g", null, basePath, marchingAnts, markerDef, arrowPath);
}
