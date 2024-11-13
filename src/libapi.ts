export * from './libapi.types';

// Add the type declaration here
import type { Module } from './libapi.types';
declare const initModule: EmscriptenModuleFactory<Module>;

// Re-export initModule from the .mjs file
export { default as initModule } from './libapi.mjs';
