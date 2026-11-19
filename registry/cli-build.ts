import { writeBuild } from "./write-build";

try { writeBuild(process.cwd(), "dist"); console.log("dist/ 만듦"); }
catch (e) { console.error(String(e)); process.exit(1); }
