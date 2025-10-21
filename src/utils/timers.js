/**
 * Timer utilities used by propagation hooks to orchestrate delayed updates and
 * marching-ants pulses.
 */
export function scheduleNodeDisplayUpdate(nodeTimerMap, pendingTimers, nodeId, delay, updateFn) {
  let entry = nodeTimerMap.get(nodeId);
  if (!entry) {
    entry = { timer: null, hasQueued: false, nextDelay: delay, latestUpdateFn: updateFn };
    nodeTimerMap.set(nodeId, entry);
  } else {
    entry.nextDelay = delay;
    entry.latestUpdateFn = updateFn;
  }

  if (entry.timer) {
    entry.hasQueued = true;
    return entry.timer;
  }

  const timer = setTimeout(() => {
    entry.latestUpdateFn();
    const index = pendingTimers.indexOf(timer);
    if (index !== -1) pendingTimers.splice(index, 1);
    entry.timer = null;

    if (entry.hasQueued) {
      entry.hasQueued = false;
      scheduleNodeDisplayUpdate(
        nodeTimerMap,
        pendingTimers,
        nodeId,
        entry.nextDelay,
        entry.latestUpdateFn
      );
      return;
    }

    nodeTimerMap.delete(nodeId);
  }, delay);

  entry.timer = timer;
  pendingTimers.push(timer);
  return timer;
}

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

export function clearPendingTimers(pendingTimers, nodeTimerMap, edgeTimerMap) {
  pendingTimers.forEach((timer) => clearTimeout(timer));
  pendingTimers.length = 0;

  nodeTimerMap.forEach((entry) => {
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
  });
  nodeTimerMap.clear();

  edgeTimerMap.forEach((entry) => {
    entry.timers.forEach((pair) => {
      clearTimeout(pair.on);
      clearTimeout(pair.off);
    });
  });
  edgeTimerMap.clear();
}
