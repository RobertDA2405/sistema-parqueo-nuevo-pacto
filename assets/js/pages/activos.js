(function () {
  "use strict";

  ParkingUI.protectedPage(
    {
      title: "Vehiculos activos",
      active: "activos.html",
      any: ["registrar_entrada", "registrar_salida", "actualizar_registros"]
    },
    ({ main }) => {
      main.innerHTML = `
        <div class="page-grid">
          <section class="panel">
            <div class="panel-header">
              <h2>Ocupacion actual</h2>
              <a class="btn small ghost" href="actualizar.html">Actualizar cobros</a>
            </div>
            <div class="panel-body" id="occupancyPanel"></div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Lista de activos</h2></div>
            <div class="panel-body">
              <div class="filters">
                <div class="field">
                  <label for="plateFilter">Placa</label>
                  <input id="plateFilter">
                </div>
                <div class="field">
                  <label for="typeFilter">Tipo</label>
                  <select id="typeFilter"></select>
                </div>
              </div>
              <div class="table-wrap" style="margin-top:14px">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Tipo</th>
                      <th>Color</th>
                      <th>Entrada</th>
                      <th>Turnos estimados</th>
                      <th>Deuda estimada</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody id="activeRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      const typeFilter = document.getElementById("typeFilter");
      const data = ParkingStore.getData();
      typeFilter.innerHTML = `<option value="">Todos</option>${data.categories
        .map((category) => `<option value="${ParkingStore.escapeHtml(category.id)}">${ParkingStore.escapeHtml(category.name)}</option>`)
        .join("")}`;

      function render() {
        const db = ParkingStore.getData();
        const occ = ParkingUI.occupancy(db);
        document.getElementById("occupancyPanel").innerHTML = `
          <div class="summary-list">
            <div class="summary-row"><span>Capacidad total</span><strong>${occ.capacity}</strong></div>
            <div class="summary-row"><span>Vehiculos activos</span><strong>${occ.active}</strong></div>
            <div class="summary-row"><span>Espacios disponibles</span><strong>${occ.available}</strong></div>
            <div class="summary-row"><span>Porcentaje de ocupacion</span><strong>${occ.percent}%</strong></div>
            ${occ.alert ? '<div class="notice warning">La ocupacion alcanzo el umbral configurado.</div>' : ""}
          </div>
        `;

        const plateText = ParkingStore.normalizePlate(document.getElementById("plateFilter").value);
        const categoryId = typeFilter.value;
        const records = ParkingUI.activeRecords(db).filter((record) => {
          return (!plateText || record.plate.includes(plateText)) && (!categoryId || record.categoryId === categoryId);
        });

        document.getElementById("activeRows").innerHTML = records.length
          ? records
              .map((record) => {
                const estimate = ParkingLogic.estimateCharge(db, record, new Date().toISOString());
                return `
                  <tr>
                    <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
                    <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
                    <td>${ParkingStore.escapeHtml(record.color)}</td>
                    <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
                    <td>${estimate.turnCount}</td>
                    <td>${ParkingStore.formatCurrency(estimate.total)}</td>
                    <td><a class="btn small primary" href="salida.html?id=${encodeURIComponent(record.id)}">Registrar salida</a></td>
                  </tr>
                `;
              })
              .join("")
          : '<tr><td colspan="7"><div class="empty-state">No hay vehiculos activos con esos filtros.</div></td></tr>';
      }

      document.getElementById("plateFilter").addEventListener("input", render);
      typeFilter.addEventListener("change", render);
      render();
    }
  );
})();
