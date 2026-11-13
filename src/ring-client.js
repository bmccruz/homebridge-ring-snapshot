const fs = require('fs');
const { EventEmitter } = require('events');
const { RingApi } = require('ring-client-api');

class RingClientManager extends EventEmitter {
  constructor(log, config = {}, configPath = null) {
    super();
    this.log = log;
    this.config = config;
    this.configPath = configPath;
    this.refreshToken = config.refreshToken || '';
    this.cameraName = config.cameraName || 'Ring Camera';
    this.snapshotRetries = Number(config.snapshotRetries || 3);
    this.snapshotRetryDelayMs = Number(config.snapshotRetryDelayMs || 2000);
    this.api = null;
    this.camera = null;
  }

  saveUpdatedToken(newRefreshToken) {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      this.log.warn('Refresh token updated, but configPath is not set to persist it.');
      return;
    }

    try {
      const currentConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      const platformBlock = (currentConfig.platforms || []).find(
        (p) => p.platform === 'RingSnapshot'
      );

      if (platformBlock) {
        platformBlock.refreshToken = newRefreshToken;
        fs.writeFileSync(this.configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
        this.log.info('Updated Ring refreshToken saved to config.json.');
      }
    } catch (error) {
      this.log.error('Failed to save updated refreshToken to config.json:', error);
    }
  }

  async connect() {
    if (!this.refreshToken) {
      throw new Error('refreshToken is required for RingSnapshot.');
    }

    if (this.camera) {
      return this.camera;
    }

    this.log.info('Connecting to Ring API...');
    this.api = new RingApi({ refreshToken: this.refreshToken });

    this.api.onRefreshTokenUpdated.subscribe(({ newRefreshToken, oldRefreshToken }) => {
      if (!oldRefreshToken) {
        return;
      }
      this.log.debug('Ring refreshToken rotated, persisting new token...');
      this.saveUpdatedToken(newRefreshToken);
    });

    const cameras = await this.api.getCameras();
    if (!Array.isArray(cameras) || cameras.length === 0) {
      throw new Error('No Ring cameras were found for the provided refresh token.');
    }

    this.camera = cameras.find((camera) => {
      const name = (camera && camera.name) || '';
      return name.toLowerCase() === this.cameraName.toLowerCase();
    }) || cameras[0];

    if (!this.camera) {
      throw new Error('Unable to select a Ring camera.');
    }

    this.log.info(`Connected to Ring camera: ${this.camera.name}`);

    this.camera.onMotionDetected.subscribe((motionDetected) => {
      this.log.info(`Ring motion event received: ${motionDetected}`);
      this.emit('motion-changed', Boolean(motionDetected));
    });

    this.camera.onDoorbellPressed.subscribe((dingEvent) => {
      this.log.info('Ring doorbell pressed event received!');
      this.emit('doorbell', dingEvent || { type: 'doorbell' });
    });

    return this.camera;
  }

  async captureSnapshot(retries = this.snapshotRetries, delayMs = this.snapshotRetryDelayMs) {
    if (!this.camera) {
      throw new Error('Ring camera is not initialized.');
    }

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        this.log.debug(`Requesting snapshot for ${this.camera.name} (attempt ${attempt}/${retries})...`);
        return await this.camera.getSnapshot();
      } catch (error) {
        lastError = error;
        const message = error && error.message ? error.message : String(error);
        const shouldRetry = message.includes('unable to capture snapshots while streaming')
          || message.includes('failed to refresh after')
          || message.includes('ECONNRESET')
          || message.includes('ETIMEDOUT')
          || message.includes('timed out')
          || message.includes('network')
          || message.includes('fetch failed');

        if (attempt < retries && shouldRetry) {
          this.log.warn(`Snapshot failed for ${this.camera.name}: ${message}. Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }
}

module.exports = RingClientManager;
