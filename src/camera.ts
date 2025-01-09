/// <reference types="w3c-web-usb" />
import { initModule, Context, Module } from "./libapi";
import { BehaviorSubject } from "rxjs";

export enum CameraState {
  BUSY,
  READY,
  CONNECTED,
  DISCONNECTED,
  ERROR,
}

const INTERFACE_CLASS = 6; // PTP
const INTERFACE_SUBCLASS = 1; // MTP
const CANON_PID = 13026;
// TEST: Nikon D3200
// const CANON_PID = 1068;

let ModulePromise: Promise<Module>;

export class Camera {
  #queue: Promise<any> = Promise.resolve();
  #context: Context | null = null;

  private _state = new BehaviorSubject<CameraState>(CameraState.DISCONNECTED);
  public state = this._state.asObservable();

  private static device: USBDevice | null = null;

  constructor() {
    window.addEventListener("beforeunload", async () => {
      this.disconnect();
    });

    navigator.usb.addEventListener("disconnect", (event) => {
      console.log("disconnected device:", event.target);
      this._state.next(CameraState.DISCONNECTED);
    });
  }

  private async initializeCamera(camera: USBDevice): Promise<USBDevice> {
    await Promise.all([
      camera.open(),
      camera.selectConfiguration(1),
      camera.claimInterface(0),
    ]);

    if (Camera.device?.opened) Camera.device = camera;
    console.log("%c found paired camera", "color: green;", camera);
    return camera;
  }

  private async pairCamera(): Promise<USBDevice | null> {
    try {
      // Return cached device if available
      if (Camera.device?.opened) {
        console.log("%c camera already open", "color: yellow;", Camera.device);
        return Camera.device;
      }

      // Check existing devices
      const devices = await navigator.usb.getDevices();
      console.log(
        "%c found devices:",
        "color: blue;",
        devices,
        "\n looking for",
        CANON_PID,
      );
      const existingCamera = devices.find(
        (device) => device.productId === CANON_PID,
      );

      if (existingCamera) {
        // TODO:
        let camera: USBDevice | undefined;
        try {
          camera = await this.initializeCamera(existingCamera);
        } catch (error) {
          const was_open = await this.close();
          if (was_open) camera = await this.initializeCamera(existingCamera);
        } finally {
          if (camera) return camera;
        }
      }

      // If no camera found, request new device
      const newDevice = await navigator.usb.requestDevice({
        filters: [
          {
            classCode: INTERFACE_CLASS,
            subclassCode: INTERFACE_SUBCLASS,
          },
        ],
      });

      Camera.device = newDevice;
      return newDevice;
    } catch (error) {
      console.error("Camera pairing failed:", error);
      Camera.device = null;
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
    this.disconnect().then(() => {});
  }

  private async loadWASM(): Promise<void> {
    if (this.#context) return;

    try {
      if (!ModulePromise) {
        ModulePromise = initModule();
      }

      console.log("%c loading Wasm MODULE ...", "color: blue;");
      let Module: Module = await ModulePromise;
      console.log("%c gPhoto2 Wasm Module Loaded:", "color: green;", Module);

      console.log("%c loading Wasm CONTEXT ...", "color: blue;");
      this.#context = await new Module.Context();

      if (!this.#context) {
        console.log(
          "%c gPhoto2 Wasm Module Context Failed:",
          "color: red;",
          "context is:",
          this.#context,
        );
      }
      console.log(
        "%c gPhoto2 Wasm Module Context Instantiated Successfully:",
        "color: green;",
        this.#context,
      );
    } catch (error) {
      this._state.next(CameraState.ERROR);
      throw error;
    }
  }

  public async connect(): Promise<void> {
    if (!Camera.device || !Camera.device.opened) {
      await this.pairCamera();
    }

    await this.loadWASM();

    if (Camera.device && this.#context) {
      this._state.next(CameraState.CONNECTED);
      console.log("%c camera connected successfully", "color: green;");
      this._state.next(CameraState.READY);
    }
  }

  // CAMERA OPERATIONS

  // PREVIEW MODE
  private previewActive = false;
  private previewStream: Promise<void> | null = null;

  public async startPreview(onFrame: (blob: Blob) => void) {
    if (this.previewActive) return;

    this.#queue = Promise.resolve();

    console.log("%c preview started", "color: cyan;");

    this.previewActive = true;
    this._state.next(CameraState.BUSY);
    this.previewStream = this.streamFrames(onFrame);

    return this.previewStream;
  }

  public async stopPreview(): Promise<void> {
    if (!this.previewActive) return;

    this.previewActive = false;
    this.previewStream = null;
    this._state.next(CameraState.READY);
    await this.cancelCurrentOperation();
    console.log("%c preview stopped", "color: cyan;");
  }

  private async streamFrames(onFrame: (blob: Blob) => void) {
    while (this.previewActive) {
      try {
        const blob = await this.capturePreviewAsBlob();
        onFrame(blob);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } catch (error: any) {
        console.error("error capturing preview as blob:", error);
        if (error.message !== "Camera is not ready") {
          this.previewActive = false;
          throw error;
        }
      }
    }
  }

  private async capturePreviewAsBlob() {
    return this.#schedule((context) => context.capturePreviewAsBlob());
  }

  // CAPTURE MODE
  async captureImage(): Promise<File> {
    if (this.previewActive) await this.stopPreview();

    console.log("%c capturing image", "color: cyan;");

    this._state.next(CameraState.BUSY);
    try {
      const file = await this.#schedule((context) =>
        context.captureImageAsFile(),
      );
      return file;
    } catch (error) {
      this._state.next(CameraState.ERROR);
      throw error;
    } finally {
      this._state.next(CameraState.READY);
    }
  }

  async captureImageAsFile() {
    return this.#schedule((context) => context.captureImageAsFile());
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
      console.log("%c events consumed", "color: yellow;");
    } else {
      console.log("%c no events to consume", "color: blue;");
    }
    this.#queue = Promise.resolve();
  }

  async disconnect() {
    if (this.#context && !this.#context.isDeleted()) {
      this.#context.delete();
    }

    this.#context = null;
    this.#queue = Promise.resolve();

    await this.close();

    this._state.next(CameraState.DISCONNECTED);

    console.log("%c webgphoto deinstantiated successfully", "color: green;");
  }

  async close(): Promise<boolean> {
    if (Camera.device?.opened) {
      await Camera.device?.reset();
      await Camera.device?.close();
      await Camera.device?.releaseInterface(0);
      console.log("%c camera reset", "color: yellow;", Camera.device);
      return true;
    }

    console.log("%c found no open camera to close ", "color: orange;");
    return false;
  }
}
