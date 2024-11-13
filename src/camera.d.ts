export type { Config, SupportedOps } from './libapi';

export function rethrowIfCritical(err: any): void;

export class Camera {
  #private;
  static showPicker(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConfig(): Promise<{
    name: string;
    info: string;
    label: string;
    readonly: boolean;
  } & {
    type: "window";
    children: Record<string, import("./libapi").Config>;
  } & {
    type: "window";
  }>;
  getSupportedOps(): Promise<import("./libapi").SupportedOps>;
  setConfigValue(name: string, value: string | number | boolean): Promise<void>;
  capturePreviewAsBlob(): Promise<Blob>;
  captureImageAsFile(): Promise<File>;
  consumeEvents(): Promise<boolean>;
}

