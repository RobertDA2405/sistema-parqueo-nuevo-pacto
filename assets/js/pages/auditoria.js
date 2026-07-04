(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Auditoria", active: "auditoria.html", permission: "ver_auditoria" },
    ({ main }) => {
      main.innerHTML = `
        <div class="page-grid">
          <section class="panel">
            <div class="panel-header"><h2>Filtros</h2></div>
            <div class="panel-body">
              <div class="filters">
                <div class="field">
                  <label for="userFilter">Usuario</label>
                  <input id="userFilter">
                </div>
                <div class="field">
                  <label for="actionFilter">Accion</label>
                  <select id="actionFilter">
                    <option value="">Todas</option>
                    <option value="entrada_registrada">Entrada registrada</option>
                    <option value="salida_cobrada">Salida cobrada</option>
                    <option value="salida_sin_pagar">Salida sin pagar</option>
                    <option value="turnos_anteriores_cobrados">Turnos anteriores cobrados</option>
                  </select>
                </div>
                <div class="field">
                  <label for="textFilter">Detalle</label>
                  <input id="textFilter">
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Actividad registrada</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Accion</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody id="auditRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      function labelAction(action) {
        const labels = {
          entrada_registrada: "Entrada registrada",
          salida_cobrada: "Salida cobrada",
          salida_sin_pagar: "Salida sin pagar",
          turnos_anteriores_cobrados: "Turnos anteriores cobrados"
        };
        return labels[action] || action;
      }

      function render() {
        const db = ParkingStore.getData();
        const userText = String(document.getElementById("userFilter").value || "").trim().toLowerCase();
        const action = document.getElementById("actionFilter").value;
        const text = String(document.getElementById("textFilter").value || "").trim().toLowerCase();
        const rows = db.auditLog.filter((item) => {
          return (
            (!userText || String(item.username || "").toLowerCase().includes(userText)) &&
            (!action || item.action === action) &&
            (!text || String(item.detail || "").toLowerCase().includes(text))
          );
        });

        document.getElementById("auditRows").innerHTML = rows.length
          ? rows
              .map(
                (item) => `
                  <tr>
                    <td>${ParkingStore.formatDateTime(item.createdAt)}</td>
                    <td><strong>${ParkingStore.escapeHtml(item.username)}</strong></td>
                    <td>${ParkingStore.escapeHtml(item.role)}</td>
                    <td>${ParkingStore.escapeHtml(labelAction(item.action))}</td>
                    <td>${ParkingStore.escapeHtml(item.detail)}</td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="5"><div class="empty-state">No hay actividad con esos filtros.</div></td></tr>';
      }

      ["userFilter", "actionFilter", "textFilter"].forEach((id) => {
        document.getElementById(id).addEventListener("input", render);
        document.getElementById(id).addEventListener("change", render);
      });

      render();
    }
  );
})();
