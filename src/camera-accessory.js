const fs = require('fs');

class CameraAccessory {
  constructor(platform) {
    this.platform = platform;
    this.log = platform.log;
    const hap = platform.api.hap;
    const name = platform.config.cameraName || 'Ring Camera';
    const uuid = hap.uuid.generate(`ring-snapshot:${name}:camera`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'camera', name };

    const info = this.accessory.getService(hap.Service.AccessoryInformation)
      || this.accessory.addService(hap.Service.AccessoryInformation);

    info
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(hap.Characteristic.Model, 'Ring Snapshot Camera')
      .setCharacteristic(hap.Characteristic.SerialNumber, name);

    const cameraController = new hap.CameraController({
      cameraStreamCount: 1,
      delegate: {
        handleSnapshotRequest: (request, callback) => {
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
        prepareStream: (request, callback) => {
          callback(new Error('Streaming is not supported by this plugin.'));
        },
        handleStreamRequest: () => {},
      },
      streamingOptions: {
        supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            new Array(1920, 1080, 30),
            new Array(1280, 720, 30),
            new Array(640, 480, 30),
            new Array(320, 240, 15),
          ],
          codec: {
            profiles: [hap.H264Profile.MAIN],
            levels: [hap.H264Level.LEVEL3_1],
          },
        },
      },
    });

    this.accessory.configureController(cameraController);
    this.accessory.on('identify', () => this.log.info(`${name} identified.`));
  }
}

module.exports = CameraAccessory;
