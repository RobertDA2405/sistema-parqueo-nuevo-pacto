(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Actualizar registros activos", active: "actualizar.html", permission: "actualizar_registros" },
    ({ main }) => {
      main.innerHTML = `
        <div class="page-grid">
          <section class="panel">
            <div class="panel-header"><h2>Actualizacion diaria</h2></div>
            <div class="panel-body">
              <div class="actions">
                <button class="btn primary" id="runUpdate" type="button">Actualizar ahora</button>
                <span class="badge" id="lastUpdateBadge">Sin ejecutar</span>
              </div>
              <div id="updateMessage" style="margin-top:14px"></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Resultado</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Tipo</th>
                      <th>Entrada</th>
                      <th>Turnos acumulados</th>
                      <th>Prepagos estimados</th>
                      <th>Deuda estimada</th>
                    </tr>
                  </thead>
                  <tbody id="updateRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      function renderExisting() {
        const db = ParkingStore.getData();
        document.getElementById("lastUpdateBadge").textContent = db.lastDailyUpdateAt
          ? `Ultima: ${ParkingStore.formatDateTime(db.lastDailyUpdateAt)}`
          : "Sin ejecutar";
        const rows = ParkingUI.activeRecords(db);
        document.getElementById("updateRows").innerHTML = rows.length
          ? rows
              .map(
                (record) => `
                  <tr>
                    <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                    <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                    <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
                    <td>${Number(record.currentShifts || 0)}</td>
                    <td>${Number(record.currentPrepaidUsed || 0)}</td>
                    <td>${ParkingStore.formatCurrency(record.currentDebt || 0)}</td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="6"><div class="empty-state">No hay vehiculos activos.</div></td></tr>';
      }

      document.getElementById("runUpdate").addEventListener("click", () => {
        const message = document.getElementById("updateMessage");
        try {
          const updated = ParkingStore.transact((db) => ParkingLogic.updateActiveRecords(db));
          ParkingUI.renderSuccess(message, `${updated.length} registros activos actualizados.`);
          renderExisting();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      renderExisting();
    }
  );
})();
