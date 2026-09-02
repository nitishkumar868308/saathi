import { registerRoot } from "remotion";

import { WarpRoot } from "./WarpRoot";

/**
 * Spike ke bundle ka entry point — asli reel ke bundle se bilkul alag.
 *
 * Isse chhota rakhna zaroori hai: yahan jo bhi import hoga wo bundle me jaayega,
 * aur is spike ko sirf ek sawaal ka jawab dena hai.
 */
registerRoot(WarpRoot);
