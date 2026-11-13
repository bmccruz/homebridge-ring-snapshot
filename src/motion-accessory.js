class MotionAccessory {
  constructor(platform) {
    this.platform = platform;
    this.resetTimer = null;
    this.resetSeconds = Number(platform.config.motionResetSeconds || 10);

    const hap = platform.api.hap;
    const name = `${platform.config.cameraName || 'Ring Camera'} Motion`;
    const uuid = hap.uuid.generate(`ring-snapshot:${platform.config.cameraName}:motion`);

    this.accessory = new platform.api.platformAccessory(name, uuid);
    this.accessory.context = { type: 'motion', name };

    const info = this.accessory.getService(hap.Service.AccessoryInformation)
      || this.accessory.addService(hap.Service.AccessoryInformation);

    info
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(hap.Characteristic.Model, 'Motion Sensor')
      .setCharacteristic(hap.Characteristic.SerialNumber, `${platform.config.cameraName} Motion`);

    this.service = this.accessory.addService(hap.Service.MotionSensor, name);
    this.characteristic = this.service.getCharacteristic(hap.Characteristic.MotionDetected);
    this.characteristic.updateValue(false);
  }

  updateMotion(motionDetected) {
    const isDetected = Boolean(motionDetected);
    this.platform.log.debug(`Updating HomeKit motion sensor to: ${isDetected}`);
    this.characteristic.updateValue(isDetected);

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    if (isDetected && this.resetSeconds > 0) {
      this.resetTimer = setTimeout(() => {
        this.platform.log.debug(`Auto-resetting motion sensor to false after ${this.resetSeconds}s.`);
        this.characteristic.updateValue(false);
        this.resetTimer = null;
      }, this.resetSeconds * 1000);
    }
  }
}

module.exports = MotionAccessory;
