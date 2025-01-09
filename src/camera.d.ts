export type { Config, SupportedOps } from "./libapi";
import { Observable } from "rxjs";
export declare function rethrowIfCritical(err: any): void;
export enum CameraState {
  BUSY,
  READY,
  CONNECTED,
  DISCONNECTED,
  ERROR,
}
export declare class Camera {
  #private;
  state: Observable<CameraState>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  startPreview(onFrame: (blob: Blob) => void): Promise<void>;
  stopPreview(): Promise<void>;
  captureImage(): Promise<File>;
}
