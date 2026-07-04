(function () {
  "use strict";

  ParkingUI.protectedPage({ title: "Historial", active: "historial.html" }, ({ main, user }) => {
    const canEdit = ParkingStore.hasPermission(user, "editar_registros");
    const canDelete = ParkingStore.hasPermission(user, "eliminar_registros");
    const data = ParkingStore.getData();

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
                <label for="categoryFilter">Tipo</label>
                <select id="categoryFilter">
                  <option value="">Todos</option>
                  ${data.categories
                    .map((category) => `<option value="${ParkingStore.escapeHtml(category.id)}">${ParkingStore.escapeHtml(category.name)}</option>`)
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="statusFilter">Estado</label>
                <select id="statusFilter">
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
              <div class="field">
                <label for="paymentFilter">Pago</label>
                <select id="paymentFilter">
                  <option value="">Todos</option>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div class="field">
                <label for="orderFilter">Orden</label>
                <select id="orderFilter">
                  <option value="new">Mas recientes</option>
                  <option value="old">Mas antiguos</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section class="panel ${canEdit ? "" : "hidden"}" id="editPanel">
          <div class="panel-header"><h2>Editar registro</h2></div>
          <div class="panel-body" id="editBody">
            <div class="empty-state">Selecciona un registro para editarlo.</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Registros</h2></div>
          <div class="panel-body">
            <div id="historyMessage"></div>
            <div class="table-wrap" style="margin-top:14px">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Placa</th>
                    <th>Tipo</th>
                    <th>Color</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Pago</th>
                    <th>Turnos</th>
                    <th>Total</th>
                    <th>Pendiente</th>
                    <th>Entrada por</th>
                    <th>Salida por</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="historyRows"></tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;

    function filteredRecords() {
      const db = ParkingStore.getData();
      const plate = ParkingStore.normalizePlate(document.getElementById("plateFilter").value);
      const categoryId = document.getElementById("categoryFilter").value;
      const status = document.getElementById("statusFilter").value;
      const paymentStatus = document.getElementById("paymentFilter").value;
      const order = document.getElementById("orderFilter").value;

      return db.records
        .filter((record) => {
          return (
            (!plate || record.plate.includes(plate)) &&
            (!categoryId || record.categoryId === categoryId) &&
            (!status || record.status === status) &&
            (!paymentStatus ||
              (record.paymentStatus || (record.status === "activo" ? "pendiente" : "pagado")) === paymentStatus)
          );
        })
        .sort((a, b) => {
          const diff = new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime();
          return order === "old" ? -diff : diff;
        });
    }

    function renderRows() {
      const rows = filteredRecords();
      document.getElementById("historyRows").innerHTML = ParkingUI.renderRecordRows(rows, {
        actions: (record) => `
          <div class="actions">
            ${
              canEdit
                ? `<button class="btn small ghost edit-record" data-id="${ParkingStore.escapeHtml(record.id)}" type="button">Editar</button>`
                : ""
            }
            ${
              canDelete
                ? `<button class="btn small danger delete-record" data-id="${ParkingStore.escapeHtml(record.id)}" type="button">Eliminar</button>`
                : ""
            }
          </div>
        `
      });
    }

    function renderEditForm(recordId) {
      const db = ParkingStore.getData();
      const record = db.records.find((item) => item.id === recordId);
      const editBody = document.getElementById("editBody");
      if (!record) {
        editBody.innerHTML = '<div class="empty-state">El registro ya no existe.</div>';
        return;
      }

      editBody.innerHTML = `
        <form id="recordEditForm" class="form-grid">
          <input type="hidden" name="id" value="${ParkingStore.escapeHtml(record.id)}">
          <div class="inline-fields">
            <div class="field">
              <label for="editPlate">Placa</label>
              <input id="editPlate" name="plate" value="${ParkingStore.escapeHtml(record.plate)}" required>
            </div>
            <div class="field">
              <label for="editColor">Color</label>
              <input id="editColor" name="color" value="${ParkingStore.escapeHtml(record.color)}" required>
            </div>
          </div>
          <div class="inline-fields">
            <div class="field">
              <label for="editCategory">Tipo</label>
              <select id="editCategory" name="categoryId" required>
                ${ParkingUI.categoryOptions(db, record.categoryId)}
              </select>
            </div>
            <div class="field">
              <label for="editStatus">Estado</label>
              <select id="editStatus" name="status">
                <option value="activo" ${record.status === "activo" ? "selected" : ""}>Activo</option>
                <option value="finalizado" ${record.status === "finalizado" ? "selected" : ""}>Finalizado</option>
              </select>
            </div>
          </div>
          <div class="inline-fields">
            <div class="field">
              <label for="editEntry">Entrada</label>
              <input id="editEntry" name="entryAt" type="datetime-local" value="${ParkingStore.formatDateInput(record.entryAt)}" required>
            </div>
            <div class="field">
              <label for="editExit">Salida</label>
              <input id="editExit" name="exitAt" type="datetime-local" value="${ParkingStore.formatDateInput(record.exitAt)}">
            </div>
          </div>
          <div class="inline-fields">
            <div class="field">
              <label for="editShifts">Turnos cobrados</label>
              <input id="editShifts" name="shiftsCharged" type="number" min="0" step="1" value="${Number(record.shiftsCharged || 0)}">
            </div>
            <div class="field">
              <label for="editTotal">Total cobrado</label>
              <input id="editTotal" name="totalCharged" type="number" min="0" step="0.01" value="${Number(record.totalCharged || 0)}">
            </div>
          </div>
          <div id="editMessage"></div>
          <div class="actions">
            <button class="btn primary" type="submit">Guardar cambios</button>
            <button class="btn ghost" id="cancelEdit" type="button">Cancelar</button>
          </div>
        </form>
      `;
    }

    main.addEventListener("click", (event) => {
      const editButton = event.target.closest(".edit-record");
      if (editButton) {
        renderEditForm(editButton.dataset.id);
        document.getElementById("editPanel").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const cancelButton = event.target.closest("#cancelEdit");
      if (cancelButton) {
        document.getElementById("editBody").innerHTML = '<div class="empty-state">Selecciona un registro para editarlo.</div>';
        return;
      }

      const deleteButton = event.target.closest(".delete-record");
      if (!deleteButton) return;

      if (!confirm("Eliminar este registro de forma permanente?")) return;

      try {
        ParkingStore.transact((db) => {
          const index = db.records.findIndex((record) => record.id === deleteButton.dataset.id);
          if (index === -1) throw new Error("El registro ya no existe.");
          db.records.splice(index, 1);
        });
        ParkingUI.renderSuccess(document.getElementById("historyMessage"), "Registro eliminado.");
        renderRows();
      } catch (error) {
        ParkingUI.renderError(document.getElementById("historyMessage"), error);
      }
    });

    main.addEventListener("submit", (event) => {
      if (event.target.id !== "recordEditForm") return;
      event.preventDefault();
      const form = new FormData(event.target);
      const editMessage = document.getElementById("editMessage");

      try {
        ParkingStore.transact((db) => {
          const record = db.records.find((item) => item.id === form.get("id"));
          if (!record) throw new Error("El registro ya no existe.");

          const plate = ParkingStore.normalizePlate(form.get("plate"));
          const color = String(form.get("color") || "").trim();
          const category = ParkingStore.getCategory(db, form.get("categoryId"));
          const status = String(form.get("status"));
          const entryAt = ParkingStore.fromDateInput(form.get("entryAt"));
          const exitAt = ParkingStore.fromDateInput(form.get("exitAt"));
          const shiftsCharged = ParkingStore.numberValue(form.get("shiftsCharged") || 0, "Turnos cobrados", {
            min: 0,
            integer: true
          });
          const totalCharged = ParkingStore.numberValue(form.get("totalCharged") || 0, "Total cobrado", { min: 0 });

          if (!plate) throw new Error("La placa no puede estar vacia.");
          if (!color) throw new Error("El color no puede estar vacio.");
          if (!category) throw new Error("El tipo de vehiculo seleccionado no existe.");
          if (!entryAt) throw new Error("La fecha de entrada es obligatoria.");
          if (!["activo", "finalizado"].includes(status)) throw new Error("Estado invalido.");
          if (status === "finalizado" && !exitAt) throw new Error("Un registro finalizado necesita fecha de salida.");
          if (exitAt && new Date(exitAt).getTime() < new Date(entryAt).getTime()) {
            throw new Error("La salida no puede ser anterior a la entrada.");
          }

          const duplicate = db.records.find(
            (item) => item.id !== record.id && item.status === "activo" && item.plate === plate
          );
          if (status === "activo" && duplicate) throw new Error("Otra entrada activa ya usa esa placa.");

          record.plate = plate;
          record.color = color;
          record.categoryId = category.id;
          record.categoryName = category.name;
          record.entryAt = entryAt;
          record.exitAt = status === "activo" ? null : exitAt;
          record.status = status;
          record.shiftsCharged = status === "activo" ? 0 : shiftsCharged;
          record.totalCharged = status === "activo" ? 0 : totalCharged;
          record.updatedAt = new Date().toISOString();
        });

        ParkingUI.renderSuccess(editMessage, "Registro actualizado.");
        renderRows();
      } catch (error) {
        ParkingUI.renderError(editMessage, error);
      }
    });

    ["plateFilter", "categoryFilter", "statusFilter", "paymentFilter", "orderFilter"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderRows);
      document.getElementById(id).addEventListener("change", renderRows);
    });

    renderRows();
  });
})();
