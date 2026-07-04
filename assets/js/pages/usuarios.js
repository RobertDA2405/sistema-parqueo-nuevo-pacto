(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Usuarios", active: "usuarios.html", permission: "gestionar_usuarios" },
    ({ main, user }) => {
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header"><h2 id="formTitle">Nuevo usuario</h2></div>
            <div class="panel-body">
              <form id="userForm" class="form-grid">
                <input type="hidden" name="id" id="userId">
                <div class="inline-fields">
                  <div class="field">
                    <label for="username">Nombre de usuario</label>
                    <input id="username" name="username" maxlength="40" autocomplete="off" required>
                  </div>
                  <div class="field">
                    <label for="password">Contrasena</label>
                    <input id="password" name="password" type="password" autocomplete="new-password">
                  </div>
                </div>
                <div class="inline-fields">
                  <div class="field">
                    <label for="role">Rol</label>
                    <select id="role" name="role">
                      <option value="Administrador">Administrador</option>
                      <option value="Cajero">Cajero</option>
                      <option value="Guardia">Guardia</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="active">Estado</label>
                    <select id="active" name="active">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label>Permisos especificos</label>
                  <div class="permission-grid" id="permissionGrid"></div>
                </div>
                <div id="userMessage"></div>
                <div class="actions">
                  <button class="btn primary" type="submit">Guardar usuario</button>
                  <button class="btn ghost" id="resetUserForm" type="button">Nuevo</button>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Usuarios registrados</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Permisos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="userRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      const form = document.getElementById("userForm");
      const permissionGrid = document.getElementById("permissionGrid");

      function renderPermissions(selected) {
        const selectedSet = new Set(selected || []);
        permissionGrid.innerHTML = ParkingStore.permissions
          .map(
            (permission) => `
              <label class="check-row">
                <input type="checkbox" name="permissions" value="${ParkingStore.escapeHtml(permission.key)}" ${
                  selectedSet.has(permission.key) ? "checked" : ""
                }>
                <span>${ParkingStore.escapeHtml(permission.label)}</span>
              </label>
            `
          )
          .join("");
      }

      function applyRolePreset() {
        const role = document.getElementById("role").value;
        renderPermissions(ParkingStore.rolePresets[role] || []);
      }

      function resetForm() {
        form.reset();
        document.getElementById("userId").value = "";
        document.getElementById("formTitle").textContent = "Nuevo usuario";
        document.getElementById("password").required = true;
        applyRolePreset();
      }

      function renderRows() {
        const db = ParkingStore.getData();
        document.getElementById("userRows").innerHTML = db.users
          .map(
            (item) => `
              <tr>
                <td><strong>${ParkingStore.escapeHtml(item.username)}</strong></td>
                <td>${ParkingStore.escapeHtml(item.role)}</td>
                <td>${item.active ? '<span class="badge active">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
                <td>${item.role === "Administrador" ? "Todos" : Number((item.permissions || []).length)}</td>
                <td>
                  <div class="actions">
                    <button class="btn small ghost edit-user" data-id="${ParkingStore.escapeHtml(item.id)}" type="button">Editar</button>
                    ${
                      item.id === user.id
                        ? '<span class="badge">Sesion actual</span>'
                        : `<button class="btn small danger delete-user" data-id="${ParkingStore.escapeHtml(item.id)}" type="button">Eliminar</button>`
                    }
                  </div>
                </td>
              </tr>
            `
          )
          .join("");
      }

      document.getElementById("role").addEventListener("change", applyRolePreset);
      document.getElementById("resetUserForm").addEventListener("click", resetForm);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const message = document.getElementById("userMessage");

        try {
          ParkingStore.transact((db) => {
            const id = String(formData.get("id") || "");
            const username = String(formData.get("username") || "").trim();
            const password = String(formData.get("password") || "");
            const role = String(formData.get("role") || "Guardia");
            const active = String(formData.get("active")) === "true";
            const permissions =
              role === "Administrador" ? ParkingStore.rolePresets.Administrador : formData.getAll("permissions");
            const existing = id ? db.users.find((item) => item.id === id) : null;

            if (!username) throw new Error("El usuario no puede estar vacio.");
            if (!["Administrador", "Cajero", "Guardia"].includes(role)) throw new Error("Rol invalido.");
            if (!existing && !password) throw new Error("La contrasena es obligatoria para usuarios nuevos.");
            if (db.users.some((item) => item.id !== id && item.username.toLowerCase() === username.toLowerCase())) {
              throw new Error("Ya existe un usuario con ese nombre.");
            }
            if (existing && existing.id === user.id && !active) {
              throw new Error("No puedes desactivar la sesion actual.");
            }

            if (existing) {
              existing.username = username;
              if (password) existing.password = password;
              existing.role = role;
              existing.permissions = permissions;
              existing.active = active;
              existing.updatedAt = new Date().toISOString();
              return;
            }

            db.users.push({
              id: ParkingStore.nextId(db, "user"),
              username,
              password,
              role,
              permissions,
              active,
              createdAt: new Date().toISOString()
            });
          });

          ParkingUI.renderSuccess(message, "Usuario guardado.");
          resetForm();
          renderRows();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      main.addEventListener("click", (event) => {
        const editButton = event.target.closest(".edit-user");
        const deleteButton = event.target.closest(".delete-user");
        const message = document.getElementById("userMessage");

        if (editButton) {
          const db = ParkingStore.getData();
          const item = db.users.find((candidate) => candidate.id === editButton.dataset.id);
          if (!item) return;
          document.getElementById("formTitle").textContent = "Editar usuario";
          document.getElementById("userId").value = item.id;
          document.getElementById("username").value = item.username;
          document.getElementById("password").value = "";
          document.getElementById("password").required = false;
          document.getElementById("role").value = item.role;
          document.getElementById("active").value = String(Boolean(item.active));
          renderPermissions(item.permissions || []);
          return;
        }

        if (!deleteButton) return;
        if (!confirm("Eliminar este usuario?")) return;

        try {
          ParkingStore.transact((db) => {
            const index = db.users.findIndex((item) => item.id === deleteButton.dataset.id);
            if (index === -1) throw new Error("El usuario ya no existe.");
            if (db.users[index].id === user.id) throw new Error("No puedes eliminar la sesion actual.");
            db.users.splice(index, 1);
          });
          ParkingUI.renderSuccess(message, "Usuario eliminado.");
          renderRows();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      resetForm();
      renderRows();
    }
  );
})();
