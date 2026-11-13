class SnapshotTriggerAccessory {
  constructor(platform) {
    this.platform = platform;
    const cameraName = platform.config.cameraName || 'Ring Camera';
    const name = `${cameraName} Snapshot`;
    const uuid = platform.api.hap.uuid.generate(`ring-snapshot:${cameraName}:snapshot-trigger`);

    const existingAccessory = platform.cachedAccessories.find((acc) => acc.UUID === uuid);
    if (existingAccessory) {
      this.accessory = existingAccessory;
    } else {
      this.accessory = new platform.api.platformAccessory(name, uuid);
    }

    this.accessory.context = { type: 'snapshot-trigger', name };

    const info = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Snapshot Trigger')
      .setCharacteristic(platform.api.hap.Characteristic.SerialNumber, `${cameraName} Snapshot Trigger`);

    this.service = this.accessory.getService(platform.api.hap.Service.Switch)
      || this.accessory.addService(platform.api.hap.Service.Switch, name);
    this.characteristic = this.service.getCharacteristic(platform.api.hap.Characteristic.On);

    this.characteristic.onSet(async (value) => {
      if (!value) {
        return;
      }

      this.platform.log.info('Manual snapshot triggered from HomeKit/UI.');

      try {
        await this.platform.triggerSnapshot('manual');
      } catch (error) {
        this.platform.log.error('Manual snapshot trigger failed:', error);
        throw error;
      } finally {
        setTimeout(() => {
          this.characteristic.updateValue(false);
        }, 1000);
      }
    });
  }
}

module.exports = SnapshotTriggerAccessory;
