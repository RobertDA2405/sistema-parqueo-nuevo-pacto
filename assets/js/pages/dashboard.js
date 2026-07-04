(function () {
  "use strict";

  ParkingUI.protectedPage({ title: "Inicio", active: "dashboard.html" }, ({ main, user }) => {
    const canRegisterExit = ParkingStore.hasPermission(user, "registrar_salida");
    const canSeeActive = ParkingStore.hasAnyPermission(user, [
      "registrar_entrada",
      "registrar_salida",
      "actualizar_registros"
    ]);
    const canManagePrevious = ParkingStore.hasPermission(user, "gestionar_turnos_anteriores");

    function groupPreviousTurns(items) {
      const groups = new Map();
      items.forEach((item) => {
        const current =
          groups.get(item.plate) ||
          {
            amount: 0,
            ids: [],
            lastDate: item.createdAt,
            plate: item.plate,
            turns: 0
          };

        current.amount += Number(item.amount || 0);
        current.turns += Number(item.turns || 0);
        current.ids.push(item.id);
        if (new Date(item.createdAt).getTime() > new Date(current.lastDate).getTime()) {
          current.lastDate = item.createdAt;
        }
        groups.set(item.plate, current);
      });

      return Array.from(groups.values()).sort((a, b) => b.amount - a.amount);
    }

    function renderDashboard() {
      const data = ParkingStore.getData();
      const occ = ParkingUI.occupancy(data);
      const report = ParkingLogic.dailyReport(data, ParkingStore.todayInput());
      const now = new Date().toISOString();
      const activeRecords = ParkingUI.activeRecords(data);
      const previousPending = data.previousTurns.filter((item) => item.status === "pendiente");
      const previousGroups = groupPreviousTurns(previousPending);
      const previousAmount = previousPending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const currentExposure = activeRecords.reduce((sum, record) => {
        try {
          return sum + ParkingLogic.estimateCharge(data, record, now).grandTotal;
        } catch (error) {
          return sum;
        }
      }, 0);

      const activeRows = activeRecords.length
        ? activeRecords
            .map((record) => {
              let estimate = null;
              try {
                estimate = ParkingLogic.estimateCharge(data, record, now);
              } catch (error) {
                estimate = {
                  grandTotal: 0,
                  prepaidUsed: 0,
                  previousAmount: 0,
                  previousTurns: 0,
                  total: 0,
                  turnCount: 0
                };
              }

              return `
                <tr>
                  <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                  <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                  <td>${ParkingStore.escapeHtml(record.color)}</td>
                  <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
                  <td>${Number(estimate.turnCount || 0)}</td>
                  <td>${ParkingStore.formatCurrency(estimate.total || 0)}</td>
                  <td>${Number(estimate.previousTurns || 0)}</td>
                  <td>${ParkingStore.formatCurrency(estimate.grandTotal || 0)}</td>
                  <td>${ParkingStore.escapeHtml(record.createdByUsername || "")}</td>
                  <td>${
                    canRegisterExit
                      ? `<a class="btn small primary" href="salida.html?id=${encodeURIComponent(record.id)}">Salida</a>`
                      : '<span class="badge">Sin permiso</span>'
                  }</td>
                </tr>
              `;
            })
            .join("")
        : '<tr><td colspan="10"><div class="empty-state">No hay vehiculos activos para recibir en este turno.</div></td></tr>';

      const previousRows = previousGroups.length
        ? previousGroups
            .slice(0, 12)
            .map(
              (group) => `
                <tr>
                  <td><strong>${ParkingStore.escapeHtml(group.plate)}</strong></td>
                  <td>${Number(group.turns || 0)}</td>
                  <td>${ParkingStore.formatCurrency(group.amount || 0)}</td>
                  <td>${ParkingStore.formatDateTime(group.lastDate)}</td>
                  <td>
                    ${
                      canManagePrevious
                        ? `<button class="btn small primary collect-previous-group" data-ids="${ParkingStore.escapeHtml(group.ids.join(","))}" type="button">Cobrar</button>`
                        : '<span class="badge">Sin permiso</span>'
                    }
                  </td>
                </tr>
              `
            )
            .join("")
        : '<tr><td colspan="5"><div class="empty-state">No hay turnos anteriores pendientes.</div></td></tr>';

      const recentFinalized = data.records
        .filter((record) => record.status === "finalizado")
        .sort((a, b) => new Date(b.exitAt).getTime() - new Date(a.exitAt).getTime())
        .slice(0, 5);

      const recentRows = recentFinalized.length
        ? recentFinalized
            .map(
              (record) => `
                <tr>
                  <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                  <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                  <td>${ParkingStore.formatDateTime(record.exitAt)}</td>
                  <td>${ParkingUI.paymentBadge(record.paymentStatus || "pagado")}</td>
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
          <div id="dashboardMessage"></div>
          <section class="stat-grid">
            <article class="stat-card">
              <div class="stat-label">Vehiculos en parqueo</div>
              <div class="stat-value">${occ.active}</div>
              <div class="stat-note">${occ.available} espacios disponibles</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Ocupacion</div>
              <div class="stat-value">${occ.percent}%</div>
              <div class="progress-track"><div class="progress-bar ${occ.alert ? "danger" : "warn"}" style="width:${Math.min(100, occ.percent)}%"></div></div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Cobro estimado activo</div>
              <div class="stat-value">${ParkingStore.formatCurrency(currentExposure)}</div>
              <div class="stat-note">Incluye turnos anteriores por placa</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Recaudado hoy</div>
              <div class="stat-value">${ParkingStore.formatCurrency(report.totalCollected)}</div>
              <div class="stat-note">${report.exitedCount} salidas · ${report.turnsCharged} turnos</div>
            </article>
            <article class="stat-card">
              <div class="stat-label">Turnos anteriores</div>
              <div class="stat-value">${previousPending.length}</div>
              <div class="stat-note">${ParkingStore.formatCurrency(previousAmount)} pendientes</div>
            </article>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>Vehiculos que recibe el turno</h2>
              <div class="actions">
                ${canSeeActive ? '<a class="btn small ghost" href="activos.html">Ver activos</a>' : ""}
                ${ParkingStore.hasPermission(user, "registrar_entrada") ? '<a class="btn small primary" href="entradas.html">Entrada</a>' : ""}
              </div>
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
                      <th>Turnos ahora</th>
                      <th>Actual</th>
                      <th>Anteriores</th>
                      <th>Total estimado</th>
                      <th>Entrada por</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>${activeRows}</tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="columns">
            <article class="panel">
              <div class="panel-header">
                <h2>Turnos anteriores pendientes</h2>
                <a class="btn small ghost" href="turnos-anteriores.html">Ver detalle</a>
              </div>
              <div class="panel-body">
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Placa</th>
                        <th>Turnos</th>
                        <th>Monto</th>
                        <th>Ultimo registro</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>${previousRows}</tbody>
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
                        <th>Pago</th>
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
    }

    main.addEventListener("click", (event) => {
      const button = event.target.closest(".collect-previous-group");
      if (!button) return;

      try {
        const ids = String(button.dataset.ids || "")
          .split(",")
          .filter(Boolean);
        const result = ParkingStore.transact((db) => ParkingLogic.collectPreviousTurns(db, ids, user));
        renderDashboard();
        ParkingUI.renderSuccess(
          document.getElementById("dashboardMessage"),
          `Cobro registrado: ${result.paid.turns} turnos anteriores por ${ParkingStore.formatCurrency(result.paid.amount)}.`
        );
      } catch (error) {
        ParkingUI.renderError(document.getElementById("dashboardMessage"), error);
      }
    });

    renderDashboard();
  });
})();
