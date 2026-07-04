(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Capacidad y ocupacion", active: "capacidad.html", permission: "configurar_capacidad" },
    ({ main }) => {
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header"><h2>Configuracion</h2></div>
            <div class="panel-body">
              <form id="capacityForm" class="form-grid">
                <div class="field">
                  <label for="capacity">Capacidad total</label>
                  <input id="capacity" name="capacity" type="number" min="1" step="1" required>
                </div>
                <div class="field">
                  <label for="threshold">Umbral de ocupacion (%)</label>
                  <input id="threshold" name="threshold" type="number" min="1" max="100" step="1" required>
                </div>
                <div id="capacityMessage"></div>
                <button class="btn primary" type="submit">Guardar configuracion</button>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Estado actual</h2></div>
            <div class="panel-body" id="capacitySummary"></div>
          </section>
        </div>
      `;

      function render() {
        const db = ParkingStore.getData();
        const occ = ParkingUI.occupancy(db);
        document.getElementById("capacity").value = Number(db.config.capacity || 0);
        document.getElementById("threshold").value = Number(db.config.occupancyThreshold || 0);
        document.getElementById("capacitySummary").innerHTML = `
          <div class="summary-list">
            <div class="summary-row"><span>Capacidad total</span><strong>${occ.capacity}</strong></div>
            <div class="summary-row"><span>Vehiculos activos</span><strong>${occ.active}</strong></div>
            <div class="summary-row"><span>Espacios disponibles</span><strong>${occ.available}</strong></div>
            <div class="summary-row"><span>Ocupacion</span><strong>${occ.percent}%</strong></div>
            <div class="progress-track"><div class="progress-bar ${occ.alert ? "danger" : "warn"}" style="width:${Math.min(100, occ.percent)}%"></div></div>
            ${occ.alert ? '<div class="notice warning">La ocupacion llego o supero el umbral.</div>' : ""}
          </div>
        `;
      }

      document.getElementById("capacityForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = document.getElementById("capacityMessage");

        try {
          ParkingStore.transact((db) => {
            const capacity = ParkingStore.numberValue(form.get("capacity"), "Capacidad total", {
              min: 1,
              integer: true
            });
            const threshold = ParkingStore.numberValue(form.get("threshold"), "Umbral de ocupacion", {
              min: 1,
              integer: true
            });
            if (threshold > 100) throw new Error("El umbral no puede ser mayor que 100%.");
            db.config.capacity = capacity;
            db.config.occupancyThreshold = threshold;
          });
          ParkingUI.renderSuccess(message, "Configuracion guardada.");
          render();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      render();
    }
  );
})();
