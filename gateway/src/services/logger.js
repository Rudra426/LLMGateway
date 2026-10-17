const RequestLog = require('../models/RequestLog');

let buffer = [];
let timer = null;
let isFlushing = false;

function startPeriodicFlush() {
  if (!timer) {
    timer = setInterval(flushNow, 5000);
  }
}

function stopPeriodicFlush() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function logRequest(entry) {
  try {
    buffer.push(entry);

    if (buffer.length > 1000) {
      // Drop the oldest entries to prevent memory leak
      buffer = buffer.slice(buffer.length - 1000);
    }

    if (buffer.length >= 50) {
      // Trigger async flush without awaiting, to not block caller
      setImmediate(flushNow);
    }
  } catch (err) {
    // Must never throw, catch any synchronous edge cases
    console.warn('[Logger] Error queuing log entry');
  }
}

async function flushNow() {
  if (isFlushing || buffer.length === 0) return;
  
  isFlushing = true;
  // Copy buffer to process and clear current buffer so it can accept new logs
  const batch = [...buffer];
  buffer = [];

  try {
    await RequestLog.insertMany(batch, { ordered: false });
  } catch (error) {
    console.warn('[Logger] Flush failed, restoring batch. Reason:', error.message || 'unknown');
    // Prepend the failed batch back to the buffer to retry
    buffer = [...batch, ...buffer];
    if (buffer.length > 1000) {
      buffer = buffer.slice(buffer.length - 1000);
    }
  } finally {
    isFlushing = false;
  }
}

module.exports = {
  logRequest,
  flushNow,
  startPeriodicFlush,
  stopPeriodicFlush
};
