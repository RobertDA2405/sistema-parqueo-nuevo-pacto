(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Tarifas", active: "tarifas.html", permission: "gestionar_tarifas" },
    ({ main }) => {
      main.innerHTML = `
        <section class="panel">
          <div class="panel-header"><h2>Tarifas por tipo de vehiculo</h2></div>
          <div class="panel-body">
            <form id="ratesForm" class="form-grid">
              <div id="ratesMessage"></div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Tarifa actual</th>
                      <th>Nueva tarifa</th>
                    </tr>
                  </thead>
                  <tbody id="rateRows"></tbody>
                </table>
              </div>
              <button class="btn primary" type="submit">Guardar tarifas</button>
            </form>
          </div>
        </section>
      `;

      function renderRows() {
        const db = ParkingStore.getData();
        document.getElementById("rateRows").innerHTML = db.categories
          .map(
            (category) => `
              <tr>
                <td><strong>${ParkingStore.escapeHtml(category.name)}</strong></td>
                <td>${ParkingStore.formatCurrency(category.rate)}</td>
                <td>
                  <input name="rate:${ParkingStore.escapeHtml(category.id)}" type="number" min="0" step="0.01" value="${Number(category.rate)}" aria-label="Tarifa de ${ParkingStore.escapeHtml(category.name)}">
                </td>
              </tr>
            `
          )
          .join("");
      }

      document.getElementById("ratesForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = document.getElementById("ratesMessage");

        try {
          ParkingStore.transact((db) => {
            db.categories.forEach((category) => {
              const value = form.get(`rate:${category.id}`);
              category.rate = ParkingStore.numberValue(value, `Tarifa de ${category.name}`, { min: 0 });
              category.updatedAt = new Date().toISOString();
            });
          });
          ParkingUI.renderSuccess(message, "Tarifas actualizadas.");
          renderRows();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      renderRows();
    }
  );
})();
