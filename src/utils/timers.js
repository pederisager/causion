/**
 * Timer utilities used by propagation hooks to orchestrate delayed updates and
 * marching-ants pulses.
 */
export function scheduleNodeDisplayUpdate(nodeTimerMap, pendingTimers, nodeId, delay, updateFn) {
  let entry = nodeTimerMap.get(nodeId);
  if (!entry) {
    entry = new Map();
    nodeTimerMap.set(nodeId, entry);
  }

  let bucket = entry.get(delay);
  if (!bucket) {
    bucket = { timer: null, hasQueued: false, latestUpdateFn: updateFn };
    entry.set(delay, bucket);
  } else {
    bucket.latestUpdateFn = updateFn;
  }

  if (bucket.timer) {
    bucket.hasQueued = true;
    return bucket.timer;
  }

  const timer = setTimeout(() => {
    bucket.latestUpdateFn();
    const index = pendingTimers.indexOf(timer);
    if (index !== -1) pendingTimers.splice(index, 1);
    bucket.timer = null;

    if (bucket.hasQueued) {
      bucket.hasQueued = false;
      scheduleNodeDisplayUpdate(nodeTimerMap, pendingTimers, nodeId, delay, bucket.latestUpdateFn);
      return;
    }

    entry.delete(delay);
    if (entry.size === 0) {
      nodeTimerMap.delete(nodeId);
    }
  }, delay);

  bucket.timer = timer;
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
    entry.forEach((bucket) => {
      if (bucket.timer) {
        clearTimeout(bucket.timer);
      }
      bucket.hasQueued = false;
    });
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
