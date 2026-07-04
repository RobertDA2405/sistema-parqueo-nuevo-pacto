(function () {
  "use strict";

  ParkingStore.init();

  if (ParkingStore.getSessionUser()) {
    window.location.href = "dashboard.html";
    return;
  }

  document.body.innerHTML = `
    <main class="login-view">
      <section class="login-panel">
        <div class="login-brand">
          <span class="brand-mark">P</span>
          <strong>El Nuevo Pacto</strong>
        </div>
        <h1>Control de parqueo</h1>
        <p>Registro operativo de entradas, salidas, turnos, prepagos, usuarios y reportes.</p>
      </section>
      <section class="login-box">
        <form class="login-card" id="loginForm">
          <h2>Acceso</h2>
          <div class="form-grid">
            <div class="field">
              <label for="username">Usuario</label>
              <input id="username" name="username" autocomplete="username" required>
            </div>
            <div class="field">
              <label for="password">Contrasena</label>
              <input id="password" name="password" type="password" autocomplete="current-password" required>
            </div>
            <div id="loginMessage"></div>
            <button class="btn primary" type="submit">Entrar</button>
          </div>
        </form>
      </section>
    </main>
  `;

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const user = ParkingStore.login(form.get("username"), form.get("password"));
    const message = document.getElementById("loginMessage");

    if (!user) {
      message.innerHTML = '<div class="notice danger">Usuario o contrasena incorrectos.</div>';
      return;
    }

    window.location.href = "dashboard.html";
  });
})();
