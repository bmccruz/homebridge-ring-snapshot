class MotionAccessory {
  constructor(platform) {
    this.platform = platform;
    const name = `${platform.config.cameraName || 'Ring Camera'} Motion`;
    const uuid = platform.api.hap.uuid.generate(`ring-snapshot:${platform.config.cameraName}:motion`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'motion', name };

    const info = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Motion Sensor')
      .setCharacteristic(platform.api.hap.Characteristic.SerialNumber, `${platform.config.cameraName} Motion`);

    this.service = this.accessory.addService(platform.api.hap.Service.MotionSensor, name);
    this.characteristic = this.service.getCharacteristic(platform.api.hap.Characteristic.MotionDetected);
    this.characteristic.updateValue(false);
  }

  updateMotion(motionDetected) {
    this.characteristic.updateValue(Boolean(motionDetected));
  }
}

module.exports = MotionAccessory;
