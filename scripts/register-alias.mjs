// Registers the "@/..." resolution hook in the module loader thread, then lets
// the main script run. Used as `node --import ./scripts/register-alias.mjs …`:
// --import runs this for its side effect (the register call), which is the
// supported way to install a resolve hook — an exported `resolve` alone is not
// picked up by --import.
import { register } from "node:module";
register("./alias-hook.mjs", import.meta.url);
