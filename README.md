# webGphoto2 - A WASM web interface for gphoto2

## Description

A simple web wasm wrapper for gphoto2.
It allows you to control your camera (when compatible) from a web browser.

## Installation

1. Clone the repository
2. Install the package dependencies with `npm install` from the root of the project
3. Build the project with `npm run build`
4. Link the package for global use with `npm link`
5. Install the package in your project:

- with `npm link webgphoto2`
- manually add the package dependency in your project `package.json`

  ```json
  {
    "name": "",
    "version": "",
    "author": "",
    "scripts": {},
    "private": true,
    "dependencies": {
      "webgphoto": "file:path-to/webGphoto2"
    },
    "devDependencies": {}
  }
  ```

  then run `npm install`

## Usage

To use the package in your project just import it and create a new instance of the Camera class.

```typescript
camera = new Camera();
state: BehaviorSubject<CameraState> = this.camera.state;
events: BehaviorSubject<string> = this.camera.events;
```

### The camera wrapper right now only supports the following methods

- `showPicker(): Promise<void>`: Opens the camera device picker (Web USB is only available on Chromium based browsers)
- `connect(): Promise<void>`: Connects to the camera
- `disconnect(): Promise<void>`: Disconnects from the camera (disconnect runs destructor and frees the C++ instance, to reconnect you need to create a new Camera instance)
- `getConfig(): Promise<Config>`: Gets the camera configuration
- `getSupportedOps(): Promise<SupportedOps>`: Gets the supported operations
- `setConfigValue(name: string, value: string | number | boolean): Promise<void>`: Sets a configuration value
- `capturePreviewAsBlob(): Promise<Blob>`: Captures a preview image as a Blob object
- `captureImageAsFile(): Promise<File>`: Captures an image as a File object
- `consumeEvents(): Promise<boolean>`: Consumes the events from the camera
