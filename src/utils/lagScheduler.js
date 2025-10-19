export function scheduleNodeDisplayUpdate(nodeTimerMap, pendingTimers, nodeId, delay, updateFn) {
  const map = nodeTimerMap;
  const pending = pendingTimers;
  const existing = map.get(nodeId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    updateFn();
    map.delete(nodeId);
  }, delay);
  map.set(nodeId, timer);
  pending.push(timer);
  return timer;
}

export function scheduleEdgePulse(edgeTimerMap, pendingTimers, edgeId, delay, pulseMs, setEdgeHot) {
  const map = edgeTimerMap;
  const pending = pendingTimers;
  const existing = map.get(edgeId);
  if (existing) {
    clearTimeout(existing.on);
    clearTimeout(existing.off);
    setEdgeHot((prev) => {
      if (!prev[edgeId]) return prev;
      const next = { ...prev };
      next[edgeId] = false;
      return next;
    });
  }
  const teOn = setTimeout(() => {
    setEdgeHot((prev) => ({ ...prev, [edgeId]: true }));
  }, delay);
  const teOff = setTimeout(() => {
    setEdgeHot((prev) => {
      if (!prev[edgeId]) return prev;
      const next = { ...prev };
      next[edgeId] = false;
      return next;
    });
    map.delete(edgeId);
  }, delay + pulseMs);
  map.set(edgeId, { on: teOn, off: teOff });
  pending.push(teOn, teOff);
  return { on: teOn, off: teOff };
}
