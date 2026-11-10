const RingSnapshotPlatform = require('./src/platform');

module.exports = function(homebridge) {
  if (!homebridge || typeof homebridge.registerPlatform !== 'function') {
    return;
  }

  homebridge.registerPlatform('homebridge-ring-snapshot', 'RingSnapshot', RingSnapshotPlatform, true);
};

module.exports.RingSnapshotPlatform = RingSnapshotPlatform;
