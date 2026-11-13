class CleanupService {
  constructor(log, snapshotManager) {
    this.log = log;
    this.snapshotManager = snapshotManager;
    this.intervalId = null;
  }

  async run() {
    this.log.info('Running snapshot cleanup...');
    await this.snapshotManager.pruneOldSnapshots();
  }

  start() {
    if (this.intervalId) {
      return;
    }

    this.run().catch((error) => {
      this.log.error('Snapshot cleanup failed on startup:', error);
    });

    this.intervalId = setInterval(() => {
      this.run().catch((error) => {
        this.log.error('Scheduled snapshot cleanup failed:', error);
      });
    }, 24 * 60 * 60 * 1000);

    if (typeof this.intervalId.unref === 'function') {
      this.intervalId.unref();
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = CleanupService;
