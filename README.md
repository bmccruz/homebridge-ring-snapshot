<div align="center">
  <img src="banner.jpg" alt="Software Banner" width="100%">
  <p>☕ <strong>Support the project:</strong> <a href="https://buymeacoffee.com/bmccruz">Buy Me a Coffee</a></p>
</div>

# Homebridge Ring Snapshot Plugin

A lightweight Homebridge plugin for exposing Ring camera snapshots, motion detection, doorbell events, and a manual snapshot trigger. Ideal for low-powered devices such as the Raspberry Pi Zero and slower internet connections.

## Installation

1. Install the plugin in your Homebridge environment:

```bash
npm install --save homebridge-ring-snapshot
```

2. Add the platform to your `config.json`:

```json
{
  "platforms": [
    {
      "platform": "RingSnapshot",
      "name": "Ring Snapshot",
      "refreshToken": "YOUR_RING_REFRESH_TOKEN",
      "cameraName": "Doorbell Camera",
      "snapshotDirectory": "/var/lib/homebridge/ring-snapshots",
      "retentionDays": 10,
      "cooldownSeconds": 60,
      "motionResetSeconds": 10,
      "snapshotRetries": 3,
      "snapshotRetryDelayMs": 2000,
      "snapshotOnMotion": true,
      "snapshotOnDoorbell": true,
      "enableMotionSensor": true,
      "enableDoorbell": true,
      "enableSnapshotTrigger": true
    }
  ]
}
```

## Configuration

### Main parameters

- `refreshToken`: Ring refresh token used to authenticate with the Ring API.
- `cameraName`: exact name of the Ring camera to select.
- `snapshotDirectory`: folder where snapshots are written.
- `retentionDays`: how long snapshots are retained before automatic cleanup.
- `cooldownSeconds`: minimum time between repeated snapshot captures.
- `motionResetSeconds`: time after which motion is reset to `false`.
- `snapshotRetries`: number of retry attempts when a snapshot request fails temporarily.
- `snapshotRetryDelayMs`: delay in milliseconds between retry attempts.
- `snapshotOnMotion`: captures a snapshot when motion is detected.
- `snapshotOnDoorbell`: captures a snapshot when the doorbell is pressed.
- `enableMotionSensor`: enables the HomeKit motion sensor accessory.
- `enableDoorbell`: enables the HomeKit doorbell accessory.
- `enableSnapshotTrigger`: enables the manual snapshot switch accessory.

## Snapshot storage structure

Files are stored in `snapshotDirectory` using this layout:

```text
/var/lib/homebridge/ring-snapshots/
├── latest.jpg
├── motion-20261110-153045.jpg
├── doorbell-20261110-153200.jpg
├── manual-20261110-153430.jpg
└── ...
```

- `latest.jpg`: most recent snapshot captured.
- `motion-*`: snapshots triggered by motion events.
- `doorbell-*`: snapshots triggered by doorbell presses.
- `manual-*`: snapshots triggered manually by the switch.

## Features

- HomeKit camera accessory exposing JPEG snapshots.
- Motion sensor based on Ring motion notifications.
- Doorbell event notifications in HomeKit.
- Manual snapshot trigger via a HomeKit switch for automations.
- Automatic cleanup of expired snapshots.
- Cooldown protection to avoid excessive image generation.
- Local disk storage only, with no database dependency.

## Compatibility

- Homebridge 1.5.0+
- Node.js 16+
- Raspberry Pi Zero
- `ring-client-api` 14.x

## Troubleshooting

### The camera does not appear

- Check that `refreshToken` is valid.
- Confirm the exact camera name in `cameraName`.
- Review Homebridge logs with debug logging enabled.

### Snapshots are not generated

- Verify that the `snapshotDirectory` is writable.
- Confirm that the Ring camera allows snapshot access.
- If the camera is actively streaming, the Ring API may temporarily refuse a new snapshot; the plugin includes retry logic via `snapshotRetries` and `snapshotRetryDelayMs`.

### Motion events do not fire

- Confirm the camera is registered in the Ring account.
- Check that the Ring API is able to receive notifications from the device.

## License

This project is licensed under the MIT license.
