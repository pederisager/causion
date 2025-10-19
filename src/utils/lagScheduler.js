/**
 * Schedule a visual update for a node. Multiple calls for the same node keep
 * their own timers so that downstream values can “stream” as parents change.
 */
export function scheduleNodeDisplayUpdate(nodeTimerMap, pendingTimers, nodeId, delay, updateFn) {
  const timersForNode = nodeTimerMap.get(nodeId) ?? new Set();
  if (!nodeTimerMap.has(nodeId)) {
    nodeTimerMap.set(nodeId, timersForNode);
  }

  const timer = setTimeout(() => {
    updateFn();
    timersForNode.delete(timer);
    if (timersForNode.size === 0) {
      nodeTimerMap.delete(nodeId);
    }
  }, delay);

  timersForNode.add(timer);
  pendingTimers.push(timer);
  return timer;
}

/**
 * Schedule a marching-ants pulse for an edge. We retain overlapping pulses by
 * reference-counting the "hot" state so rapid parent changes stay animated.
 */
export function scheduleEdgePulse(edgeTimerMap, pendingTimers, edgeId, delay, pulseMs, setEdgeHot) {
  const entry = edgeTimerMap.get(edgeId) ?? { timers: new Set(), activeCount: 0 };
  if (!edgeTimerMap.has(edgeId)) {
    edgeTimerMap.set(edgeId, entry);
  }

  const startHot = () => {
    entry.activeCount += 1;
    setEdgeHot((prev) => {
      if (prev[edgeId]) return prev;
      return { ...prev, [edgeId]: true };
    });
  };

  const stopHot = () => {
    entry.activeCount = Math.max(0, entry.activeCount - 1);
    if (entry.activeCount === 0) {
      setEdgeHot((prev) => {
        if (!prev[edgeId]) return prev;
        const next = { ...prev };
        next[edgeId] = false;
        return next;
      });
    }
  };

  const pair = {};
  pair.on = setTimeout(() => {
    startHot();
  }, delay);
  pair.off = setTimeout(() => {
    stopHot();
    entry.timers.delete(pair);
    if (entry.timers.size === 0) {
      edgeTimerMap.delete(edgeId);
    }
  }, delay + pulseMs);

  entry.timers.add(pair);
  pendingTimers.push(pair.on, pair.off);
  return pair;
}
