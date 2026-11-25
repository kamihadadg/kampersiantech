(function () {
  "use strict";

  async function api(path, opts) {
    const o = opts || {};
    const res = await fetch(path, {
      method: o.method || "GET",
      credentials: "same-origin",
      headers: o.body ? { "Content-Type": "application/json" } : undefined,
      body: o.body != null ? JSON.stringify(o.body) : undefined
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "request_failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function status() {
    return api("/api/auth/status");
  }

  function setup(body) {
    return api("/api/auth/setup", { method: "POST", body: body });
  }

  function login(username, password) {
    return api("/api/auth/login", { method: "POST", body: { username: username, password: password } });
  }

  function logout() {
    return api("/api/auth/logout", { method: "POST", body: {} });
  }

  function me() {
    return api("/api/auth/me");
  }

  function users() {
    return api("/api/users");
  }

  function createUser(body) {
    return api("/api/users", { method: "POST", body: body });
  }

  function updateUser(id, body) {
    return api("/api/users/" + id, { method: "PUT", body: body });
  }

  function getSettings() {
    return api("/api/settings");
  }

  function saveSettings(settings) {
    return api("/api/settings", { method: "PUT", body: { settings: settings } });
  }

  function roleLabel(role) {
    return role === "parent" ? "والد" : "فرزند";
  }

  window.AUTH = {
    api: api,
    status: status,
    setup: setup,
    login: login,
    logout: logout,
    me: me,
    users: users,
    createUser: createUser,
    updateUser: updateUser,
    getSettings: getSettings,
    saveSettings: saveSettings,
    roleLabel: roleLabel
  };
})();
