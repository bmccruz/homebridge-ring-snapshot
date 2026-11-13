class DoorbellAccessory {
  constructor(platform) {
    this.platform = platform;
    const hap = platform.api.hap;
    const name = `${platform.config.cameraName || 'Ring Camera'} Doorbell`;
    const uuid = hap.uuid.generate(`ring-snapshot:${platform.config.cameraName}:doorbell`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'doorbell', name };

    const info = this.accessory.getService(hap.Service.AccessoryInformation)
      || this.accessory.addService(hap.Service.AccessoryInformation);

    info
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(hap.Characteristic.Model, 'Doorbell')
      .setCharacteristic(hap.Characteristic.SerialNumber, `${platform.config.cameraName} Doorbell`);

    this.service = this.accessory.addService(hap.Service.Doorbell, name);
    this.characteristic = this.service.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent);

    this.characteristic.setProps({
      validValues: [hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS],
    });
  }

  notifyPress() {
    this.platform.log.info('Triggering HomeKit doorbell event...');
    this.characteristic.updateValue(
      this.platform.api.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
    );
  }
}

module.exports = DoorbellAccessory;
