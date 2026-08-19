import { registerRoot } from "remotion";

import { RemotionRoot } from "./Root";

/**
 * Remotion bundle ka entry point.
 *
 * `@remotion/bundler` isi file se shuru karta hai. Ise chhota rakhna zaroori
 * hai — yahan jo bhi import hoga wo har render ke bundle me jaayega.
 */
registerRoot(RemotionRoot);
