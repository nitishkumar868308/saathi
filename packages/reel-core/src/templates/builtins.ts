import type { Template } from "./schema";

/**
 * Built-in templates (17.6 / 17.7) — **sirf data**.
 *
 * Yahan koi code nahi hai: har entry batati hai ki kaun se scene, kis kram me,
 * aur unke slots me kya. `applyTemplate()` inhe `SCENE_TYPES.build()` se guzaar
 * kar ek poora editable doc bana deta hai.
 *
 * ⚠️ Koi `targetPreset` yahan **hadd nahi** hai. Teeno templates 9:16, 1:1 aur
 * 16:9 teeno par lagte hain, kyunki scene types sab kuch frame ke percent me
 * banate hain. `targetPreset` sirf itna batata hai ki inhe banate waqt kya soch
 * kar banaya gaya tha.
 */

/**
 * Rahul + Papa — Apka Saathi ki apni kahani (17.6).
 *
 * Chhah scene: Rahul ki baat, Papa ka jawab, dikkat, app ka screen recording,
 * ek optional chehra/lipsync ki jagah, aur CTA.
 *
 * ⚠️ Paanchva scene (character) ka slot **optional** hai. Uski wajah asli hai:
 * lipsync/avatar Phase 24 me hai aur ho sakta hai kabhi na aaye. Use zaroori
 * banane par ye template tab tak bekaar rehta, jabki uske bina bhi poori reel
 * ban jaati hai.
 */
const RAHUL_PAPA: Template = {
  id: "rahul-papa",
  name: "Rahul + Papa",
  description:
    "Beta-baap ki baatcheet: dikkat batao, app dikhao, aur ek saaf CTA par khatam karo.",
  thumbnail: null,
  targetPreset: "reel",
  slots: [
    {
      key: "rahulLine",
      label: "Rahul kya kehta hai",
      kind: "text",
      required: true,
      hint: "Ek chhoti line — 8-10 shabd se zyada nahi",
      multiline: true,
      defaultValue: "Papa, aapka pension ka kaam abhi tak nahi hua?",
    },
    {
      key: "papaLine",
      label: "Papa kya kehte hain",
      kind: "text",
      required: true,
      hint: "Jawab me hi dikkat aani chahiye",
      multiline: true,
      defaultValue: "Teen baar office gaya, har baar kuch naya maang lete hain.",
    },
    {
      key: "problemLine",
      label: "Dikkat ek line me",
      kind: "text",
      required: true,
      hint: "Ye wo line hai jise dekhne wala apni kahani samjhta hai",
      multiline: true,
      defaultValue: "Sarkari kaam me sabse mushkil ye hai ki kisi ko poora process pata hi nahi hota.",
    },
    {
      key: "appRecording",
      label: "App ka screen recording",
      kind: "video",
      required: true,
      hint: "10-15 second ka saaf recording — ek hi kaam dikhao",
      multiline: false,
      defaultValue: null,
    },
    {
      key: "characterImage",
      label: "Chehra / character (optional)",
      kind: "image",
      required: false,
      hint: "Na ho to ye scene chhod diya jaayega",
      multiline: false,
      defaultValue: null,
    },
    {
      key: "ctaLine",
      label: "CTA",
      kind: "text",
      required: true,
      hint: "Ek hi kaam batao — do batane par dono nahi hote",
      multiline: false,
      defaultValue: "Apka Saathi par poora process free me dekho",
    },
    {
      key: "music",
      label: "Background music",
      kind: "audio",
      required: false,
      hint: "Na ho to reel bina music ke banegi",
      multiline: false,
      defaultValue: null,
    },
  ],
  scenes: [
    { type: "text", name: "Rahul", durationSeconds: 3, slots: { text: "@rahulLine" } },
    { type: "text", name: "Papa", durationSeconds: 3.5, slots: { text: "@papaLine" } },
    { type: "text", name: "Dikkat", durationSeconds: 4, slots: { text: "@problemLine" } },
    {
      type: "screen_recording",
      name: "App",
      durationSeconds: null,
      slots: { video: "@appRecording" },
    },
    {
      type: "image",
      name: "Character",
      durationSeconds: 2.5,
      slots: { image: "@characterImage" },
    },
    { type: "cta", name: "CTA", durationSeconds: 3, slots: { text: "@ctaLine" } },
    { type: "music", name: "Music", durationSeconds: null, slots: { audio: "@music" } },
  ],
};

