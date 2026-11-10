class DoorbellAccessory {
  constructor(platform) {
    this.platform = platform;
    const name = `${platform.config.cameraName || 'Ring Camera'} Doorbell`;
    const uuid = platform.api.hap.uuid.generate(`ring-snapshot:${platform.config.cameraName}:doorbell`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'doorbell', name };

    const info = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Doorbell')
      .setCharacteristic(platform.api.hap.Characteristic.SerialNumber, `${platform.config.cameraName} Doorbell`);

    this.service = this.accessory.addService(platform.api.hap.Service.Doorbell, name);
    this.characteristic = this.service.getCharacteristic(platform.api.hap.Characteristic.ProgrammableSwitchEvent);
    this.characteristic.updateValue(0);
  }

  notifyPress() {
    this.characteristic.setValue(this.platform.api.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
  }
}

module.exports = DoorbellAccessory;
