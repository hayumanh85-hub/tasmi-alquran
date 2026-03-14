/* Minimal Element SDK stub for local/static usage.
   The original HTML expects window.elementSdk.init + setConfig. */
(function () {
  if (window.elementSdk) return;

  const STORAGE_KEY = 'elementSdk.config.v1';

  function safeClone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  function readStoredConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStoredConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config ?? {}));
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }

  let currentConfig = {};
  let onConfigChange = null;

  function emitConfigChange() {
    try {
      if (typeof onConfigChange === 'function') onConfigChange(safeClone(currentConfig));
    } catch (e) {
      // don't break page if consumer throws
      console.error(e);
    }
  }

  window.elementSdk = {
    init({ defaultConfig, onConfigChange: occ } = {}) {
      onConfigChange = occ;
      const stored = readStoredConfig();
      currentConfig = { ...(defaultConfig || {}), ...(stored || {}) };
      emitConfigChange();
      return { isOk: true };
    },

    setConfig(partial) {
      currentConfig = { ...(currentConfig || {}), ...(partial || {}) };
      writeStoredConfig(currentConfig);
      emitConfigChange();
      return { isOk: true };
    },

    getConfig() {
      return safeClone(currentConfig);
    }
  };
})();
