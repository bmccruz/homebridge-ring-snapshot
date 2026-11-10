const DEFAULT_CONFIG = {
  name: 'Ring Snapshot',
  refreshToken: '',
  cameraName: 'Portão',
  snapshotDirectory: '/var/lib/homebridge/ring-snapshots',
  retentionDays: 30,
  cooldownSeconds: 60,
  motionResetSeconds: 10,
  snapshotOnMotion: true,
  snapshotOnDoorbell: true,
  enableMotionSensor: true,
  enableDoorbell: true,
  enableSnapshotTrigger: true,
  snapshotRetries: 3,
  snapshotRetryDelayMs: 2000,
};

module.exports = {
  DEFAULT_CONFIG,
  PLATFORM_NAME: 'RingSnapshot',
  PLUGIN_NAME: 'homebridge-ring-snapshot',
  FILE_PREFIXES: {
    motion: 'motion',
    doorbell: 'doorbell',
    manual: 'manual',
    snapshot: 'snapshot',
  },
};
