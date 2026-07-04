(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Reportes", active: "reportes.html", permission: "generar_reportes" },
    ({ main, user }) => {
      const canExport = ParkingStore.hasPermission(user, "exportar_csv");
      main.innerHTML = `
        <div class="page-grid">
          <section class="panel">
            <div class="panel-header"><h2>Reporte diario</h2></div>
            <div class="panel-body">
              <div class="actions">
                <div class="field" style="min-width:220px">
                  <label for="reportDate">Fecha</label>
                  <input id="reportDate" type="date" value="${ParkingStore.todayInput()}">
                </div>
                <button class="btn primary" id="generateReport" type="button">Generar</button>
                ${
                  canExport
                    ? '<button class="btn ghost" id="exportDaily" type="button">Exportar reporte CSV</button><button class="btn ghost" id="exportAll" type="button">Exportar registros CSV</button>'
                    : ""
                }
              </div>
            </div>
          </section>

          <section class="stat-grid" id="reportStats"></section>

          <section class="columns">
            <article class="panel">
              <div class="panel-header"><h2>Recaudacion por tipo</h2></div>
              <div class="panel-body" id="byTypePanel"></div>
            </article>
            <article class="panel">
              <div class="panel-header"><h2>Registros salidos</h2></div>
              <div class="panel-body">
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Placa</th>
                        <th>Tipo</th>
                        <th>Salida</th>
                        <th>Turnos</th>
                        <th>Prepagos</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody id="reportRows"></tbody>
                  </table>
                </div>
              </div>
            </article>
          </section>
        </div>
      `;

      let currentReport = null;

      function renderReport() {
        const db = ParkingStore.getData();
        currentReport = ParkingLogic.dailyReport(db, document.getElementById("reportDate").value);

        document.getElementById("reportStats").innerHTML = `
          <article class="stat-card">
            <div class="stat-label">Vehiculos ingresados</div>
            <div class="stat-value">${currentReport.enteredCount}</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Vehiculos salidos</div>
            <div class="stat-value">${currentReport.exitedCount}</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Total recaudado</div>
            <div class="stat-value">${ParkingStore.formatCurrency(currentReport.totalCollected)}</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Turnos y prepagos</div>
            <div class="stat-value">${currentReport.turnsCharged}</div>
            <div class="stat-note">${currentReport.prepaidUsed} prepagos usados · ${currentReport.previousTurnsCollected} anteriores cobrados</div>
          </article>
        `;

        const byTypeEntries = Object.entries(currentReport.byType);
        document.getElementById("byTypePanel").innerHTML = byTypeEntries.length
          ? `<div class="summary-list">${byTypeEntries
              .map(
                ([type, total]) => `
                  <div class="summary-row">
                    <span>${ParkingStore.escapeHtml(type)}</span>
                    <strong>${ParkingStore.formatCurrency(total)}</strong>
                  </div>
                `
              )
              .join("")}</div>`
          : '<div class="empty-state">No hay recaudacion para esta fecha.</div>';

        document.getElementById("reportRows").innerHTML = currentReport.records.length
          ? currentReport.records
              .map(
                (record) => `
                  <tr>
                    <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                    <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                    <td>${ParkingStore.formatDateTime(record.exitAt)}</td>
                    <td>${Number(record.shiftsCharged || 0)}</td>
                    <td>${Number(record.prepaidUsed || 0)}</td>
                    <td>${ParkingStore.formatCurrency(record.totalCharged || 0)}</td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="6"><div class="empty-state">No hay salidas para esta fecha.</div></td></tr>';
      }

      document.getElementById("generateReport").addEventListener("click", renderReport);
      document.getElementById("reportDate").addEventListener("change", renderReport);

      if (canExport) {
        document.getElementById("exportDaily").addEventListener("click", () => {
          if (!currentReport) renderReport();
          const rows = [
            ["Fecha", currentReport.date],
            ["Vehiculos ingresados", currentReport.enteredCount],
            ["Vehiculos salidos", currentReport.exitedCount],
            ["Total recaudado", currentReport.totalCollected],
            ["Turnos cobrados", currentReport.turnsCharged],
            ["Prepagos usados", currentReport.prepaidUsed],
            ["Turnos anteriores cobrados", currentReport.previousTurnsCollected],
            [],
            ["Recaudacion por tipo"],
            ["Tipo", "Total"]
          ];
          Object.entries(currentReport.byType).forEach(([type, total]) => rows.push([type, total]));
          ParkingStore.downloadCsv(`reporte-diario-${currentReport.date}.csv`, ParkingStore.toCsv(rows));
        });

        document.getElementById("exportAll").addEventListener("click", () => {
          const db = ParkingStore.getData();
          ParkingStore.downloadCsv("registros-parqueo.csv", ParkingStore.recordsToCsv(db.records));
        });
      }

      renderReport();
    }
  );
})();
