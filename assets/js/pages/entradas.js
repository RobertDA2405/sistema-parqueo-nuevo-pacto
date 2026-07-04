(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Registrar entrada", active: "entradas.html", permission: "registrar_entrada" },
    ({ main, data, user }) => {
      const occ = ParkingUI.occupancy(data);
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header">
              <h2>Nueva entrada</h2>
              <span class="badge ${occ.alert ? "danger" : "active"}">${occ.active}/${occ.capacity}</span>
            </div>
            <div class="panel-body">
              <form id="entryForm" class="form-grid">
                <div class="field">
                  <label for="plate">Placa</label>
                  <input id="plate" name="plate" maxlength="24" required>
                </div>
                <div class="field">
                  <label for="color">Color</label>
                  <input id="color" name="color" maxlength="40" required>
                </div>
                <div class="field">
                  <label for="categoryId">Tipo de vehiculo</label>
                  <select id="categoryId" name="categoryId" required>
                    ${ParkingUI.categoryOptions(data)}
                  </select>
                </div>
                <div id="entryMessage"></div>
                <button class="btn primary" type="submit">Registrar entrada</button>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Resumen</h2></div>
            <div class="panel-body" id="entrySummary">
              <div class="empty-state">El resumen aparecera al guardar la entrada.</div>
            </div>
          </section>
        </div>
      `;

      document.getElementById("entryForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = document.getElementById("entryMessage");
        const summary = document.getElementById("entrySummary");

        try {
          const record = ParkingStore.transact((db) => {
            const plate = ParkingStore.normalizePlate(form.get("plate"));
            const color = String(form.get("color") || "").trim();
            const categoryId = String(form.get("categoryId") || "");
            const category = ParkingStore.getCategory(db, categoryId);
            const snapshot = ParkingStore.userSnapshot(user);

            if (!plate) throw new Error("La placa no puede estar vacia.");
            if (!color) throw new Error("El color no puede estar vacio.");
            if (!category) throw new Error("El tipo de vehiculo seleccionado no existe.");
            if (ParkingStore.getActiveRecordByPlate(db, plate)) {
              throw new Error("Esta placa ya tiene un registro activo.");
            }

            const entry = {
              id: ParkingStore.nextId(db, "record"),
              plate,
              color,
              categoryId: category.id,
              categoryName: category.name,
              rateAtEntry: Number(category.rate),
              entryAt: new Date().toISOString(),
              exitAt: null,
              status: "activo",
              paymentStatus: "pendiente",
              shiftsCharged: 0,
              prepaidUsed: 0,
              totalCharged: 0,
              createdByUserId: snapshot.userId,
              createdByUsername: snapshot.username,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            db.records.push(entry);
            ParkingStore.logAction(db, user, "entrada_registrada", `${entry.plate} · ${entry.categoryName}`);
            return entry;
          });

          ParkingUI.renderSuccess(message, "Entrada registrada correctamente.");
          summary.innerHTML = `
            <div class="summary-list">
              <div class="summary-row"><span>ID</span><strong>${ParkingStore.escapeHtml(record.id)}</strong></div>
              <div class="summary-row"><span>Placa</span><strong>${ParkingStore.escapeHtml(record.plate)}</strong></div>
              <div class="summary-row"><span>Tipo</span><strong>${ParkingStore.escapeHtml(record.categoryName)}</strong></div>
              <div class="summary-row"><span>Color</span><strong>${ParkingStore.escapeHtml(record.color)}</strong></div>
              <div class="summary-row"><span>Hora de entrada</span><strong>${ParkingStore.formatDateTime(record.entryAt)}</strong></div>
              <div class="summary-row"><span>Registrado por</span><strong>${ParkingStore.escapeHtml(record.createdByUsername)}</strong></div>
              <div class="summary-row"><span>Estado</span><strong>Activo</strong></div>
            </div>
          `;
          event.currentTarget.reset();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });
    }
  );
})();
