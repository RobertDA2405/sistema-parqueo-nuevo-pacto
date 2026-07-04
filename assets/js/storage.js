(function () {
  "use strict";

  const STORE_KEY = "nuevo-pacto-parqueo-data-v1";
  const SESSION_KEY = "nuevo-pacto-parqueo-session-v1";

  const permissions = [
    { key: "registrar_entrada", label: "Registrar entrada" },
    { key: "registrar_salida", label: "Registrar salida" },
    { key: "editar_registros", label: "Editar registros" },
    { key: "eliminar_registros", label: "Eliminar registros" },
    { key: "gestionar_tarifas", label: "Gestionar tarifas" },
    { key: "gestionar_prepagos", label: "Gestionar prepagos" },
    { key: "gestionar_categorias", label: "Gestionar categorias" },
    { key: "gestionar_usuarios", label: "Gestionar usuarios" },
    { key: "gestionar_turnos_anteriores", label: "Gestionar turnos anteriores" },
    { key: "configurar_capacidad", label: "Configurar capacidad" },
    { key: "generar_reportes", label: "Generar reportes" },
    { key: "exportar_csv", label: "Exportar CSV" },
    { key: "actualizar_registros", label: "Actualizar registros" },
    { key: "ver_auditoria", label: "Ver auditoria" }
  ];

  const rolePresets = {
    Administrador: permissions.map((permission) => permission.key),
    Cajero: [
      "registrar_entrada",
      "registrar_salida",
      "gestionar_turnos_anteriores",
      "gestionar_prepagos",
      "generar_reportes",
      "exportar_csv",
      "actualizar_registros"
    ],
    Guardia: ["registrar_entrada", "registrar_salida", "gestionar_turnos_anteriores", "actualizar_registros"]
  };

  const baseCategories = [
    { id: "moto", name: "Moto", rate: 20, base: true },
    { id: "carro-caponera", name: "Carro / caponera", rate: 30, base: true },
    {
      id: "camioneta-cajon-microbus-pequeno",
      name: "Camioneta / cajon pequeno / microbus pequeno",
      rate: 40,
      base: true
    },
    {
      id: "camion-mediano-microbus-mediano",
      name: "Camion mediano / microbus mediano",
      rate: 50,
      base: true
    },
    { id: "camion", name: "Camion", rate: 60, base: true },
    { id: "cabezal-bus", name: "Cabezal / bus", rate: 70, base: true }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultData() {
    return {
      version: 1,
      counters: { record: 0, prepaid: 0, user: 1, category: 0, previousTurn: 0, audit: 0 },
      categories: clone(baseCategories),
      records: [],
      prepaids: [],
      previousTurns: [],
      auditLog: [],
      users: [
        {
          id: "user-0001",
          username: "admin",
          password: "admin123",
          role: "Administrador",
          permissions: clone(rolePresets.Administrador),
          active: true,
          createdAt: new Date().toISOString()
        }
      ],
      config: {
        capacity: 50,
        occupancyThreshold: 80,
        businessName: "Sistema de Parqueo El Nuevo Pacto"
      },
      lastDailyUpdateAt: null
    };
  }

  function normalizeData(data) {
    const defaults = createDefaultData();
    const merged = Object.assign(defaults, data || {});
    merged.counters = Object.assign(defaults.counters, (data && data.counters) || {});
    merged.config = Object.assign(defaults.config, (data && data.config) || {});
    merged.categories = Array.isArray(merged.categories) ? merged.categories : clone(baseCategories);
    merged.records = Array.isArray(merged.records) ? merged.records : [];
    merged.prepaids = Array.isArray(merged.prepaids) ? merged.prepaids : [];
    merged.previousTurns = Array.isArray(merged.previousTurns) ? merged.previousTurns : [];
    merged.auditLog = Array.isArray(merged.auditLog) ? merged.auditLog : [];
    merged.users = Array.isArray(merged.users) && merged.users.length ? merged.users : defaults.users;

    const existingCategoryIds = new Set(merged.categories.map((category) => category.id));
    baseCategories.forEach((category) => {
      if (!existingCategoryIds.has(category.id)) {
        merged.categories.push(clone(category));
      }
    });

    return merged;
  }

  function init() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      saveData(createDefaultData());
      return;
    }

    try {
      saveData(normalizeData(JSON.parse(raw)));
    } catch (error) {
      console.error("No se pudo leer la base local.", error);
      saveData(createDefaultData());
    }
  }

  function getData() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const defaults = createDefaultData();
      saveData(defaults);
      return defaults;
    }

    return normalizeData(JSON.parse(raw));
  }

  function saveData(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  function transact(callback) {
    const data = getData();
    const result = callback(data);
    saveData(data);
    return result;
  }

  function nextId(data, key) {
    data.counters[key] = Number(data.counters[key] || 0) + 1;
    return `${key}-${String(data.counters[key]).padStart(4, "0")}`;
  }

  function normalizePlate(plate) {
    return String(plate || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function getCategory(data, categoryId) {
    return data.categories.find((category) => category.id === categoryId) || null;
  }

  function getActiveRecordByPlate(data, plate) {
    const normalized = normalizePlate(plate);
    return data.records.find((record) => record.status === "activo" && record.plate === normalized) || null;
  }

  function setSessionUser(userId) {
    localStorage.setItem(SESSION_KEY, userId);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSessionUser() {
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) return null;
    return getData().users.find((user) => user.id === userId && user.active) || null;
  }

  function userSnapshot(user) {
    if (!user) {
      return { userId: null, username: "Sistema", role: "Sistema" };
    }

    return {
      userId: user.id || null,
      username: user.username || "Sistema",
      role: user.role || "Sistema"
    };
  }

  function logAction(data, user, action, detail) {
    const snapshot = userSnapshot(user);
    const entry = {
      id: nextId(data, "audit"),
      action,
      detail: String(detail || ""),
      userId: snapshot.userId,
      username: snapshot.username,
      role: snapshot.role,
      createdAt: new Date().toISOString()
    };
    data.auditLog.unshift(entry);
    data.auditLog = data.auditLog.slice(0, 1000);
    return entry;
  }

  function login(username, password) {
    const normalizedUser = String(username || "").trim().toLowerCase();
    const data = getData();
    const user = data.users.find(
      (candidate) =>
        candidate.active &&
        candidate.username.toLowerCase() === normalizedUser &&
        candidate.password === String(password || "")
    );

    if (user) {
      setSessionUser(user.id);
      return user;
    }

    return null;
  }

  function hasPermission(user, permissionKey) {
    if (!permissionKey) return true;
    if (!user || !user.active) return false;
    if (user.role === "Administrador") return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permissionKey);
  }

  function hasAnyPermission(user, permissionKeys) {
    if (!permissionKeys || !permissionKeys.length) return true;
    return permissionKeys.some((permissionKey) => hasPermission(user, permissionKey));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "Pendiente";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha invalida";
    return new Intl.DateTimeFormat("es-NI", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatDateInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromDateInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function todayInput() {
    const date = new Date();
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatCurrency(value) {
    return `C$${Number(value || 0).toFixed(2)}`;
  }

  function numberValue(value, fieldName, options) {
    const number = Number(value);
    const settings = Object.assign({ min: 0, integer: false }, options || {});
    if (!Number.isFinite(number)) {
      throw new Error(`${fieldName} debe ser un numero valido.`);
    }
    if (settings.integer && !Number.isInteger(number)) {
      throw new Error(`${fieldName} debe ser un numero entero.`);
    }
    if (number < settings.min) {
      throw new Error(`${fieldName} no puede ser menor que ${settings.min}.`);
    }
    return number;
  }

  function recordsToCsv(records) {
    const headers = [
      "ID",
      "Placa",
      "Color",
      "Tipo",
      "Entrada",
      "Salida",
      "Estado",
      "Estado de pago",
      "Turnos cobrados",
      "Prepagos usados",
      "Turnos anteriores pagados",
      "Pendiente generado",
      "Total cobrado",
      "Registro entrada",
      "Registro salida"
    ];

    const rows = records.map((record) => [
      record.id,
      record.plate,
      record.color,
      record.categoryName,
      formatDateTime(record.entryAt),
      formatDateTime(record.exitAt),
      record.status,
      record.paymentStatus || "pendiente",
      record.shiftsCharged || 0,
      record.prepaidUsed || 0,
      record.previousTurnsPaid || 0,
      Number(record.unpaidAmount || 0).toFixed(2),
      Number(record.totalCharged || 0).toFixed(2),
      record.createdByUsername || "",
      record.exitByUsername || ""
    ]);

    return toCsv([headers].concat(rows));
  }

  function toCsv(rows) {
    return rows
      .map((row) =>
        row
          .map((value) => {
            const cell = String(value == null ? "" : value);
            return `"${cell.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");
  }

  function downloadCsv(filename, csvContent) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  window.ParkingStore = {
    baseCategories,
    clearSession,
    downloadCsv,
    escapeHtml,
    formatCurrency,
    formatDateInput,
    formatDateTime,
    fromDateInput,
    getActiveRecordByPlate,
    getCategory,
    getData,
    getSessionUser,
    hasAnyPermission,
    hasPermission,
    init,
    login,
    logAction,
    nextId,
    normalizePlate,
    numberValue,
    permissions,
    recordsToCsv,
    rolePresets,
    saveData,
    setSessionUser,
    todayInput,
    toCsv,
    transact,
    userSnapshot
  };
})();
