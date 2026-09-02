import { registerItemComponent } from "./components";
import { AudioItem } from "./items/AudioItem";
import { ImageItem } from "./items/ImageItem";
import { ShapeItem } from "./items/ShapeItem";
import { SubtitleItem } from "./items/SubtitleItem";
import { TalkingPhotoItem } from "./items/TalkingPhotoItem";
import { TextItem } from "./items/TextItem";
import { VideoItem } from "./items/VideoItem";

/**
 * Built-in components ko unke `componentKey` se jodo.
 *
 * Keys wahi hain jo `@reel/core` ki ITEM_TYPES registry me likhi hain. Naya item
 * type jodna = ek component file + core me ek registry entry + yahan ek line.
 * `ItemRenderer` ya kisi doosri file me kuch nahi badalta.
 *
 * Import ke side-effect par bharosa nahi kiya — module order badalne par wo
 * chupchaap toot jaata hai, aur "screen khaali hai par error kahin nahi" wale
 * bug sabse mehnge hote hain.
 */

let registered = false;

export function registerBuiltinItemComponents(): void {
  if (registered) return;
  registered = true;
  registerItemComponent("ImageItem", ImageItem);
  registerItemComponent("VideoItem", VideoItem);
  registerItemComponent("AudioItem", AudioItem);
  registerItemComponent("TextItem", TextItem);
  registerItemComponent("ShapeItem", ShapeItem);
  registerItemComponent("SubtitleItem", SubtitleItem);
  registerItemComponent("TalkingPhotoItem", TalkingPhotoItem);
}
