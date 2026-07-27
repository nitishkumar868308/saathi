/**
 * Config plugin — full-screen notification (alarm jaisa) lock screen par.
 *
 * notifee ka fullScreenAction app ki MainActivity ko launch karta hai. Wo lock
 * screen ke UPAR dikhe aur screen on ho, iske liye MainActivity par ye flags
 * chahiye. USE_FULL_SCREEN_INTENT permission app.json me already hai.
 *
 * Yeh sirf native build (EAS / prebuild) me apply hota hai — Expo Go me nahi.
 */
const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

module.exports = function withFullScreenNotifications(config) {
  return withAndroidManifest(config, (cfg) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    mainActivity.$["android:showWhenLocked"] = "true";
    mainActivity.$["android:turnScreenOn"] = "true";
    return cfg;
  });
};
