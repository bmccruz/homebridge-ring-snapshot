const fs = require('fs');

class CameraAccessory {
  constructor(platform) {
    this.platform = platform;
    this.log = platform.log;
    const name = platform.config.cameraName || 'Ring Camera';
    const uuid = platform.api.hap.uuid.generate(`ring-snapshot:${name}:camera`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'camera', name };

    const info = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Ring Snapshot Camera')
      .setCharacteristic(platform.api.hap.Characteristic.SerialNumber, name);

    this.accessory.addService(platform.api.hap.Service.Camera, name);

    const cameraController = new platform.api.hap.CameraController({
      name,
      cameraStreamCount: 0,
      delegate: {
        handleSnapshotRequest: (streamId, request, callback) => {
          this.platform.triggerSnapshot('snapshot')
            .then((result) => {
              if (result && result.buffer) {
                callback(null, result.buffer);
                return;
              }

              if (result && result.filePath && fs.existsSync(result.filePath)) {
                callback(null, fs.readFileSync(result.filePath));
                return;
              }

              callback(new Error('Snapshot not available.'));
            })
            .catch((error) => {
              this.log.error('Snapshot request failed:', error);
              callback(error);
            });
        },
        handleCloseConnection: () => {},
        handleStreamingRequest: (streamId, request, callback) => {
          callback(new Error('Streaming is not supported by this plugin.'));
        },
      },
    });

    this.accessory.configureController(cameraController);
    this.accessory.on('identify', () => this.log.info(`${name} identified.`));
  }
}

module.exports = CameraAccessory;
