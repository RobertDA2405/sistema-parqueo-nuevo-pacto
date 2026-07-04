(function () {
  "use strict";

  ParkingUI.protectedPage(
    { title: "Categorias", active: "categorias.html", permission: "gestionar_categorias" },
    ({ main }) => {
      main.innerHTML = `
        <div class="columns">
          <section class="panel">
            <div class="panel-header"><h2>Nueva categoria</h2></div>
            <div class="panel-body">
              <form id="categoryForm" class="form-grid">
                <div class="field">
                  <label for="name">Nombre</label>
                  <input id="name" name="name" maxlength="90" required>
                </div>
                <div class="field">
                  <label for="rate">Tarifa</label>
                  <input id="rate" name="rate" type="number" min="0" step="0.01" required>
                </div>
                <div id="categoryMessage"></div>
                <button class="btn primary" type="submit">Crear categoria</button>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Listado</h2></div>
            <div class="panel-body">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tarifa</th>
                      <th>Origen</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="categoryRows"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      `;

      function renderRows() {
        const db = ParkingStore.getData();
        document.getElementById("categoryRows").innerHTML = db.categories
          .map(
            (category) => `
              <tr>
                <td><strong>${ParkingStore.escapeHtml(category.name)}</strong></td>
                <td>${ParkingStore.formatCurrency(category.rate)}</td>
                <td>${category.base ? '<span class="badge">Base</span>' : '<span class="badge active">Personalizada</span>'}</td>
                <td>
                  ${
                    category.base
                      ? '<span class="badge">Fija</span>'
                      : `<button class="btn small danger delete-category" data-id="${ParkingStore.escapeHtml(category.id)}" type="button">Eliminar</button>`
                  }
                </td>
              </tr>
            `
          )
          .join("");
      }

      document.getElementById("categoryForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const message = document.getElementById("categoryMessage");

        try {
          ParkingStore.transact((db) => {
            const name = String(form.get("name") || "").trim();
            const rate = ParkingStore.numberValue(form.get("rate"), "Tarifa", { min: 0 });
            if (!name) throw new Error("El nombre no puede estar vacio.");
            if (db.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
              throw new Error("Ya existe una categoria con ese nombre.");
            }

            db.categories.push({
              id: ParkingStore.nextId(db, "category"),
              name,
              rate,
              base: false,
              createdAt: new Date().toISOString()
            });
          });

          ParkingUI.renderSuccess(message, "Categoria creada.");
          event.currentTarget.reset();
          renderRows();
        } catch (error) {
          ParkingUI.renderError(message, error);
        }
      });

      main.addEventListener("click", (event) => {
        const button = event.target.closest(".delete-category");
        if (!button) return;
        if (!confirm("Eliminar esta categoria personalizada?")) return;

        try {
          ParkingStore.transact((db) => {
            const category = db.categories.find((item) => item.id === button.dataset.id);
            if (!category) throw new Error("La categoria ya no existe.");
            if (category.base) throw new Error("Las categorias base no se pueden eliminar.");
            if (db.records.some((record) => record.status === "activo" && record.categoryId === category.id)) {
              throw new Error("No se puede eliminar una categoria usada por vehiculos activos.");
            }
            db.categories = db.categories.filter((item) => item.id !== category.id);
          });
          ParkingUI.renderSuccess(document.getElementById("categoryMessage"), "Categoria eliminada.");
          renderRows();
        } catch (error) {
          ParkingUI.renderError(document.getElementById("categoryMessage"), error);
        }
      });

      renderRows();
    }
  );
})();