/** App feature demo (17.7) — screen recording + captions + CTA. */
const APP_DEMO: Template = {
  id: "app-demo",
  name: "App feature demo",
  description: "Ek feature, teen line, aur ek CTA. Sabse chhoti aur sabse kaam ki reel.",
  thumbnail: null,
  targetPreset: "reel",
  slots: [
    {
      key: "hook",
      label: "Pehli line (hook)",
      kind: "text",
      required: true,
      hint: "Pehle 2 second me ye hi tay karta hai ki koi rukega ya nahi",
      multiline: true,
      defaultValue: "Ye kaam ab ghar baithe ho jaata hai",
    },
    {
      key: "recording",
      label: "Screen recording",
      kind: "video",
      required: true,
      hint: "Sirf ek kaam dikhao, poora app nahi",
      multiline: false,
      defaultValue: null,
    },
    {
      key: "caption",
      label: "Recording ke upar caption",
      kind: "text",
      required: false,
      hint: "Ek line — kya ho raha hai",
      multiline: true,
      defaultValue: "Form bhar kar submit — bas itna hi",
    },
    {
      key: "ctaLine",
      label: "CTA",
      kind: "text",
      required: true,
      hint: "",
      multiline: false,
      defaultValue: "Aaj hi try karo — bilkul free",
    },
  ],
  scenes: [
    { type: "text", name: "Hook", durationSeconds: 2.5, slots: { text: "@hook" } },
    {
      type: "screen_recording",
      name: "Demo",
      durationSeconds: null,
      slots: { video: "@recording", caption: "@caption" },
    },
    { type: "cta", name: "CTA", durationSeconds: 3, slots: { text: "@ctaLine" } },
  ],
};

/** Testimonial (17.7) — photo + voice + quote. */
const TESTIMONIAL: Template = {
  id: "testimonial",
  name: "Testimonial",
  description: "Ek asli aadmi, ek asli baat. Photo, unki awaaz, aur unka quote.",
  thumbnail: null,
  targetPreset: "reel",
  slots: [
    {
      key: "photo",
      label: "Unki photo",
      kind: "image",
      required: true,
      hint: "Chehra saaf dikhna chahiye",
      multiline: false,
      defaultValue: null,
    },
    {
      key: "voice",
      label: "Unki awaaz",
      kind: "audio",
      required: false,
      hint: "Na ho to sirf text dikhega",
      multiline: false,
      defaultValue: null,
    },
    {
      key: "quote",
      label: "Quote",
      kind: "text",
      required: true,
      hint: "Unke apne shabd — sudhaarne se asliyat chali jaati hai",
      multiline: true,
      defaultValue: "Mujhe laga tha ye kaam mahina lega. Do din me ho gaya.",
    },
    {
      key: "name",
      label: "Naam aur jagah",
      kind: "text",
      required: true,
      hint: "Jaise: Sunita Devi, Patna",
      multiline: false,
      defaultValue: "Sunita Devi, Patna",
    },
  ],
  scenes: [
    {
      type: "image_audio",
      name: "Unki baat",
      durationSeconds: null,
      slots: { image: "@photo", audio: "@voice", caption: "@quote" },
    },
    { type: "text", name: "Naam", durationSeconds: 2, slots: { text: "@name" } },
  ],
};

export const BUILTIN_TEMPLATES: readonly Template[] = [RAHUL_PAPA, APP_DEMO, TESTIMONIAL];

export function findTemplate(id: string): Template | undefined {
  return BUILTIN_TEMPLATES.find((template) => template.id === id);
}
