import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "build/index.js",
      format: "es",
    },
    {
      file: "build/index.mjs",
      format: "es",
    },
    {
      file: "build/libapi.wasm",
      format: "es",
    },
  ],
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
    nodeResolve({ extensions: [".ts", ".js", ".mjs"] }),
  ],
  external: ["@angular/core", "rxjs"],
};
