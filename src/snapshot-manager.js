const fs = require('fs');
const path = require('path');

class SnapshotManager {
  constructor(log, snapshotDirectory, retentionDays = 30, cooldownSeconds = 60) {
    this.log = log;
    this.snapshotDirectory = snapshotDirectory;
    this.retentionDays = Number(retentionDays) || 30;
    this.cooldownSeconds = Number(cooldownSeconds) || 60;
    this.cooldownMs = this.cooldownSeconds * 1000;
    this.lastSnapshotAt = 0;
    this.latestFilePath = path.join(this.snapshotDirectory, 'latest.jpg');
    this.snapshotProvider = null;
    this.inFlightCapture = null;
  }

  setSnapshotProvider(snapshotProvider) {
    this.snapshotProvider = snapshotProvider;
  }

  ensureDirectory() {
    if (!fs.existsSync(this.snapshotDirectory)) {
      fs.mkdirSync(this.snapshotDirectory, { recursive: true });
    }

    this.latestFilePath = path.join(this.snapshotDirectory, 'latest.jpg');
    return this.snapshotDirectory;
  }

  getLatestSnapshot() {
    this.ensureDirectory();
    if (fs.existsSync(this.latestFilePath)) {
      return fs.readFileSync(this.latestFilePath);
    }
    return null;
  }

  formatTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  getFileName(prefix = 'manual') {
    return `${prefix}-${this.formatTimestamp()}.jpg`;
  }

  async captureSnapshot(label = 'manual', options = {}) {
    if (this.inFlightCapture) {
      this.log.debug(`Snapshot capture already in progress, joining existing request (${label})...`);
      return this.inFlightCapture;
    }

    this.inFlightCapture = this._executeCapture(label, options).finally(() => {
      this.inFlightCapture = null;
    });

    return this.inFlightCapture;
  }

  async _executeCapture(label = 'manual', options = {}) {
    const { ignoreCooldown = false, force = false } = options;
    this.ensureDirectory();

    if (!this.snapshotProvider) {
      throw new Error('Snapshot provider is not configured.');
    }

    const now = Date.now();
    const elapsedMs = now - this.lastSnapshotAt;
    const shouldSkipCooldown = !ignoreCooldown && !force && this.lastSnapshotAt > 0 && elapsedMs < this.cooldownMs;

    if (shouldSkipCooldown) {
      const remainingSec = Math.ceil((this.cooldownMs - elapsedMs) / 1000);
      this.log.debug(`Skipping ${label} snapshot (cooldown active: ${remainingSec}s remaining).`);

      if (fs.existsSync(this.latestFilePath)) {
        const buffer = fs.readFileSync(this.latestFilePath);
        return { filePath: this.latestFilePath, buffer, skipped: true };
      }

      return { filePath: null, buffer: null, skipped: true };
    }

    const buffer = await this.snapshotProvider();
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Snapshot provider did not return a JPEG buffer.');
    }

    const fileName = this.getFileName(label);
    const filePath = path.join(this.snapshotDirectory, fileName);

    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(this.latestFilePath, buffer);
    this.lastSnapshotAt = Date.now();

    this.log.info(`Saved snapshot: ${filePath}`);

    return {
      filePath,
      latestFilePath: this.latestFilePath,
      buffer,
      skipped: false,
    };
  }

  async pruneOldSnapshots() {
    this.ensureDirectory();

    if (!fs.existsSync(this.snapshotDirectory)) {
      return [];
    }

    const now = Date.now();
    const cutoffMs = this.retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.snapshotDirectory);
    const deleted = [];

    for (const file of files) {
      if (file === 'latest.jpg') {
        continue;
      }

      const filePath = path.join(this.snapshotDirectory, file);
      const stat = fs.statSync(filePath);
      const ageMs = now - stat.mtimeMs;

      if (stat.isFile() && ageMs > cutoffMs) {
        fs.unlinkSync(filePath);
        deleted.push(filePath);
      }
    }

    if (deleted.length > 0) {
      this.log.info(`Removed ${deleted.length} expired snapshot(s).`);
    }

    return deleted;
  }
}

module.exports = SnapshotManager;
