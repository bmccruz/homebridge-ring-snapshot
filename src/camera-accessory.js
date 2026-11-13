const fs = require('fs');
const { spawn } = require('child_process');
const pathToFfmpeg = require('ffmpeg-for-homebridge');

class CameraAccessory {
  constructor(platform) {
    this.platform = platform;
    this.log = platform.log;
    this.api = platform.api;
    this.hap = platform.api.hap;
    this.pendingSessions = new Map();
    this.ongoingSessions = new Map();

    const name = platform.config.cameraName || 'Ring Camera';
    const uuid = this.hap.uuid.generate(`ring-snapshot:${name}:camera`);
    const isDoorbell = Boolean(platform.config.enableDoorbell);

    const category = isDoorbell
      ? this.hap.Categories.VIDEO_DOORBELL
      : this.hap.Categories.CAMERA;

    const existingAccessory = platform.cachedAccessories.find((acc) => acc.UUID === uuid);
    if (existingAccessory) {
      this.accessory = existingAccessory;
      this.accessory.category = category;
    } else {
      this.accessory = new this.api.platformAccessory(name, uuid, category);
    }

    this.accessory.context = { type: 'camera', name };

    const info = this.accessory.getService(this.hap.Service.AccessoryInformation)
      || this.accessory.addService(this.hap.Service.AccessoryInformation);

    info
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Ring')
      .setCharacteristic(this.hap.Characteristic.Model, 'Ring Snapshot Camera')
      .setCharacteristic(this.hap.Characteristic.SerialNumber, name);

    if (isDoorbell) {
      this.doorbellService = this.accessory.getService(this.hap.Service.Doorbell)
        || this.accessory.addService(this.hap.Service.Doorbell, name);
    } else {
      const oldDoorbell = this.accessory.getService(this.hap.Service.Doorbell);
      if (oldDoorbell) {
        this.accessory.removeService(oldDoorbell);
      }
      this.doorbellService = null;
    }

    const cameraController = new this.hap.CameraController({
      cameraStreamCount: 2,
      delegate: {
        handleSnapshotRequest: (request, callback) => {
          this.getLatestSnapshotBuffer()
            .then((buffer) => callback(null, buffer))
            .catch((error) => {
              this.log.error('Snapshot request failed:', error);
              callback(error);
            });
        },
        prepareStream: (request, callback) => {
          this.prepareStream(request, callback);
        },
        handleStreamRequest: (request) => {
          this.handleStreamRequest(request);
        },
      },
      streamingOptions: {
        supportedCryptoSuites: [this.hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            new Array(1920, 1080, 30),
            new Array(1280, 720, 30),
            new Array(640, 480, 30),
            new Array(320, 240, 15),
          ],
          codec: {
            profiles: [this.hap.H264Profile.MAIN],
            levels: [this.hap.H264Level.LEVEL3_1],
          },
        },
      },
    });

    this.accessory.configureController(cameraController);
    this.accessory.on('identify', () => this.log.info(`${name} identified.`));
  }

  notifyPress() {
    if (this.doorbellService) {
      this.log.info('Triggering HomeKit doorbell press event...');
      this.doorbellService
        .getCharacteristic(this.hap.Characteristic.ProgrammableSwitchEvent)
        .updateValue(this.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
    }
  }

  async getLatestSnapshotBuffer() {
    if (this.platform.snapshotManager) {
      const cachedBuffer = this.platform.snapshotManager.getLatestSnapshot();
      if (cachedBuffer) {
        return cachedBuffer;
      }
    }

    const result = await this.platform.triggerSnapshot('snapshot');
    if (result && result.buffer) {
      return result.buffer;
    }
    if (result && result.filePath && fs.existsSync(result.filePath)) {
      return fs.readFileSync(result.filePath);
    }
    throw new Error('Snapshot not available.');
  }

  prepareStream(request, callback) {
    const sessionId = request.sessionID;
    const targetAddress = request.targetAddress;
    const video = request.video;

    const ssrc = this.hap.CameraController.generateSynchronisationSource();

    this.pendingSessions.set(sessionId, {
      address: targetAddress,
      videoPort: video.port,
      videoCryptoSuite: video.srtpCryptoSuite,
      videoSRTP: Buffer.concat([video.srtp_key, video.srtp_salt]),
      videoSSRC: ssrc,
    });

    callback(null, {
      video: {
        port: video.port,
        ssrc: ssrc,
        srtp_key: video.srtp_key,
        srtp_salt: video.srtp_salt,
      },
    });
  }

  async handleStreamRequest(request) {
    const sessionId = request.sessionID;

    if (request.type === this.hap.StreamRequestTypes.START) {
      const sessionInfo = this.pendingSessions.get(sessionId);
      if (!sessionInfo) {
        return;
      }

      try {
        const imageBuffer = await this.getLatestSnapshotBuffer();
        const video = request.video;
        const width = video.width || 1280;
        const height = video.height || 720;
        const fps = video.fps || 15;
        const maxBitrate = video.max_bit_rate || 300;
        const payloadType = video.pt || 99;
        const mtu = video.mtu || 1378;
        const srtpParams = sessionInfo.videoSRTP.toString('base64');

        const ffmpegArgs = [
          '-re',
          '-loop', '1',
          '-f', 'image2pipe',
          '-vcodec', 'mjpeg',
          '-i', 'pipe:0',
          '-an',
          '-sn',
          '-dn',
          '-vcodec', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', `${fps}`,
          '-f', 'rawvideo',
          '-tune', 'zerolatency',
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
          '-b:v', `${maxBitrate}k`,
          '-bufsize', `${2 * maxBitrate}k`,
          '-maxrate', `${maxBitrate}k`,
          '-payload_type', `${payloadType}`,
          '-ssrc', `${sessionInfo.videoSSRC}`,
          '-f', 'rtp',
          '-srtp_out_suite', 'AES_CM_128_HMAC_SHA1_80',
          '-srtp_out_params', srtpParams,
          `srtp://${sessionInfo.address}:${sessionInfo.videoPort}?rtcpport=${sessionInfo.videoPort}&pkt_size=${mtu}`,
        ];

        const ffmpegBinary = pathToFfmpeg || 'ffmpeg';
        const ffmpegProcess = spawn(ffmpegBinary, ffmpegArgs, { env: process.env });

        ffmpegProcess.stdin.on('error', () => {});
        ffmpegProcess.stdin.write(imageBuffer);
        ffmpegProcess.stdin.end();

        ffmpegProcess.stderr.on('data', (data) => {
          this.log.debug(`FFmpeg: ${data.toString()}`);
        });

        ffmpegProcess.on('close', () => {
          this.ongoingSessions.delete(sessionId);
        });

        this.ongoingSessions.set(sessionId, ffmpegProcess);
        this.pendingSessions.delete(sessionId);
      } catch (error) {
        this.log.error('Failed to start snapshot stream:', error);
        this.pendingSessions.delete(sessionId);
      }
    } else if (request.type === this.hap.StreamRequestTypes.STOP) {
      const ffmpegProcess = this.ongoingSessions.get(sessionId);
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        this.ongoingSessions.delete(sessionId);
      }
      this.pendingSessions.delete(sessionId);
    }
  }
}

module.exports = CameraAccessory;
