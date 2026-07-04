(function () {
  "use strict";

  ParkingUI.protectedPage({ title: "Inicio", active: "dashboard.html" }, ({ main, data, user }) => {
    const occ = ParkingUI.occupancy(data);
    const report = ParkingLogic.dailyReport(data, ParkingStore.todayInput());
    const previousPending = data.previousTurns.filter((item) => item.status === "pendiente");
    const previousAmount = previousPending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const activeRecords = ParkingUI.activeRecords(data).slice(0, 8);
    const canRegisterExit = ParkingStore.hasPermission(user, "registrar_salida");
    const canSeeActive = ParkingStore.hasAnyPermission(user, [
      "registrar_entrada",
      "registrar_salida",
      "actualizar_registros"
    ]);
    const recentFinalized = data.records
      .filter((record) => record.status === "finalizado")
      .sort((a, b) => new Date(b.exitAt).getTime() - new Date(a.exitAt).getTime())
      .slice(0, 6);

    const activeRows = activeRecords.length
      ? activeRecords
          .map(
            (record) => `
              <tr>
                <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                <td>${ParkingStore.escapeHtml(record.color)}</td>
                <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
                <td>${
                  canRegisterExit
                    ? `<a class="btn small primary" href="salida.html?id=${encodeURIComponent(record.id)}">Salida</a>`
                    : '<span class="badge">Sin permiso</span>'
                }</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td colspan="5"><div class="empty-state">No hay vehiculos activos.</div></td></tr>';

    const recentRows = recentFinalized.length
      ? recentFinalized
          .map(
            (record) => `
              <tr>
                <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                <td>${ParkingStore.formatDateTime(record.exitAt)}</td>
                <td>${Number(record.shiftsCharged || 0)}</td>
                <td>${ParkingStore.formatCurrency(record.totalCharged || 0)}</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td colspan="5"><div class="empty-state">Todavia no hay salidas registradas.</div></td></tr>';

    main.innerHTML = `
      <div class="page-grid">
        ${
          occ.alert
            ? `<div class="notice warning">La ocupacion esta en ${occ.percent}% y alcanzo el umbral configurado de ${occ.threshold}%.</div>`
            : ""
        }
        <section class="stat-grid">
          <article class="stat-card">
            <div class="stat-label">Vehiculos activos</div>
            <div class="stat-value">${occ.active}</div>
            <div class="stat-note">${occ.available} espacios disponibles</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Ocupacion</div>
            <div class="stat-value">${occ.percent}%</div>
            <div class="progress-track"><div class="progress-bar ${occ.alert ? "danger" : "warn"}" style="width:${Math.min(100, occ.percent)}%"></div></div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Ingresos de hoy</div>
            <div class="stat-value">${report.enteredCount}</div>
            <div class="stat-note">${report.exitedCount} salidas registradas</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Recaudado hoy</div>
            <div class="stat-value">${ParkingStore.formatCurrency(report.totalCollected)}</div>
            <div class="stat-note">${report.turnsCharged} turnos cobrados</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Turnos anteriores</div>
            <div class="stat-value">${previousPending.length}</div>
            <div class="stat-note">${ParkingStore.formatCurrency(previousAmount)} pendientes</div>
          </article>
        </section>

        <section class="columns">
          <article class="panel">
            <div class="panel-header">
              <h2>Activos recientes</h2>
              ${canSeeActive ? '<a class="btn small ghost" href="activos.html">Ver todos</a>' : ""}
            </div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Tipo</th>
                      <th>Color</th>
                      <th>Entrada</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>${activeRows}</tbody>
                </table>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h2>Ultimas salidas</h2>
              <a class="btn small ghost" href="historial.html">Historial</a>
            </div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Tipo</th>
                      <th>Salida</th>
                      <th>Turnos</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>${recentRows}</tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </div>
    `;
  });
})();
