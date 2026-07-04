(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Prepagos", active: "prepagos.html", permission: "gestionar_prepagos" },
    ({ main }) => {
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header"><h2>Agregar turnos</h2></div>
            <div class="panel-body">
              <form id="prepaidForm" class="form-grid">
                <div class="field">
                  <label for="plate">Placa</label>
                  <input id="plate" name="plate" required>
                </div>
                <div class="field">
                  <label for="turns">Cantidad de turnos pagados</label>
                  <input id="turns" name="turns" type="number" min="1" step="1" required>
                </div>
                <div id="prepaidMessage"></div>
                <button class="btn primary" type="submit">Guardar prepago</button>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Clientes con turnos</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Turnos pagados</th>
                      <th>Turnos restantes</th>
                      <th>Actualizado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="prepaidRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      function renderRows() {
        const db = ParkingStore.getData();
        document.getElementById("prepaidRows").innerHTML = db.prepaids.length
          ? db.prepaids
              .sort((a, b) => a.plate.localeCompare(b.plate))
              .map(
                (item) => `
                  <tr>
                    <td><strong>${ParkingStore.escapeHtml(item.plate)}</strong></td>
                    <td>${Number(item.turnsPaid || 0)}</td>
                    <td>
                      <input class="remaining-input" data-id="${ParkingStore.escapeHtml(item.id)}" type="number" min="0" step="1" value="${Number(item.turnsRemaining || 0)}" aria-label="Turnos restantes">
                    </td>
                    <td>${ParkingStore.formatDateTime(item.updatedAt || item.createdAt)}</td>
                    <td>
                      <div class="actions">
                        <button class="btn small ghost save-prepaid" data-id="${ParkingStore.escapeHtml(item.id)}" type="button">Guardar</button>
                        <button class="btn small danger delete-prepaid" data-id="${ParkingStore.escapeHtml(item.id)}" type="button">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                `
              )
              .join("")
          : '<tr><td colspan="5"><div class="empty-state">No hay prepagos registrados.</div></td></tr>';
      }

      document.getElementById("prepaidForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = document.getElementById("prepaidMessage");

        try {
          ParkingStore.transact((db) => {
            const plate = ParkingStore.normalizePlate(form.get("plate"));
            const turns = ParkingStore.numberValue(form.get("turns"), "Cantidad de turnos", {
              min: 1,
              integer: true
            });
            if (!plate) throw new Error("La placa no puede estar vacia.");

            const existing = db.prepaids.find((item) => item.plate === plate);
            if (existing) {
              existing.turnsPaid = Number(existing.turnsPaid || 0) + turns;
              existing.turnsRemaining = Number(existing.turnsRemaining || 0) + turns;
              existing.updatedAt = new Date().toISOString();
              return;
            }

            db.prepaids.push({
              id: ParkingStore.nextId(db, "prepaid"),
              plate,
              turnsPaid: turns,
              turnsRemaining: turns,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          });

          ParkingUI.renderSuccess(message, "Prepago guardado.");
          event.currentTarget.reset();
          renderRows();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      main.addEventListener("click", (event) => {
        const saveButton = event.target.closest(".save-prepaid");
        const deleteButton = event.target.closest(".delete-prepaid");
        const message = document.getElementById("prepaidMessage");

        if (saveButton) {
          try {
            const input = main.querySelector(`.remaining-input[data-id="${CSS.escape(saveButton.dataset.id)}"]`);
            ParkingStore.transact((db) => {
              const item = db.prepaids.find((prepaid) => prepaid.id === saveButton.dataset.id);
              if (!item) throw new Error("El prepago ya no existe.");
              item.turnsRemaining = ParkingStore.numberValue(input.value, "Turnos restantes", {
                min: 0,
                integer: true
              });
              item.turnsPaid = Math.max(Number(item.turnsPaid || 0), item.turnsRemaining);
              item.updatedAt = new Date().toISOString();
            });
            ParkingUI.renderSuccess(message, "Prepago actualizado.");
            renderRows();
          } catch (error) {
            ParkingUI.renderError(message, error);
          }
          return;
        }

        if (deleteButton) {
          if (!confirm("Eliminar este prepago?")) return;
          try {
            ParkingStore.transact((db) => {
              const index = db.prepaids.findIndex((item) => item.id === deleteButton.dataset.id);
              if (index === -1) throw new Error("El prepago ya no existe.");
              db.prepaids.splice(index, 1);
            });
            ParkingUI.renderSuccess(message, "Prepago eliminado.");
            renderRows();
          } catch (error) {
            ParkingUI.renderError(message, error);
          }
        }
      });

      renderRows();
    }
  );
})();
