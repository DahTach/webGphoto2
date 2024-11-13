import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "es",
    },
    {
      file: "dist/index.mjs",
      format: "es",
    },
    {
      file: "dist/libapi.wasm",
      format: "es",
    },
  ],
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
    nodeResolve({ extensions: [".ts", ".js", ".mjs"] }),
  ],
  external: ["@angular/core", "rxjs"],
};
