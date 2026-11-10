class SnapshotTriggerAccessory {
  constructor(platform) {
    this.platform = platform;
    const name = `${platform.config.cameraName || 'Ring Camera'} Snapshot`;
    const uuid = platform.api.hap.uuid.generate(`ring-snapshot:${platform.config.cameraName}:snapshot-trigger`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'snapshot-trigger', name };

    const info = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Snapshot Trigger')
      .setCharacteristic(platform.api.hap.Characteristic.SerialNumber, `${platform.config.cameraName} Snapshot Trigger`);

    this.service = this.accessory.addService(platform.api.hap.Service.Switch, name);
    this.characteristic = this.service.getCharacteristic(platform.api.hap.Characteristic.On);
    this.characteristic.onSet = (value, callback) => {
      if (!value) {
        callback();
        return;
      }

      this.platform.triggerSnapshot('manual')
        .then(() => {
          setTimeout(() => {
            this.characteristic.updateValue(false);
          }, 1000);
          callback();
        })
        .catch((error) => {
          this.platform.log.error('Manual snapshot trigger failed:', error);
          callback(error);
        });
    };
  }
}

module.exports = SnapshotTriggerAccessory;
