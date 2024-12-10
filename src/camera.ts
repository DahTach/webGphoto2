/// <reference types="w3c-web-usb" />
import { initModule, Context, Module } from './libapi';
import { BehaviorSubject } from 'rxjs';

export enum CameraState {
  BUSY,
  READY,
  CONNECTED,
  DISCONNECTED,
  ERROR
}

const INTERFACE_CLASS = 6; // PTP
const INTERFACE_SUBCLASS = 1; // MTP
// const CANON_PID = 13026;
// TEST: Nikon D3200
const CANON_PID = 1068;

let ModuleFactory: Promise<Module>

export class Camera {

  #queue: Promise<any> = Promise.resolve();
  #context: Context | null = null;

  public state = new BehaviorSubject<CameraState>(CameraState.DISCONNECTED);

  private device: USBDevice | null = null

  constructor() { }

  private async pairCamera(): Promise<USBDevice | null> {
    try {
      // Return cached device if available
      if (this.device?.opened) {
        console.log('Camera already opened:', this.device)
        return this.device;
      }

      // Check existing devices
      const devices = await navigator.usb.getDevices();
      console.log('found devices:', devices, 'looking for:', CANON_PID)
      const existingCamera = devices.find(device => device.productId === CANON_PID);


      if (existingCamera) {
        await existingCamera.open();
        await existingCamera.selectConfiguration(1);
        await existingCamera.claimInterface(0);
        this.device = existingCamera;
        console.log('Camera found:', existingCamera)
        return existingCamera;
      }

      // If no camera found, request new device
      const newDevice = await navigator.usb.requestDevice({
        filters: [{
          classCode: INTERFACE_CLASS,
          subclassCode: INTERFACE_SUBCLASS
        }]
      });

      this.device = newDevice;
      return newDevice;

    } catch (error) {
      console.error('Camera pairing failed:', error);
      this.device = null;
      return null;
    }
  }

  rethrowIfCritical(err: any): boolean {
    if (err?.constructor !== Error) {
      throw err;
    }
    return false;
  }

  // TODO:
  private async handleError() {
    await this.attemptRecovery();
  }

  // TODO:
  private async attemptRecovery() {
    this.disconnect().then(() => { })
  }

  private async loadWASM(): Promise<void> {
    if (this.#context) return
    var module: any = null;
    try {
      if (!ModuleFactory) {
        ModuleFactory = initModule();
      }
      module = await ModuleFactory;
      console.log('loading context...')
      // FIX: why the fuck is this a promise?
      this.#context = await new module.Context();
      console.log('Context loaded:', this.#context)
    } catch (error) {
      this.state.next(CameraState.ERROR);
      throw error;
    } finally {
      console.log('%c gPhoto2 Wasm Module Loaded:', 'color: green;', module);
    }
  }

  public async connect(): Promise<void> {
    if (!this.device || !this.device.opened) {
      await this.pairCamera()
    }
    await this.loadWASM();
  }


  // CAMERA OPERATIONS

  // PREVIEW MODE
  private previewActive = false;
  private previewStream: Promise<void> | null = null;

  public async startPreview(onFrame: (blob: Blob) => void) {
    if (this.previewActive) return;

    this.previewActive = true;
    this.state.next(CameraState.BUSY);
    this.previewStream = this.streamFrames(onFrame);

    return this.previewStream;
  }

  public async stopPreview(): Promise<void> {
    if (!this.previewActive) return

    this.previewActive = false;
    this.previewStream = null;
    await this.cancelCurrentOperation();
    // setTimeout(() => {
    this.state.next(CameraState.READY);
    // }, 1000);
    console.log('Preview stopped')
  }

  private async streamFrames(onFrame: (blob: Blob) => void) {
    while (this.previewActive) {
      try {
        const blob = await this.capturePreviewAsBlob();
        onFrame(blob);
        await new Promise(resolve => requestAnimationFrame(resolve));
      } catch (error: any) {
        console.error('Preview frame error:', error);
        if (error.message !== 'Camera is not ready') {
          this.previewActive = false;
          throw error;
        }
      }
    }
  }

  private async capturePreviewAsBlob() {
    return this.#schedule(context => context.capturePreviewAsBlob());
  }

  // CAPTURE MODE
  async captureImage(): Promise<File> {
    if (this.previewActive) await this.stopPreview();

    this.state.next(CameraState.BUSY);
    try {

      const file = await this.#schedule(context => context.captureImageAsFile());

      // TEST: for the autofocus slow capture
      // const had_events = await this.consumeEvents();
      // if (had_events) {
      //   console.log('Events were consumed before capture');
      // } else {
      //   console.log('No events were consumed before capture');
      // }
      return file;
    } catch (error) {
      this.state.next(CameraState.ERROR);
      throw error;
    } finally {
      this.state.next(CameraState.READY);
    }
  }

  async captureImageAsFile() {
    return this.#schedule(context => context.captureImageAsFile());
  }


  // DRIVER OPERATIONS

  // AVOID CONCURRENT OPERATIONS
  async #schedule<T>(op: (context: Context) => Promise<T>): Promise<T> {
    let res = this.#queue.then(() => op(this.#context!));
    this.#queue = res.catch(this.rethrowIfCritical);
    return res;
  }

  // CONSUME PENDING EVENTS
  private async consumeEvents(): Promise<boolean> {
    return this.#schedule((context: Context) => context.consumeEvents());
  }

  async cancelCurrentOperation() {
    const had_events = await this.consumeEvents();
    if (had_events) {
      console.log('Events were consumed before cancel');
    } else {
      console.log('No events were consumed before cancel');
    }
    this.#queue = Promise.resolve();
  }

  async disconnect() {
    this.state.next(CameraState.DISCONNECTED);
    if (this.#context && !this.#context.isDeleted()) {
      this.#context.delete();
    }
    this.#context = null;
  }

}
