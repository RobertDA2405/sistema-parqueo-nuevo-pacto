(function () {
  "use strict";

  const MINUTE = 60 * 1000;
  const TOLERANCE_MINUTES = 15;
  const DAY_START = 8;
  const NIGHT_START = 18;

  function dateAtHour(baseDate, hour) {
    const date = new Date(baseDate);
    date.setHours(hour, 0, 0, 0);
    return date;
  }

  function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * MINUTE);
  }

  function adjustExitForTolerance(exitDate, entryDate) {
    const candidates = [dateAtHour(exitDate, DAY_START), dateAtHour(exitDate, NIGHT_START)];
    for (const boundary of candidates) {
      const toleranceEnd = new Date(boundary.getTime() + TOLERANCE_MINUTES * MINUTE);
      if (exitDate.getTime() >= boundary.getTime() && exitDate.getTime() <= toleranceEnd.getTime()) {
        return boundary.getTime() > entryDate.getTime() ? boundary : exitDate;
      }
    }
    return exitDate;
  }

  function getShiftStart(date) {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);
    const hour = start.getHours();

    if (hour >= DAY_START && hour < NIGHT_START) {
      start.setHours(DAY_START, 0, 0, 0);
      return { start, label: "Dia" };
    }

    if (hour >= NIGHT_START) {
      start.setHours(NIGHT_START, 0, 0, 0);
      return { start, label: "Noche" };
    }

    start.setDate(start.getDate() - 1);
    start.setHours(NIGHT_START, 0, 0, 0);
    return { start, label: "Noche" };
  }

  function nextShift(shift) {
    if (shift.label === "Dia") {
      return { start: addHours(shift.start, 10), label: "Noche" };
    }
    return { start: addHours(shift.start, 14), label: "Dia" };
  }

  function getShiftEnd(shift) {
    return shift.label === "Dia" ? addHours(shift.start, 10) : addHours(shift.start, 14);
  }

  function calculateShifts(entryIso, exitIso) {
    const entry = new Date(entryIso);
    const exit = new Date(exitIso);

    if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) {
      throw new Error("Las fechas de entrada y salida deben ser validas.");
    }

    if (exit.getTime() < entry.getTime()) {
      throw new Error("La salida no puede ser anterior a la entrada.");
    }

    const effectiveExit = adjustExitForTolerance(exit, entry);
    let cursor = getShiftStart(entry);
    const charged = [];
    let guard = 0;

    while (cursor.start.getTime() < effectiveExit.getTime() && guard < 10000) {
      const shiftEnd = getShiftEnd(cursor);
      const intersects =
        shiftEnd.getTime() > entry.getTime() && cursor.start.getTime() < effectiveExit.getTime();

      if (intersects) {
        charged.push({
          label: cursor.label,
          start: cursor.start.toISOString(),
          end: shiftEnd.toISOString()
        });
      }

      cursor = nextShift(cursor);
      guard += 1;
    }

    if (!charged.length) {
      const single = getShiftStart(entry);
      charged.push({
        label: single.label,
        start: single.start.toISOString(),
        end: getShiftEnd(single).toISOString()
      });
    }

    return {
      count: charged.length,
      shifts: charged,
      toleranceApplied: effectiveExit.getTime() !== exit.getTime(),
      effectiveExit: effectiveExit.toISOString()
    };
  }

  function getRateForRecord(data, record) {
    const category = ParkingStore.getCategory(data, record.categoryId);
    return category ? Number(category.rate) : Number(record.rateAtEntry || record.rateAtExit || 0);
  }

  function pendingPreviousTurns(data, plate) {
    const normalized = ParkingStore.normalizePlate(plate);
    return data.previousTurns
      .filter((item) => item.plate === normalized && item.status === "pendiente")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  function summarizePreviousTurns(data, plate) {
    const items = pendingPreviousTurns(data, plate);
    return {
      amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      count: items.length,
      items,
      turns: items.reduce((sum, item) => sum + Number(item.turns || 0), 0)
    };
  }

  function estimateCharge(data, record, exitIso) {
    const shifts = calculateShifts(record.entryAt, exitIso);
    const prepaid = data.prepaids.find((item) => item.plate === record.plate);
    const prepaidAvailable = prepaid ? Number(prepaid.turnsRemaining || 0) : 0;
    const prepaidUsed = Math.min(shifts.count, prepaidAvailable);
    const rate = getRateForRecord(data, record);
    const cashShifts = shifts.count - prepaidUsed;
    const previous = summarizePreviousTurns(data, record.plate);
    const currentTotal = cashShifts * rate;

    return {
      cashShifts,
      currentTotal,
      grandTotal: currentTotal + previous.amount,
      prepaidAvailable,
      prepaidUsed,
      previousAmount: previous.amount,
      previousItems: previous.items,
      previousTurns: previous.turns,
      rate,
      shifts: shifts.shifts,
      toleranceApplied: shifts.toleranceApplied,
      total: currentTotal,
      turnCount: shifts.count
    };
  }

  function markPreviousTurnsPaid(data, items, user, paidInRecordId) {
    const now = new Date().toISOString();
    const snapshot = ParkingStore.userSnapshot(user);
    items.forEach((item) => {
      item.status = "pagado";
      item.paidAt = now;
      item.paidByUserId = snapshot.userId;
      item.paidByUsername = snapshot.username;
      item.paidInRecordId = paidInRecordId || null;
      item.updatedAt = now;
    });

    return {
      amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      turns: items.reduce((sum, item) => sum + Number(item.turns || 0), 0)
    };
  }

  function createPreviousTurn(data, record, estimate, user) {
    if (estimate.total <= 0) return null;

    const now = new Date().toISOString();
    const snapshot = ParkingStore.userSnapshot(user);
    const debt = {
      id: ParkingStore.nextId(data, "previousTurn"),
      plate: record.plate,
      sourceRecordId: record.id,
      categoryId: record.categoryId,
      categoryName: record.categoryName,
      turns: estimate.cashShifts,
      rate: estimate.rate,
      amount: estimate.total,
      status: "pendiente",
      createdAt: now,
      createdByUserId: snapshot.userId,
      createdByUsername: snapshot.username,
      paidAt: null,
      paidByUserId: null,
      paidByUsername: null,
      paidInRecordId: null,
      note: "Salida registrada sin pago"
    };

    data.previousTurns.unshift(debt);
    return debt;
  }

  function finalizeExit(data, recordId, exitIso, options) {
    const settings = Object.assign({ paymentMode: "paid", user: null }, options || {});
    const record = data.records.find((item) => item.id === recordId);
    if (!record || record.status !== "activo") {
      throw new Error("No se encontro un registro activo para esa salida.");
    }

    const exitAt = exitIso || new Date().toISOString();
    const category = ParkingStore.getCategory(data, record.categoryId);
    if (!category) {
      throw new Error("El tipo de vehiculo del registro ya no existe.");
    }

    const estimate = estimateCharge(data, record, exitAt);
    const prepaid = data.prepaids.find((item) => item.plate === record.plate);
    if (prepaid && estimate.prepaidUsed > 0) {
      prepaid.turnsRemaining = Math.max(0, Number(prepaid.turnsRemaining || 0) - estimate.prepaidUsed);
      prepaid.updatedAt = new Date().toISOString();
    }

    const snapshot = ParkingStore.userSnapshot(settings.user);
    const paidNow = settings.paymentMode !== "unpaid";
    const previousPaid = paidNow
      ? markPreviousTurnsPaid(data, estimate.previousItems, settings.user, record.id)
      : { amount: 0, turns: 0 };
    const createdDebt = paidNow ? null : createPreviousTurn(data, record, estimate, settings.user);

    record.exitAt = exitAt;
    record.status = "finalizado";
    record.shiftsCharged = estimate.turnCount;
    record.prepaidUsed = estimate.prepaidUsed;
    record.previousTurnsPaid = previousPaid.turns;
    record.previousDebtPaid = previousPaid.amount;
    record.totalCharged = paidNow ? estimate.total + previousPaid.amount : 0;
    record.unpaidTurns = createdDebt ? createdDebt.turns : 0;
    record.unpaidAmount = createdDebt ? createdDebt.amount : 0;
    record.paymentStatus = paidNow || estimate.total === 0 ? "pagado" : "pendiente";
    record.rateAtExit = estimate.rate;
    record.toleranceApplied = estimate.toleranceApplied;
    record.exitByUserId = snapshot.userId;
    record.exitByUsername = snapshot.username;
    record.updatedAt = new Date().toISOString();

    ParkingStore.logAction(
      data,
      settings.user,
      paidNow ? "salida_cobrada" : "salida_sin_pagar",
      `${record.plate} · ${record.categoryName} · ${paidNow ? ParkingStore.formatCurrency(record.totalCharged) : "pendiente " + ParkingStore.formatCurrency(record.unpaidAmount)}`
    );

    return {
      createdDebt,
      record,
      estimate,
      remainingPrepaid: prepaid ? prepaid.turnsRemaining : 0,
      previousPaid
    };
  }

  function collectPreviousTurns(data, ids, user) {
    const idSet = new Set(ids || []);
    const items = data.previousTurns.filter((item) => item.status === "pendiente" && idSet.has(item.id));
    if (!items.length) {
      throw new Error("No hay turnos anteriores pendientes para cobrar.");
    }

    const paid = markPreviousTurnsPaid(data, items, user, null);
    ParkingStore.logAction(
      data,
      user,
      "turnos_anteriores_cobrados",
      `${items[0].plate} · ${paid.turns} turnos · ${ParkingStore.formatCurrency(paid.amount)}`
    );
    return { items, paid };
  }

  function updateActiveRecords(data, nowIso) {
    const now = nowIso || new Date().toISOString();
    const updated = [];

    data.records
      .filter((record) => record.status === "activo")
      .forEach((record) => {
        const estimate = estimateCharge(data, record, now);
        record.currentShifts = estimate.turnCount;
        record.currentDebt = estimate.grandTotal;
        record.currentPrepaidUsed = estimate.prepaidUsed;
        record.currentPreviousDebt = estimate.previousAmount;
        record.lastCalculatedAt = now;
        updated.push({ record, estimate });
      });

    data.lastDailyUpdateAt = now;
    return updated;
  }

  function dailyReport(data, dateText) {
    const selectedDate = dateText || ParkingStore.todayInput();
    const isSameLocalDate = (value) => {
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      const pad = (number) => String(number).padStart(2, "0");
      const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      return local === selectedDate;
    };

    const entered = data.records.filter((record) => isSameLocalDate(record.entryAt));
    const exited = data.records.filter((record) => record.status === "finalizado" && isSameLocalDate(record.exitAt));
    const previousPaidStandalone = data.previousTurns.filter(
      (item) => item.status === "pagado" && !item.paidInRecordId && isSameLocalDate(item.paidAt)
    );
    const byType = {};

    exited.forEach((record) => {
      byType[record.categoryName] = (byType[record.categoryName] || 0) + Number(record.totalCharged || 0);
    });
    previousPaidStandalone.forEach((item) => {
      byType[item.categoryName] = (byType[item.categoryName] || 0) + Number(item.amount || 0);
    });

    const recordCollected = exited.reduce((sum, record) => sum + Number(record.totalCharged || 0), 0);
    const previousCollected = previousPaidStandalone.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      date: selectedDate,
      enteredCount: entered.length,
      exitedCount: exited.length,
      previousTurnsCollected: previousPaidStandalone.reduce((sum, item) => sum + Number(item.turns || 0), 0),
      totalCollected: recordCollected + previousCollected,
      turnsCharged:
        exited.reduce((sum, record) => sum + Number(record.shiftsCharged || 0), 0) +
        previousPaidStandalone.reduce((sum, item) => sum + Number(item.turns || 0), 0),
      prepaidUsed: exited.reduce((sum, record) => sum + Number(record.prepaidUsed || 0), 0),
      byType,
      previousPaidStandalone,
      records: exited
    };
  }

  window.ParkingLogic = {
    calculateShifts,
    collectPreviousTurns,
    dailyReport,
    estimateCharge,
    finalizeExit,
    pendingPreviousTurns,
    summarizePreviousTurns,
    updateActiveRecords
  };
})();
