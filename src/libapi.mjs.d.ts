import type { Module } from './libapi.types';

declare const initModule: EmscriptenModuleFactory<Module>;
export default initModule;
