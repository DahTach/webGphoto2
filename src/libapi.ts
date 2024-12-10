export * from './libapi.mjs';

// Add the type declaration here
import type { Module } from './libapi.mjs';
declare const initModule: EmscriptenModuleFactory<Module>;

// Re-export initModule from the .mjs file
export { default as initModule } from './libapi.mjs';
