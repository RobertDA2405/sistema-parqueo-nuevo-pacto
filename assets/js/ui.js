(function () {
  "use strict";

  const navItems = [
    { href: "dashboard.html", label: "Inicio", symbol: "I" },
    { href: "entradas.html", label: "Entradas", symbol: "E", permission: "registrar_entrada" },
    { href: "salida.html", label: "Salidas", symbol: "S", permission: "registrar_salida" },
    {
      href: "activos.html",
      label: "Vehiculos activos",
      symbol: "A",
      any: ["registrar_entrada", "registrar_salida", "actualizar_registros"]
    },
    { href: "historial.html", label: "Historial", symbol: "H" },
    {
      href: "turnos-anteriores.html",
      label: "Turnos anteriores",
      symbol: "D",
      permission: "gestionar_turnos_anteriores"
    },
    { href: "prepagos.html", label: "Prepagos", symbol: "P", permission: "gestionar_prepagos" },
    { href: "categorias.html", label: "Categorias", symbol: "C", permission: "gestionar_categorias" },
    { href: "tarifas.html", label: "Tarifas", symbol: "T", permission: "gestionar_tarifas" },
    { href: "usuarios.html", label: "Usuarios", symbol: "U", permission: "gestionar_usuarios" },
    { href: "capacidad.html", label: "Capacidad", symbol: "K", permission: "configurar_capacidad" },
    { href: "reportes.html", label: "Reportes", symbol: "R", permission: "generar_reportes" },
    { href: "actualizar.html", label: "Actualizar", symbol: "M", permission: "actualizar_registros" },
    { href: "auditoria.html", label: "Auditoria", symbol: "O", permission: "ver_auditoria" }
  ];

  function canSeeItem(user, item) {
    if (item.permission) return ParkingStore.hasPermission(user, item.permission);
    if (item.any) return ParkingStore.hasAnyPermission(user, item.any);
    return true;
  }

  function renderNav(user, active) {
    return navItems
      .filter((item) => canSeeItem(user, item))
      .map(
        (item) => `
          <a class="nav-link ${active === item.href ? "active" : ""}" href="${item.href}">
            <span class="nav-symbol">${item.symbol}</span>
            <span>${item.label}</span>
          </a>
        `
      )
      .join("");
  }

  function renderShell(title, active, user) {
    document.body.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-title">
              <span class="brand-mark">P</span>
              <span>El Nuevo Pacto</span>
            </div>
            <div class="sidebar-user">
              <div class="sidebar-subtitle">${ParkingStore.escapeHtml(user.username)} · ${ParkingStore.escapeHtml(user.role)}</div>
              <button class="menu-toggle" id="menuToggle" type="button" aria-expanded="false" aria-controls="mainNav">
                <span>Menu</span>
                <span class="menu-toggle-mark">+</span>
              </button>
            </div>
          </div>
          <nav class="nav-list" id="mainNav" aria-label="Menu principal">
            ${renderNav(user, active)}
          </nav>
        </aside>
        <section class="main-area">
          <header class="topbar">
            <h1>${ParkingStore.escapeHtml(title)}</h1>
            <div class="user-chip">
              <span>${ParkingStore.escapeHtml(user.username)}</span>
              <button class="btn small ghost" id="logoutButton" type="button">Salir</button>
            </div>
          </header>
          <main class="content" id="pageContent"></main>
        </section>
      </div>
    `;

    document.getElementById("logoutButton").addEventListener("click", () => {
      ParkingStore.clearSession();
      window.location.href = "index.html";
    });

    document.getElementById("menuToggle").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const shell = document.querySelector(".app-shell");
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      shell.classList.toggle("nav-open", !expanded);
    });

    return document.getElementById("pageContent");
  }

  function protectedPage(options, render) {
    ParkingStore.init();
    const user = ParkingStore.getSessionUser();
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const main = renderShell(options.title, options.active, user);
    const allowed =
      ParkingStore.hasPermission(user, options.permission) &&
      ParkingStore.hasAnyPermission(user, options.any);

    if (!allowed) {
      main.innerHTML = `
        <div class="notice danger">
          No tienes permiso para abrir esta pagina.
        </div>
      `;
      return;
    }

    render({ main, user, data: ParkingStore.getData() });
    watchResponsiveTables(main);
  }

  function categoryOptions(data, selectedId) {
    return data.categories
      .map(
        (category) => `
          <option value="${ParkingStore.escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>
            ${ParkingStore.escapeHtml(category.name)} - ${ParkingStore.formatCurrency(category.rate)}
          </option>
        `
      )
      .join("");
  }

  function statusBadge(status) {
    if (status === "activo") return '<span class="badge active">Activo</span>';
    return '<span class="badge done">Finalizado</span>';
  }

  function paymentBadge(status) {
    if (status === "pendiente") return '<span class="badge danger">Pendiente</span>';
    return '<span class="badge active">Pagado</span>';
  }

  function renderError(target, error) {
    const message = error instanceof Error ? error.message : String(error || "Ocurrio un error.");
    target.innerHTML = `<div class="notice danger">${ParkingStore.escapeHtml(message)}</div>`;
  }

  function renderSuccess(target, message) {
    target.innerHTML = `<div class="notice success">${ParkingStore.escapeHtml(message)}</div>`;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function activeRecords(data) {
    return data.records
      .filter((record) => record.status === "activo")
      .sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime());
  }

  function occupancy(data) {
    const active = data.records.filter((record) => record.status === "activo").length;
    const capacity = Number(data.config.capacity || 0);
    const available = Math.max(0, capacity - active);
    const percent = capacity > 0 ? Math.round((active / capacity) * 100) : 0;
    const threshold = Number(data.config.occupancyThreshold || 0);
    return { active, available, capacity, percent, threshold, alert: threshold > 0 && percent >= threshold };
  }

  function renderRecordRows(records, options) {
    const settings = Object.assign({ actions: "" }, options || {});
    if (!records.length) {
      return `<tr><td colspan="14"><div class="empty-state">No hay registros para mostrar.</div></td></tr>`;
    }

    return records
      .map(
        (record) => `
          <tr>
            <td>${ParkingStore.escapeHtml(record.id)}</td>
            <td><strong>${ParkingStore.escapeHtml(record.plate)}</strong></td>
            <td>${ParkingStore.escapeHtml(record.categoryName)}</td>
            <td>${ParkingStore.escapeHtml(record.color)}</td>
            <td>${ParkingStore.formatDateTime(record.entryAt)}</td>
            <td>${ParkingStore.formatDateTime(record.exitAt)}</td>
            <td>${statusBadge(record.status)}</td>
            <td>${paymentBadge(record.paymentStatus || (record.status === "activo" ? "pendiente" : "pagado"))}</td>
            <td>${Number(record.shiftsCharged || record.currentShifts || 0)}</td>
            <td>${ParkingStore.formatCurrency(record.totalCharged || record.currentDebt || 0)}</td>
            <td>${ParkingStore.formatCurrency(record.unpaidAmount || 0)}</td>
            <td>${ParkingStore.escapeHtml(record.createdByUsername || "")}</td>
            <td>${ParkingStore.escapeHtml(record.exitByUsername || "")}</td>
            <td>${typeof settings.actions === "function" ? settings.actions(record) : settings.actions}</td>
          </tr>
        `
      )
      .join("");
  }

  function applyResponsiveTables(root) {
    const scope = root || document;
    scope.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th")).map((header) =>
        header.textContent.trim()
      );
      table.classList.add("responsive-table");
      table.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          if (!cell.hasAttribute("colspan")) {
            const label = headers[index] || "";
            if (cell.getAttribute("data-label") !== label) {
              cell.setAttribute("data-label", label);
            }
          }
        });
      });
    });
  }

  function watchResponsiveTables(root) {
    applyResponsiveTables(root);
    const observer = new MutationObserver(() => applyResponsiveTables(root));
    observer.observe(root, { childList: true, subtree: true });
  }

  window.ParkingUI = {
    activeRecords,
    categoryOptions,
    getQueryParam,
    occupancy,
    protectedPage,
    applyResponsiveTables,
    paymentBadge,
    renderError,
    renderRecordRows,
    renderSuccess,
    statusBadge
  };
})();
