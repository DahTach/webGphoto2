export type { Config, SupportedOps } from './libapi';
export declare function rethrowIfCritical(err: any): void;
export enum CameraState {
  BUSY,
  READY,
  CONNECTED,
  DISCONNECTED,
  ERROR
}
export declare class Camera {
  #private;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startPreview(onFrame: (blob: Blob) => void): Promise<void>;
  stopPreview(): Promise<void>;
  captureImage(): Promise<File>;
}
