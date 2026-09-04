// Compatibility shim: the implementation lives in `./columns.ts`
// (canonical home for the column domain). Import from there in new code.
/**
 * @deprecated Import `extractColumnConfigs` from `./columns.ts` (or the
 * package root) instead. Kept as a shim for one minor.
 */
export { extractColumnConfigs } from "./columns.ts";
