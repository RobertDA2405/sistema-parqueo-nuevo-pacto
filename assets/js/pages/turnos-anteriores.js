(function () {
  "use strict";

  ParkingUI.protectedPage(
    {
      title: "Turnos anteriores",
      active: "turnos-anteriores.html",
      permission: "gestionar_turnos_anteriores"
    },
    ({ main, user }) => {
      main.innerHTML = `
        <div class="page-grid">
          <section class="panel">
            <div class="panel-header"><h2>Busqueda</h2></div>
            <div class="panel-body">
              <div class="filters">
                <div class="field">
                  <label for="plateFilter">Placa</label>
                  <input id="plateFilter">
                </div>
                <div class="field">
                  <label for="statusFilter">Estado</label>
                  <select id="statusFilter">
                    <option value="pendiente">Pendientes</option>
                    <option value="pagado">Pagados</option>
                    <option value="">Todos</option>
                  </select>
                </div>
                <div class="field">
                  <label for="orderFilter">Orden</label>
                  <select id="orderFilter">
                    <option value="old">Mas antiguos</option>
                    <option value="new">Mas recientes</option>
                  </select>
                </div>
              </div>
              <div id="previousMessage" style="margin-top:14px"></div>
            </div>
          </section>

          <section class="stat-grid" id="previousStats"></section>

          <section class="panel">
            <div class="panel-header"><h2>Registros de turnos anteriores</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Placa</th>
                      <th>Tipo</th>
                      <th>Turnos</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Registrado por</th>
                      <th>Fecha</th>
                      <th>Cobrado por</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="previousRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      function getFiltered() {
        const db = ParkingStore.getData();
        const plate = ParkingStore.normalizePlate(document.getElementById("plateFilter").value);
        const status = document.getElementById("statusFilter").value;
        const order = document.getElementById("orderFilter").value;

        return db.previousTurns
          .filter((item) => (!plate || item.plate.includes(plate)) && (!status || item.status === status))
          .sort((a, b) => {
            const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return order === "old" ? -diff : diff;
          });
      }

      function render() {
        const rows = getFiltered();
        const pending = rows.filter((item) => item.status === "pendiente");
        const paid = rows.filter((item) => item.status === "pagado");
        const pendingAmount = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingTurns = pending.reduce((sum, item) => sum + Number(item.turns || 0), 0);

        document.getElementById("previousStats").innerHTML = `
          <article class="stat-card">
            <div class="stat-label">Pendientes filtrados</div>
            <div class="stat-value">${pending.length}</div>
            <div class="stat-note">${pendingTurns} turnos</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Monto pendiente</div>
            <div class="stat-value">${ParkingStore.formatCurrency(pendingAmount)}</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Pagados filtrados</div>
            <div class="stat-value">${paid.length}</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Placas pendientes</div>
            <div class="stat-value">${new Set(pending.map((item) => item.plate)).size}</div>
          </article>
        `;

        document.getElementById("previousRows").innerHTML = rows.length
          ? rows
              .map(
                (item) => `
                  <tr>
                    <td>${ParkingStore.escapeHtml(item.id)}</td>
                    <td><strong>${ParkingStore.escapeHtml(item.plate)}</strong></td>
                    <td>${ParkingStore.escapeHtml(item.categoryName)}</td>
                    <td>${Number(item.turns || 0)}</td>
                    <td>${ParkingStore.formatCurrency(item.amount || 0)}</td>
                    <td>${ParkingUI.paymentBadge(item.status)}</td>
                    <td>${ParkingStore.escapeHtml(item.sourceRecordId || "")}</td>
                    <td>${ParkingStore.escapeHtml(item.createdByUsername || "")}</td>
                    <td>${ParkingStore.formatDateTime(item.createdAt)}</td>
                    <td>${ParkingStore.escapeHtml(item.paidByUsername || "")}</td>
                    <td>
                      ${
                        item.status === "pendiente"
                          ? `<button class="btn small primary collect-one" data-id="${ParkingStore.escapeHtml(item.id)}" type="button">Cobrar</button>`
                          : '<span class="badge active">Cobrado</span>'
                      }
                    </td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="11"><div class="empty-state">No hay turnos anteriores con esos filtros.</div></td></tr>';
      }

      main.addEventListener("click", (event) => {
        const button = event.target.closest(".collect-one");
        if (!button) return;

        try {
          const result = ParkingStore.transact((db) => ParkingLogic.collectPreviousTurns(db, [button.dataset.id], user));
          ParkingUI.renderSuccess(
            document.getElementById("previousMessage"),
            `Cobro registrado: ${result.paid.turns} turnos por ${ParkingStore.formatCurrency(result.paid.amount)}.`
          );
          render();
        } catch (error) {
          ParkingUI.renderError(document.getElementById("previousMessage"), error);
        }
      });

      ["plateFilter", "statusFilter", "orderFilter"].forEach((id) => {
        document.getElementById(id).addEventListener("input", render);
        document.getElementById(id).addEventListener("change", render);
      });

      render();
    }
  );
})();
