const { DEFAULT_CONFIG, PLATFORM_NAME, PLUGIN_NAME } = require('./constants');
const RingClientManager = require('./ring-client');
const SnapshotManager = require('./snapshot-manager');
const CleanupService = require('./cleanup-service');
const CameraAccessory = require('./camera-accessory');
const MotionAccessory = require('./motion-accessory');
const DoorbellAccessory = require('./doorbell-accessory');
const SnapshotTriggerAccessory = require('./snapshot-trigger');

class RingSnapshotPlatform {
  constructor(log, config = {}, api) {
    this.log = log;
    this.api = api;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.cachedAccessories = [];
    this.ringClient = null;
    this.snapshotManager = null;
    this.cleanupService = null;
    this.cameraAccessory = null;
    this.motionAccessory = null;
    this.doorbellAccessory = null;
    this.snapshotTriggerAccessory = null;

    if (this.api && typeof this.api.on === 'function') {
      this.api.on('didFinishLaunching', () => {
        this.initialize().catch((error) => {
          this.log.error('Failed to initialize RingSnapshot platform:', error);
        });
      });
    }
  }

  configureAccessory(accessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.log.info('Initializing RingSnapshot platform...');

    this.snapshotManager = new SnapshotManager(
      this.log,
      this.config.snapshotDirectory,
      Number(this.config.retentionDays || DEFAULT_CONFIG.retentionDays),
      Number(this.config.cooldownSeconds || DEFAULT_CONFIG.cooldownSeconds)
    );

    const configPath = this.api && this.api.user && typeof this.api.user.configPath === 'function'
      ? this.api.user.configPath()
      : null;

    this.ringClient = new RingClientManager(this.log, this.config, configPath);
    await this.ringClient.connect();

    this.snapshotManager.setSnapshotProvider(async () => this.ringClient.captureSnapshot());
    this.snapshotManager.ensureDirectory();
    await this.snapshotManager.pruneOldSnapshots();

    this.ringClient.on('motion-changed', (motionDetected) => {
      if (this.motionAccessory) {
        this.motionAccessory.updateMotion(motionDetected);
      }

      if (motionDetected && this.config.snapshotOnMotion) {
        this.triggerSnapshot('motion').catch((error) => {
          this.log.error('Motion snapshot failed:', error);
        });
      }
    });

    this.ringClient.on('doorbell', () => {
      if (this.doorbellAccessory) {
        this.doorbellAccessory.notifyPress();
      }

      if (this.config.snapshotOnDoorbell) {
        this.triggerSnapshot('doorbell').catch((error) => {
          this.log.error('Doorbell snapshot failed:', error);
        });
      }
    });

    this.createAccessories();
    this.cleanupService = new CleanupService(this.log, this.snapshotManager);
    this.cleanupService.start();

    this.initialized = true;
    this.log.info('RingSnapshot platform initialized.');
  }

  createAccessories() {
    const accessories = [];

    this.cameraAccessory = new CameraAccessory(this);
    accessories.push(this.cameraAccessory.accessory);

    if (this.config.enableMotionSensor) {
      this.motionAccessory = new MotionAccessory(this);
      accessories.push(this.motionAccessory.accessory);
    }

    if (this.config.enableDoorbell) {
      this.doorbellAccessory = new DoorbellAccessory(this);
      accessories.push(this.doorbellAccessory.accessory);
    }

    if (this.config.enableSnapshotTrigger) {
      this.snapshotTriggerAccessory = new SnapshotTriggerAccessory(this);
      accessories.push(this.snapshotTriggerAccessory.accessory);
    }

    const toRegister = accessories.filter(
      (acc) => !this.cachedAccessories.some((cached) => cached.UUID === acc.UUID)
    );

    if (toRegister.length > 0 && this.api && typeof this.api.registerPlatformAccessories === 'function') {
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRegister);
    }
  }

  async triggerSnapshot(label = 'manual') {
    if (!this.snapshotManager) {
      throw new Error('Snapshot manager is not initialized.');
    }

    const force = label === 'manual';
    return this.snapshotManager.captureSnapshot(label, { force });
  }
}

module.exports = RingSnapshotPlatform;
