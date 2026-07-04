(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Registrar salida", active: "salida.html", permission: "registrar_salida" },
    ({ main, user }) => {
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header"><h2>Buscar vehiculo activo</h2></div>
            <div class="panel-body">
              <form id="exitSearchForm" class="form-grid">
                <div class="field">
                  <label for="query">Placa o ID</label>
                  <input id="query" name="query" required>
                </div>
                <div id="exitMessage"></div>
                <button class="btn primary" type="submit">Calcular salida</button>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Resumen de salida</h2></div>
            <div class="panel-body" id="exitSummary">
              <div class="empty-state">Selecciona un vehiculo para calcular el cobro.</div>
            </div>
          </section>
        </div>

        <section class="panel" style="margin-top:18px">
          <div class="panel-header"><h2>Vehiculos dentro del parqueo</h2></div>
          <div class="panel-body">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Placa</th>
                    <th>Tipo</th>
                    <th>Color</th>
                    <th>Entrada</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody id="activeExitRows"></tbody>
              </table>
            </div>
          </div>
        </section>
      `;

      const query = document.getElementById("query");
      const initialId = ParkingUI.getQueryParam("id");
      if (initialId) query.value = initialId;

      function findActive(queryText) {
        const db = ParkingStore.getData();
        const normalized = ParkingStore.normalizePlate(queryText);
        return (
          db.records.find((record) => record.status === "activo" && record.id === String(queryText || "").trim()) ||
          db.records.find((record) => record.status === "activo" && record.plate === normalized) ||
          null
        );
      }

      function renderActiveTable() {
        const rows = ParkingUI.activeRecords(ParkingStore.getData());
        document.getElementById("activeExitRows").innerHTML = rows.length
          ? rows
              .map(
                (record) => `
                  <tr>
                    <td>${ParkingStore.escapeHtml(record.id)}</td>
                    <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                    <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                    <td>${ParkingStore.escapeHtml(record.color)}</td>
                    <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
                    <td><button class="btn small primary choose-exit" data-id="${ParkingStore.escapeHtml(record.id)}" type="button">Seleccionar</button></td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="6"><div class="empty-state">No hay vehiculos activos.</div></td></tr>';
      }

      function renderSummary(recordId) {
        const db = ParkingStore.getData();
        const record = db.records.find((item) => item.id === recordId && item.status === "activo");
        const summary = document.getElementById("exitSummary");
        if (!record) {
          ParkingUI.renderError(summary, "No se encontro un registro activo para esa salida.");
          return;
        }

        try {
          const exitAt = new Date().toISOString();
          const estimate = ParkingLogic.estimateCharge(db, record, exitAt);
          summary.innerHTML = `
            <div class="summary-list">
              <div class="summary-row"><span>Placa</span><strong>${ParkingStore.escapeHtml(record.plate)}</strong></div>
              <div class="summary-row"><span>Hora de entrada</span><strong>${ParkingStore.formatDateTime(record.entryAt)}</strong></div>
              <div class="summary-row"><span>Hora de salida</span><strong>${ParkingStore.formatDateTime(exitAt)}</strong></div>
              <div class="summary-row"><span>Tipo de vehiculo</span><strong>${ParkingStore.escapeHtml(record.categoryName)}</strong></div>
              <div class="summary-row"><span>Turnos cobrados</span><strong>${estimate.turnCount}</strong></div>
              <div class="summary-row"><span>Prepagos usados</span><strong>${estimate.prepaidUsed}</strong></div>
              <div class="summary-row"><span>Prepagos restantes</span><strong>${Math.max(0, estimate.prepaidAvailable - estimate.prepaidUsed)}</strong></div>
              <div class="summary-row"><span>Turnos anteriores pendientes</span><strong>${estimate.previousTurns}</strong></div>
              <div class="summary-row"><span>Monto anterior pendiente</span><strong>${ParkingStore.formatCurrency(estimate.previousAmount)}</strong></div>
              <div class="summary-row"><span>Tarifa por turno</span><strong>${ParkingStore.formatCurrency(estimate.rate)}</strong></div>
              <div class="summary-row"><span>Total salida actual</span><strong>${ParkingStore.formatCurrency(estimate.total)}</strong></div>
              <div class="summary-row"><span>Total a pagar ahora</span><strong>${ParkingStore.formatCurrency(estimate.grandTotal)}</strong></div>
              ${
                estimate.toleranceApplied
                  ? '<div class="notice warning">Se aplico la tolerancia de 15 minutos en el cambio de turno.</div>'
                  : ""
              }
              ${
                estimate.previousAmount > 0
                  ? '<div class="notice warning">Esta placa tiene turnos anteriores pendientes. Al confirmar cobro se marcaran como pagados.</div>'
                  : ""
              }
              <div class="actions">
                <button class="btn primary" id="confirmExit" data-id="${ParkingStore.escapeHtml(record.id)}" data-mode="paid" type="button">Confirmar salida y cobrar</button>
                <button class="btn warning" id="unpaidExit" data-id="${ParkingStore.escapeHtml(record.id)}" data-mode="unpaid" type="button">Salida sin pagar</button>
              </div>
            </div>
          `;
        } catch (error) {
          ParkingUI.renderError(summary, error);
        }
      }

      document.getElementById("exitSearchForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const message = document.getElementById("exitMessage");
        const record = findActive(new FormData(event.currentTarget).get("query"));
        if (!record) {
          ParkingUI.renderError(message, "No existe un vehiculo activo con esa placa o ID.");
          return;
        }
        message.innerHTML = "";
        renderSummary(record.id);
      });

      main.addEventListener("click", (event) => {
        const chooseButton = event.target.closest(".choose-exit");
        if (chooseButton) {
          query.value = chooseButton.dataset.id;
          renderSummary(chooseButton.dataset.id);
          return;
        }

        const confirmButton = event.target.closest("#confirmExit, #unpaidExit");
        if (!confirmButton) return;

        try {
          const result = ParkingStore.transact((db) =>
            ParkingLogic.finalizeExit(db, confirmButton.dataset.id, null, {
              paymentMode: confirmButton.dataset.mode,
              user
            })
          );
          const paid = confirmButton.dataset.mode !== "unpaid";
          document.getElementById("exitSummary").innerHTML = `
            <div class="notice ${paid ? "success" : "warning"}">${
              paid
                ? "Salida registrada y cobrada correctamente."
                : "Salida registrada sin pago. Quedo como turno anterior pendiente."
            }</div>
            <div class="summary-list" style="margin-top:14px">
              <div class="summary-row"><span>Placa</span><strong>${ParkingStore.escapeHtml(result.record.plate)}</strong></div>
              <div class="summary-row"><span>Hora de entrada</span><strong>${ParkingStore.formatDateTime(result.record.entryAt)}</strong></div>
              <div class="summary-row"><span>Hora de salida</span><strong>${ParkingStore.formatDateTime(result.record.exitAt)}</strong></div>
              <div class="summary-row"><span>Tipo de vehiculo</span><strong>${ParkingStore.escapeHtml(result.record.categoryName)}</strong></div>
              <div class="summary-row"><span>Turnos cobrados</span><strong>${result.record.shiftsCharged}</strong></div>
              <div class="summary-row"><span>Prepagos usados</span><strong>${result.record.prepaidUsed}</strong></div>
              <div class="summary-row"><span>Turnos anteriores pagados</span><strong>${result.record.previousTurnsPaid || 0}</strong></div>
              <div class="summary-row"><span>Monto anterior pagado</span><strong>${ParkingStore.formatCurrency(result.record.previousDebtPaid || 0)}</strong></div>
              <div class="summary-row"><span>Monto pendiente generado</span><strong>${ParkingStore.formatCurrency(result.record.unpaidAmount || 0)}</strong></div>
              <div class="summary-row"><span>Total a pagar</span><strong>${ParkingStore.formatCurrency(result.record.totalCharged)}</strong></div>
              <div class="summary-row"><span>Registrado por</span><strong>${ParkingStore.escapeHtml(result.record.exitByUsername || "")}</strong></div>
            </div>
          `;
          renderActiveTable();
        } catch (error) {
          ParkingUI.renderError(document.getElementById("exitMessage"), error);
        }
      });

      renderActiveTable();
      if (initialId) {
        const initialRecord = findActive(initialId);
        if (initialRecord) renderSummary(initialRecord.id);
      }
    }
  );
})();
