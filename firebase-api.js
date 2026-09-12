// ============================================================
// PANDA CONSTRUCTION — FIRESTORE DATA LAYER
// Same PandaAPI.call(action, payload) interface the app already uses —
// index.html needs no changes. Backed by Firestore instead of Google Sheets.
// ============================================================
(function () {
  const db = window.fsdb;
  const USER_PASSWORDS = { "Subrat Panda": "00000", "Hrushikesh Padhi": "11111", "Ayaskanta Giri": "22222", "Sukadev": "33333" };

  // Business-style IDs (e.g. "PAY7"), kept sequential via a counters doc so tables still read
  // like "SL No 1, 2, 3..." instead of random strings. Verifies against the actual collection
  // so it can never hand out an ID that's already in use (avoids silent overwrites).
  function nextId(counterName, prefix, coll) {
    const ref = db.collection("meta").doc("counters");
    return db.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        const data = snap.exists ? snap.data() : {};
        const n = (data[counterName] || 0) + 1;
        const update = {}; update[counterName] = n;
        tx.set(ref, update, { merge: true });
        return prefix + n;
      });
    }).then(async function (id) {
      if (!coll) return id;
      const exists = await db.collection(coll).doc(String(id)).get();
      if (!exists.exists) return id;
      // counter was stale (e.g. migrated data written after counter last advanced) — bump past
      // the real max in this collection and retry once.
      const snap = await db.collection(coll).get();
      let maxN = 0;
      snap.docs.forEach(function (d) { const num = Number(String(d.id).replace(prefix, "")); if (!isNaN(num) && num > maxN) maxN = num; });
      const update = {}; update[counterName] = maxN;
      await ref.set(update, { merge: true });
      return nextId(counterName, prefix, coll);
    });
  }

  async function auditLog(user, action, module, recordId, details) {
    await db.collection("auditLog").add({ Timestamp: new Date().toISOString(), User: user || "", Action: action, Module: module, RecordID: String(recordId), Details: details || "" });
  }

  async function colToArray(name) {
    const snap = await db.collection(name).get();
    return snap.docs.map(function (d) { return d.data(); });
  }

  // ---------- collection map: action-family -> {coll, idField, counter, prefix} ----------
  const MAP = {
    Supplier: { coll: "suppliers", idField: "SupplierID", counter: "SupplierID", prefix: "SUP", def: { Status: "Active" } },
    Transaction: { coll: "transactions", idField: "SLNo", counter: "SLNo", prefix: "" },
    Payment: { coll: "payments", idField: "PaymentID", counter: "PaymentID", prefix: "PAY", def: { Status: "Active" } },
    DieselTransaction: { coll: "dieselTx", idField: "SLNo", counter: "DieselSLNo", prefix: "" },
    DieselPayment: { coll: "dieselPayments", idField: "PaymentID", counter: "DieselPaymentID", prefix: "DPAY", def: { Status: "Active" } },
    Site: { coll: "sites", idField: "SiteID", counter: "SiteID", prefix: "S", def: { Status: "Active" } },
    Material: { coll: "materials", idField: "MaterialID", counter: "MaterialID", prefix: "M", def: { Status: "Active" } },
    Staff: { coll: "staff", idField: "StaffID", counter: "StaffID", prefix: "ST", def: { Status: "Active" } },
    StaffSalary: { coll: "staffSalary", idField: "SalaryID", counter: "SalaryID", prefix: "SAL" },
    StaffPayment: { coll: "staffPayments", idField: "PaymentID", counter: "StaffPaymentID", prefix: "SPAY" },
    StaffAttendance: { coll: "staffAttendance", idField: "AttendanceID", counter: "AttendanceID", prefix: "ATT" },
    Mistri: { coll: "mistri", idField: "MistriID", counter: "MistriID", prefix: "MI", def: { Status: "Active" } },
    MistriDue: { coll: "mistriDue", idField: "DueID", counter: "DueID", prefix: "MD" },
    MistriPayment: { coll: "mistriPayments", idField: "PaymentID", counter: "MistriPaymentID", prefix: "MP", def: { Status: "Active" } },
    MistriAdvance: { coll: "mistriAdvances", idField: "AdvanceID", counter: "MistriAdvanceID", prefix: "MA", def: { Status: "Active" } },
    Labour: { coll: "labour", idField: "LabourID", counter: "LabourID", prefix: "LB", def: { Status: "Active" } },
    LabourEntry: { coll: "labourEntries", idField: "EntryID", counter: "EntryID", prefix: "LE" },
    LabourPayment: { coll: "labourPayments", idField: "PaymentID", counter: "LabourPaymentID", prefix: "LP", def: { Status: "Active" } },
    LabourAdvance: { coll: "labourAdvances", idField: "AdvanceID", counter: "LabourAdvanceID", prefix: "LA", def: { Status: "Active" } },
    FundTransfer: { coll: "fundTransfers", idField: "TransferID", counter: "TransferID", prefix: "FT", def: { Status: "Active" } },
    SiteAllocation: { coll: "siteAllocations", idField: "AllocationID", counter: "AllocationID", prefix: "SA", def: { Status: "Active" } },
    SiteExpense: { coll: "siteExpenses", idField: "ExpenseID", counter: "ExpenseID", prefix: "SE", def: { Status: "Active" } },
    OtherPayment: { coll: "otherPayments", idField: "PaymentID", counter: "OtherPaymentID", prefix: "OTH", def: { Status: "Active" } }
  };

  async function genericAdd(key, payload) {
    const m = MAP[key];
    const id = await nextId(m.counter, m.prefix, m.coll);
    const rec = Object.assign({}, m.def, payload, { CreatedAt: new Date().toISOString() });
    rec[m.idField] = m.idField === "SLNo" ? Number(id.replace(m.prefix, "")) : id;
    await db.collection(m.coll).doc(String(rec[m.idField])).set(rec);
    return { rec: rec, id: rec[m.idField] };
  }
  async function genericUpdate(key, payload, fields) {
    const m = MAP[key];
    const idVal = payload[m.idField];
    if (idVal === undefined || idVal === null || idVal === "") return false;
    const ref = db.collection(m.coll).doc(String(idVal));
    const snap = await ref.get();
    if (!snap.exists) {
      // fallback: doc ID drifted from the record's id field (older migrated rows) — find by field match.
      const q = await db.collection(m.coll).where(m.idField, "==", idVal).limit(1).get();
      if (q.empty) return false;
      await q.docs[0].ref.set(fields, { merge: true });
      return true;
    }
    await ref.set(fields, { merge: true });
    return true;
  }
  async function genericDelete(key, idValue) {
    const m = MAP[key];
    if (idValue === undefined || idValue === null || idValue === "") return;
    const ref = db.collection(m.coll).doc(String(idValue));
    const snap = await ref.get();
    if (snap.exists) { await ref.delete(); return; }
    const q = await db.collection(m.coll).where(m.idField, "==", idValue).limit(1).get();
    if (!q.empty) await q.docs[0].ref.delete();
  }

  function computeLabourNet(p) {
    const additional = Number(p.AdditionalAmount) || 0;
    const fare = Number(p.Fare) || 0;
    if (String(p.Type) === "Contract") return (Number(p.WorkMeter) || 0) * (Number(p.Price) || 0) + additional + fare;
    return (Number(p.DailyPrice) || 0) * (Number(p.HowManyLabour) || 0) + additional + fare;
  }

  async function getSettingsMap() {
    const snap = await db.collection("settings").get();
    const map = {};
    snap.docs.forEach(function (d) { map[d.id] = d.data().Value; });
    return map;
  }
  async function setSettingValue(key, value) {
    await db.collection("settings").doc(key).set({ Value: value }, { merge: true });
  }
  async function getMaintenanceStatus() {
    const st = await getSettingsMap();
    return { enabled: String(st.MaintenanceMode) === "TRUE", message: st.MaintenanceMessage || "" };
  }

  async function route(action, p) {
    p = p || {};
    switch (action) {
      case "login": {
        const users = await colToArray("users");
        const u = users.find(function (x) { return String(x.Name).toLowerCase() === String(p.name || "").toLowerCase() && x.Status === "Active"; });
        const pass = USER_PASSWORDS[u && u.Name];
        if (u && pass && String(p.password) === pass) {
          await db.collection("users").doc(u.UserID).set({ LastLogin: new Date().toISOString() }, { merge: true });
          return { success: true, user: { name: u.Name, role: u.Role }, maintenance: await getMaintenanceStatus() };
        }
        return { success: false, message: "Invalid name or password." };
      }
      case "setMaintenance": {
        const users = await colToArray("users");
        const requester = users.find(function (x) { return String(x.Name).toLowerCase() === String(p.RequestedBy || "").toLowerCase(); });
        if (!requester || requester.Role !== "Admin 1") return { success: false, message: "Only Admin 1 can change maintenance mode." };
        await setSettingValue("MaintenanceMode", p.Enabled ? "TRUE" : "FALSE");
        if (p.Message !== undefined) await setSettingValue("MaintenanceMessage", p.Message);
        await auditLog(p.RequestedBy, p.Enabled ? "Enabled Maintenance Mode" : "Disabled Maintenance Mode", "Settings", "", p.Message || "");
        return { success: true, message: "Maintenance settings updated.", maintenance: await getMaintenanceStatus() };
      }
      case "getCollection": return { success: true, data: await colToArray(p.name) };
      case "getAllData": {
        const names = ["suppliers", "transactions", "payments", "bf", "dieselTx", "dieselPayments", "dieselBF", "sites", "materials", "users", "staff", "staffSalary", "staffPayments", "fundTransfers", "siteAllocations", "siteExpenses", "otherPayments", "staffAttendance", "mistri", "mistriDue", "mistriPayments", "mistriAdvances", "labour", "labourEntries", "labourPayments", "labourAdvances", "taskCompletions"];
        const arrs = await Promise.all(names.map(colToArray));
        const out = { success: true };
        names.forEach(function (n, i) { out[n] = arrs[i]; });
        out.auditLog = []; // fetched separately via getAuditLog only when the Settings/Audit tab is opened
        out.maintenance = await getMaintenanceStatus();
        return out;
      }
      case "getUsers": return { success: true, data: await colToArray("users") };
      case "getAuditLog": { const s = await db.collection("auditLog").orderBy("Timestamp", "desc").get(); return { success: true, data: s.docs.map(function (d) { return d.data(); }) }; }
      case "updateUserContact": {
        const users = await colToArray("users");
        const u = users.find(function (x) { return x.Name === p.Name; });
        if (!u) return { success: false, message: "User not found." };
        await db.collection("users").doc(u.UserID).set({ ContactNumber: p.ContactNumber }, { merge: true });
        await auditLog(p.CreatedBy, "Updated User Contact", "Users", p.Name, p.ContactNumber);
        return { success: true, message: "Contact number updated successfully." };
      }

      case "getSuppliers": return { success: true, data: await colToArray("suppliers") };
      case "addSupplier": { const r = await genericAdd("Supplier", { SupplierName: p.SupplierName, ContactPerson: p.ContactPerson, ContactNumber: p.ContactNumber, MaterialType: p.MaterialType }); await auditLog(p.CreatedBy, "Added Supplier", "Suppliers", r.id, p.SupplierName); return { success: true, message: "Supplier saved successfully." }; }
      case "updateSupplier": { const ok = await genericUpdate("Supplier", p, { SupplierName: p.SupplierName, ContactPerson: p.ContactPerson, ContactNumber: p.ContactNumber, MaterialType: p.MaterialType }); if (!ok) return { success: false, message: "Supplier not found." }; await auditLog(p.CreatedBy, "Updated Supplier", "Suppliers", p.SupplierID, p.SupplierName); return { success: true, message: "Supplier updated successfully." }; }
      case "deleteSupplier": await genericDelete("Supplier", p.SupplierID); await auditLog(p.CreatedBy, "Deleted Supplier", "Suppliers", p.SupplierID, p.SupplierName || ""); return { success: true, message: "Supplier deleted successfully." };

      case "getTransactions": return { success: true, data: await colToArray("transactions") };
      case "addTransaction": { const fare = Number(p.Fare) || 0; const value = Number(p.Quantity) * Number(p.Rate) + Number(p.Quantity) * fare; const r = await genericAdd("Transaction", { Date: p.Date, Time: p.Time || "", Supplier: p.Supplier, VehicleNumber: p.VehicleNumber, Material: p.Material, Quantity: p.Quantity, Unit: p.Unit, Rate: p.Rate, Fare: fare, Value: value, Site: p.Site, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Supplier Transaction", "SupplierTransactions", r.id, p.Supplier + " ₹" + value); return { success: true, message: "Transaction saved successfully.", data: { Value: value } }; }
      case "updateTransaction": { const fare = Number(p.Fare) || 0; const value = Number(p.Quantity) * Number(p.Rate) + Number(p.Quantity) * fare; const ok = await genericUpdate("Transaction", { SLNo: p.SLNo }, { Date: p.Date, Time: p.Time || "", Supplier: p.Supplier, VehicleNumber: p.VehicleNumber, Material: p.Material, Quantity: p.Quantity, Unit: p.Unit, Rate: p.Rate, Fare: fare, Value: value, Site: p.Site, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Transaction not found." }; await auditLog(p.CreatedBy, "Updated Supplier Transaction", "SupplierTransactions", p.SLNo, p.Supplier + " ₹" + value); return { success: true, message: "Transaction updated successfully." }; }
      case "deleteTransaction": await genericDelete("Transaction", p.SLNo); await auditLog(p.CreatedBy, "Deleted Transaction", "SupplierTransactions", p.SLNo, ""); return { success: true, message: "Transaction deleted successfully." };

      case "getPayments": return { success: true, data: await colToArray("payments") };
      case "addPayment": { const r = await genericAdd("Payment", { Date: p.Date, Supplier: p.Supplier, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber || "", Site: p.Site, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Supplier Payment", "SupplierPayments", r.id, p.Supplier + " ₹" + p.AmountPaid); return { success: true, message: "Payment saved successfully." }; }
      case "updatePayment": { const ok = await genericUpdate("Payment", p, { Date: p.Date, Supplier: p.Supplier, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber, Site: p.Site, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Payment not found." }; await auditLog(p.CreatedBy, "Updated Supplier Payment", "SupplierPayments", p.PaymentID, p.Supplier + " ₹" + p.AmountPaid); return { success: true, message: "Payment updated successfully." }; }
      case "deletePayment": await genericDelete("Payment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Payment", "SupplierPayments", p.PaymentID, ""); return { success: true, message: "Payment deleted successfully." };

      case "getBF": return { success: true, data: await colToArray("bf") };
      case "addBF": { const id = (await nextId("BF", "BF")); const rec = { Supplier: p.Supplier, BFMonth: p.BFMonth, BFDate: p.BFDate, BFAmount: p.BFAmount, Site: p.Site, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "", CreatedAt: new Date().toISOString() }; await db.collection("bf").doc(id).set(rec); await auditLog(p.CreatedBy, "Updated Supplier BF", "SupplierBF", p.Supplier, "₹" + p.BFAmount); return { success: true, message: "BF balance saved successfully." }; }
      case "updateBF": { const arr = await colToArray("bf"); const rec = arr.find(function (x) { return x.Supplier === p.OrigSupplier && x.BFMonth === p.OrigBFMonth && x.BFDate === p.OrigBFDate; }); if (!rec) return { success: false, message: "BF entry not found." }; const snap = await db.collection("bf").where("Supplier", "==", p.OrigSupplier).where("BFMonth", "==", p.OrigBFMonth).where("BFDate", "==", p.OrigBFDate).get(); if (snap.empty) return { success: false, message: "BF entry not found." }; await snap.docs[0].ref.set({ Supplier: p.Supplier, BFMonth: p.BFMonth, BFDate: p.BFDate, BFAmount: p.BFAmount, Site: p.Site, Remarks: p.Remarks }, { merge: true }); await auditLog(p.CreatedBy, "Updated Supplier BF", "SupplierBF", p.Supplier, "₹" + p.BFAmount); return { success: true, message: "BF balance updated successfully." }; }
      case "deleteBF": { const snap = await db.collection("bf").where("Supplier", "==", p.Supplier).where("BFMonth", "==", p.BFMonth).where("BFDate", "==", p.BFDate).get(); if (snap.empty) return { success: false, message: "BF entry not found." }; await snap.docs[0].ref.delete(); await auditLog(p.CreatedBy, "Deleted BF Entry", "SupplierBF", p.Supplier, ""); return { success: true, message: "BF entry deleted successfully." }; }

      case "getDieselTransactions": return { success: true, data: await colToArray("dieselTx") };
      case "addDieselTransaction": { const value = Number(p.DieselQuantity) * Number(p.Rate); const r = await genericAdd("DieselTransaction", { Date: p.Date, ChalanNumber: p.ChalanNumber || "", Time: p.Time || "", Supplier: p.Supplier, VehicleNumber: p.VehicleNumber, DieselQuantity: p.DieselQuantity, Unit: p.Unit || "Litres", Rate: p.Rate, Value: value, Site: p.Site, Driver: p.Driver || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Diesel Transaction", "DieselTransactions", r.id, p.Supplier + " ₹" + value); return { success: true, message: "Diesel transaction saved successfully.", data: { Value: value } }; }
      case "updateDieselTransaction": { const value = Number(p.DieselQuantity) * Number(p.Rate); const ok = await genericUpdate("DieselTransaction", { SLNo: p.SLNo }, { Date: p.Date, ChalanNumber: p.ChalanNumber || "", Time: p.Time || "", Supplier: p.Supplier, VehicleNumber: p.VehicleNumber, DieselQuantity: p.DieselQuantity, Rate: p.Rate, Value: value, Site: p.Site, Driver: p.Driver, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Diesel transaction not found." }; await auditLog(p.CreatedBy, "Updated Diesel Transaction", "DieselTransactions", p.SLNo, p.Supplier + " ₹" + value); return { success: true, message: "Diesel transaction updated successfully." }; }
      case "deleteDieselTransaction": await genericDelete("DieselTransaction", p.SLNo); await auditLog(p.CreatedBy, "Deleted Diesel Transaction", "DieselTransactions", p.SLNo, ""); return { success: true, message: "Diesel transaction deleted successfully." };

      case "getDieselPayments": return { success: true, data: await colToArray("dieselPayments") };
      case "addDieselPayment": { const r = await genericAdd("DieselPayment", { Date: p.Date, Supplier: p.Supplier, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber || "", Site: p.Site, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Diesel Payment", "DieselPayments", r.id, p.Supplier + " ₹" + p.AmountPaid); return { success: true, message: "Diesel payment saved successfully." }; }
      case "updateDieselPayment": { const ok = await genericUpdate("DieselPayment", p, { Date: p.Date, Supplier: p.Supplier, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber, Site: p.Site, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Diesel payment not found." }; await auditLog(p.CreatedBy, "Updated Diesel Payment", "DieselPayments", p.PaymentID, p.Supplier + " ₹" + p.AmountPaid); return { success: true, message: "Diesel payment updated successfully." }; }
      case "deleteDieselPayment": await genericDelete("DieselPayment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Diesel Payment", "DieselPayments", p.PaymentID, ""); return { success: true, message: "Diesel payment deleted successfully." };

      case "getDieselBF": return { success: true, data: await colToArray("dieselBF") };
      case "addDieselBF": { const id = (await nextId("DieselBF", "DBF")); const rec = { Supplier: p.Supplier, BFMonth: p.BFMonth, BFDate: p.BFDate, BFAmount: p.BFAmount, Site: p.Site, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "", CreatedAt: new Date().toISOString() }; await db.collection("dieselBF").doc(id).set(rec); await auditLog(p.CreatedBy, "Updated Diesel BF", "DieselBF", p.Supplier, "₹" + p.BFAmount); return { success: true, message: "Diesel BF saved successfully." }; }
      case "updateDieselBF": { const snap = await db.collection("dieselBF").where("Supplier", "==", p.OrigSupplier).where("BFMonth", "==", p.OrigBFMonth).where("BFDate", "==", p.OrigBFDate).get(); if (snap.empty) return { success: false, message: "Diesel BF entry not found." }; await snap.docs[0].ref.set({ Supplier: p.Supplier, BFMonth: p.BFMonth, BFDate: p.BFDate, BFAmount: p.BFAmount, Site: p.Site, Remarks: p.Remarks }, { merge: true }); await auditLog(p.CreatedBy, "Updated Diesel BF", "DieselBF", p.Supplier, "₹" + p.BFAmount); return { success: true, message: "Diesel BF updated successfully." }; }
      case "deleteDieselBF": { const snap = await db.collection("dieselBF").where("Supplier", "==", p.Supplier).where("BFMonth", "==", p.BFMonth).where("BFDate", "==", p.BFDate).get(); if (snap.empty) return { success: false, message: "Diesel BF entry not found." }; await snap.docs[0].ref.delete(); await auditLog(p.CreatedBy, "Deleted Diesel BF Entry", "DieselBF", p.Supplier, ""); return { success: true, message: "Diesel BF entry deleted successfully." }; }

      case "getSites": return { success: true, data: await colToArray("sites") };
      case "addSite": { const r = await genericAdd("Site", { SiteName: p.SiteName }); await auditLog(p.CreatedBy, "Added Site", "Sites", r.id, p.SiteName); return { success: true, message: "Site saved successfully." }; }
      case "updateSite": { const ok = await genericUpdate("Site", p, { SiteName: p.SiteName }); if (!ok) return { success: false, message: "Site not found." }; await auditLog(p.CreatedBy, "Updated Site", "Sites", p.SiteID, p.SiteName); return { success: true, message: "Site updated successfully." }; }
      case "deleteSite": await genericDelete("Site", p.SiteID); await auditLog(p.CreatedBy, "Deleted Site", "Sites", p.SiteID, ""); return { success: true, message: "Site deleted successfully." };

      case "getMaterials": return { success: true, data: await colToArray("materials") };
      case "addMaterial": { const r = await genericAdd("Material", { MaterialName: p.MaterialName, DefaultUnit: p.DefaultUnit }); await auditLog(p.CreatedBy, "Added Material", "Materials", r.id, p.MaterialName); return { success: true, message: "Material saved successfully." }; }
      case "updateMaterial": { const ok = await genericUpdate("Material", p, { MaterialName: p.MaterialName, DefaultUnit: p.DefaultUnit }); if (!ok) return { success: false, message: "Material not found." }; await auditLog(p.CreatedBy, "Updated Material", "Materials", p.MaterialID, p.MaterialName); return { success: true, message: "Material updated successfully." }; }
      case "deleteMaterial": await genericDelete("Material", p.MaterialID); await auditLog(p.CreatedBy, "Deleted Material", "Materials", p.MaterialID, ""); return { success: true, message: "Material deleted successfully." };

      case "getStaff": return { success: true, data: await colToArray("staff") };
      case "addStaff": { const r = await genericAdd("Staff", { Name: p.Name, Role: p.Role, ContactNumber: p.ContactNumber, SalaryBasis: p.SalaryBasis, MonthlyAmount: p.MonthlyAmount || 0, DailyRate: p.DailyRate || 0, BFAmount: p.BFAmount || 0 }); await auditLog(p.CreatedBy, "Added Staff", "Staff", r.id, p.Name); return { success: true, message: "Staff saved successfully." }; }
      case "updateStaff": { const ok = await genericUpdate("Staff", p, { Name: p.Name, Role: p.Role, ContactNumber: p.ContactNumber, SalaryBasis: p.SalaryBasis, MonthlyAmount: p.MonthlyAmount || 0, DailyRate: p.DailyRate || 0, BFAmount: p.BFAmount || 0 }); if (!ok) return { success: false, message: "Staff not found." }; await auditLog(p.CreatedBy, "Updated Staff", "Staff", p.StaffID, p.Name); return { success: true, message: "Staff updated successfully." }; }
      case "deleteStaff": await genericDelete("Staff", p.StaffID); await auditLog(p.CreatedBy, "Deleted Staff", "Staff", p.StaffID, p.Name || ""); return { success: true, message: "Staff deleted successfully." };

      case "getStaffSalary": return { success: true, data: await colToArray("staffSalary") };
      case "addStaffSalary": { const net = (Number(p.Basic) || 0) + (Number(p.DA) || 0) - (Number(p.Deductions) || 0); const r = await genericAdd("StaffSalary", { Month: p.Month, StaffName: p.StaffName, Basic: p.Basic || 0, DA: p.DA || 0, Deductions: p.Deductions || 0, BFDue: 0, DaysWorked: p.DaysWorked || "", NetSalary: net, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Salary Slip", "StaffSalary", r.id, p.StaffName + " ₹" + net); return { success: true, message: "Salary slip saved successfully.", data: { NetSalary: net } }; }
      case "updateStaffSalary": { const net = (Number(p.Basic) || 0) + (Number(p.DA) || 0) - (Number(p.Deductions) || 0); const ok = await genericUpdate("StaffSalary", p, { Month: p.Month, StaffName: p.StaffName, Basic: p.Basic || 0, DA: p.DA || 0, Deductions: p.Deductions || 0, BFDue: 0, DaysWorked: p.DaysWorked || "", NetSalary: net, Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Salary slip not found." }; await auditLog(p.CreatedBy, "Updated Salary Slip", "StaffSalary", p.SalaryID, p.StaffName + " ₹" + net); return { success: true, message: "Salary slip updated successfully." }; }
      case "deleteStaffSalary": await genericDelete("StaffSalary", p.SalaryID); await auditLog(p.CreatedBy, "Deleted Staff Salary", "StaffSalary", p.SalaryID, ""); return { success: true, message: "Salary slip deleted successfully." };

      case "getStaffPayments": return { success: true, data: await colToArray("staffPayments") };
      case "addStaffPayment": { const r = await genericAdd("StaffPayment", { Date: p.Date, StaffName: p.StaffName, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Staff Payment", "StaffPayments", r.id, p.StaffName + " ₹" + p.AmountPaid); return { success: true, message: "Staff payment saved successfully." }; }
      case "updateStaffPayment": { const ok = await genericUpdate("StaffPayment", p, { Date: p.Date, StaffName: p.StaffName, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Staff payment not found." }; await auditLog(p.CreatedBy, "Updated Staff Payment", "StaffPayments", p.PaymentID, p.StaffName + " ₹" + p.AmountPaid); return { success: true, message: "Staff payment updated successfully." }; }
      case "deleteStaffPayment": await genericDelete("StaffPayment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Staff Payment", "StaffPayments", p.PaymentID, ""); return { success: true, message: "Staff payment deleted successfully." };

      case "getStaffAttendance": return { success: true, data: await colToArray("staffAttendance") };
      case "addStaffAttendance": { const arr = await colToArray("staffAttendance"); const ex = arr.find(function (x) { return x.Date === p.Date && x.StaffName === p.StaffName; }); if (ex) { await db.collection("staffAttendance").doc(ex.AttendanceID).set({ Status: p.Status }, { merge: true }); await auditLog(p.CreatedBy, "Updated Attendance", "StaffAttendance", ex.AttendanceID, p.StaffName + " " + p.Date + " " + p.Status); return { success: true, message: "Attendance updated successfully." }; } const r = await genericAdd("StaffAttendance", { Date: p.Date, StaffName: p.StaffName, Status: p.Status, MarkedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Marked Attendance", "StaffAttendance", r.id, p.StaffName + " " + p.Date + " " + p.Status); return { success: true, message: "Attendance marked successfully." }; }
      case "updateStaffAttendance": { const ok = await genericUpdate("StaffAttendance", p, { Date: p.Date, StaffName: p.StaffName, Status: p.Status }); if (!ok) return { success: false, message: "Attendance record not found." }; await auditLog(p.CreatedBy, "Updated Attendance", "StaffAttendance", p.AttendanceID, p.StaffName + " " + p.Date + " " + p.Status); return { success: true, message: "Attendance updated successfully." }; }

      case "getMistri": return { success: true, data: await colToArray("mistri") };
      case "addMistri": { const r = await genericAdd("Mistri", { Name: p.Name, ContactNumber: p.ContactNumber || "", DailyRate: p.DailyRate || 0, BFAmount: p.BFAmount || 0 }); await auditLog(p.CreatedBy, "Added Mistri", "Mistri", r.id, p.Name); return { success: true, message: "Mistri saved successfully." }; }
      case "updateMistri": { const ok = await genericUpdate("Mistri", p, { Name: p.Name, ContactNumber: p.ContactNumber || "", DailyRate: p.DailyRate || 0, BFAmount: p.BFAmount || 0 }); if (!ok) return { success: false, message: "Mistri not found." }; await auditLog(p.CreatedBy, "Updated Mistri", "Mistri", p.MistriID, p.Name); return { success: true, message: "Mistri updated successfully." }; }
      case "deleteMistri": await genericDelete("Mistri", p.MistriID); await auditLog(p.CreatedBy, "Deleted Mistri", "Mistri", p.MistriID, ""); return { success: true, message: "Mistri deleted successfully." };

      case "getMistriDue": return { success: true, data: await colToArray("mistriDue") };
      case "addMistriDue": { const net = (Number(p.Basic) || 0) + (Number(p.DA) || 0) - (Number(p.Deductions) || 0); const r = await genericAdd("MistriDue", { Month: p.Month, MistriName: p.MistriName, Site: p.Site, Basic: p.Basic || 0, DA: p.DA || 0, Deductions: p.Deductions || 0, NetDue: net, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Mistri Due", "MistriDue", r.id, p.MistriName + " @ " + p.Site + " ₹" + net); return { success: true, message: "Mistri due saved successfully.", data: { NetDue: net } }; }
      case "updateMistriDue": { const net = (Number(p.Basic) || 0) + (Number(p.DA) || 0) - (Number(p.Deductions) || 0); const ok = await genericUpdate("MistriDue", p, { Month: p.Month, MistriName: p.MistriName, Site: p.Site, Basic: p.Basic || 0, DA: p.DA || 0, Deductions: p.Deductions || 0, NetDue: net, Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Mistri due not found." }; await auditLog(p.CreatedBy, "Updated Mistri Due", "MistriDue", p.DueID, p.MistriName + " @ " + p.Site + " ₹" + net); return { success: true, message: "Mistri due updated successfully." }; }
      case "deleteMistriDue": await genericDelete("MistriDue", p.DueID); await auditLog(p.CreatedBy, "Deleted Mistri Due", "MistriDue", p.DueID, ""); return { success: true, message: "Mistri due deleted successfully." };

      case "getMistriPayments": return { success: true, data: await colToArray("mistriPayments") };
      case "addMistriPayment": { const r = await genericAdd("MistriPayment", { Date: p.Date, MistriName: p.MistriName, Site: p.Site, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod || "", ReferenceNumber: p.ReferenceNumber || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Mistri Payment", "MistriPayments", r.id, p.MistriName + " @ " + p.Site + " ₹" + p.AmountPaid); return { success: true, message: "Mistri payment saved successfully." }; }
      case "updateMistriPayment": { const ok = await genericUpdate("MistriPayment", p, { Date: p.Date, MistriName: p.MistriName, Site: p.Site, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Mistri payment not found." }; await auditLog(p.CreatedBy, "Updated Mistri Payment", "MistriPayments", p.PaymentID, p.MistriName + " @ " + p.Site + " ₹" + p.AmountPaid); return { success: true, message: "Mistri payment updated successfully." }; }
      case "deleteMistriPayment": await genericDelete("MistriPayment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Mistri Payment", "MistriPayments", p.PaymentID, ""); return { success: true, message: "Mistri payment deleted successfully." };

      case "getMistriAdvances": return { success: true, data: await colToArray("mistriAdvances") };
      case "addMistriAdvance": { const r = await genericAdd("MistriAdvance", { Date: p.Date, From: p.From || "", MistriName: p.MistriName, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Mistri Advance", "MistriAdvances", r.id, p.MistriName + " @ " + p.Site + " ₹" + p.Amount); return { success: true, message: "Advance sent successfully." }; }
      case "updateMistriAdvance": { const ok = await genericUpdate("MistriAdvance", p, { Date: p.Date, From: p.From, MistriName: p.MistriName, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Advance not found." }; await auditLog(p.CreatedBy, "Updated Mistri Advance", "MistriAdvances", p.AdvanceID, p.MistriName + " @ " + p.Site + " ₹" + p.Amount); return { success: true, message: "Advance updated successfully." }; }
      case "deleteMistriAdvance": await genericDelete("MistriAdvance", p.AdvanceID); await auditLog(p.CreatedBy, "Deleted Mistri Advance", "MistriAdvances", p.AdvanceID, ""); return { success: true, message: "Advance deleted successfully." };

      case "getLabour": return { success: true, data: await colToArray("labour") };
      case "addLabour": { const r = await genericAdd("Labour", { Name: p.Name, ContactNumber: p.ContactNumber || "", DefaultSite: p.DefaultSite || "", BFAmount: p.BFAmount || 0 }); await auditLog(p.CreatedBy, "Added Labour", "Labour", r.id, p.Name); return { success: true, message: "Labour saved successfully." }; }
      case "updateLabour": { const ok = await genericUpdate("Labour", p, { Name: p.Name, ContactNumber: p.ContactNumber || "", DefaultSite: p.DefaultSite || "", BFAmount: p.BFAmount || 0 }); if (!ok) return { success: false, message: "Labour not found." }; await auditLog(p.CreatedBy, "Updated Labour", "Labour", p.LabourID, p.Name); return { success: true, message: "Labour updated successfully." }; }
      case "deleteLabour": await genericDelete("Labour", p.LabourID); await auditLog(p.CreatedBy, "Deleted Labour", "Labour", p.LabourID, ""); return { success: true, message: "Labour deleted successfully." };

      case "getLabourEntries": return { success: true, data: await colToArray("labourEntries") };
      case "addLabourEntry": { const net = computeLabourNet(p); const r = await genericAdd("LabourEntry", { Date: p.Date, Month: p.Month, LabourName: p.LabourName, Site: p.Site, Type: p.Type, DailyPrice: p.DailyPrice || 0, HowManyLabour: p.HowManyLabour || 0, WorkMeter: p.WorkMeter || 0, Price: p.Price || 0, AdditionalAmount: p.AdditionalAmount || 0, Fare: p.Fare || 0, NetAmount: net, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Labour Entry", "LabourEntries", r.id, p.LabourName + " @ " + p.Site + " ₹" + net); return { success: true, message: "Labour entry saved successfully.", data: { NetAmount: net } }; }
      case "updateLabourEntry": { const net = computeLabourNet(p); const ok = await genericUpdate("LabourEntry", p, { Date: p.Date, Month: p.Month, LabourName: p.LabourName, Site: p.Site, Type: p.Type, DailyPrice: p.DailyPrice || 0, HowManyLabour: p.HowManyLabour || 0, WorkMeter: p.WorkMeter || 0, Price: p.Price || 0, AdditionalAmount: p.AdditionalAmount || 0, Fare: p.Fare || 0, NetAmount: net, Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Labour entry not found." }; await auditLog(p.CreatedBy, "Updated Labour Entry", "LabourEntries", p.EntryID, p.LabourName + " @ " + p.Site + " ₹" + net); return { success: true, message: "Labour entry updated successfully.", data: { NetAmount: net } }; }
      case "deleteLabourEntry": await genericDelete("LabourEntry", p.EntryID); await auditLog(p.CreatedBy, "Deleted Labour Entry", "LabourEntries", p.EntryID, ""); return { success: true, message: "Labour entry deleted successfully." };

      case "getLabourPayments": return { success: true, data: await colToArray("labourPayments") };
      case "addLabourPayment": { const r = await genericAdd("LabourPayment", { Date: p.Date, LabourName: p.LabourName, Site: p.Site, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod || "", ReferenceNumber: p.ReferenceNumber || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Labour Payment", "LabourPayments", r.id, p.LabourName + " @ " + p.Site + " ₹" + p.AmountPaid); return { success: true, message: "Labour payment saved successfully." }; }
      case "updateLabourPayment": { const ok = await genericUpdate("LabourPayment", p, { Date: p.Date, LabourName: p.LabourName, Site: p.Site, AmountPaid: p.AmountPaid, PaymentMethod: p.PaymentMethod, ReferenceNumber: p.ReferenceNumber, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Labour payment not found." }; await auditLog(p.CreatedBy, "Updated Labour Payment", "LabourPayments", p.PaymentID, p.LabourName + " @ " + p.Site + " ₹" + p.AmountPaid); return { success: true, message: "Labour payment updated successfully." }; }
      case "deleteLabourPayment": await genericDelete("LabourPayment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Labour Payment", "LabourPayments", p.PaymentID, ""); return { success: true, message: "Labour payment deleted successfully." };

      case "getLabourAdvances": return { success: true, data: await colToArray("labourAdvances") };
      case "addLabourAdvance": { const r = await genericAdd("LabourAdvance", { Date: p.Date, From: p.From || "", LabourName: p.LabourName, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Labour Advance", "LabourAdvances", r.id, p.LabourName + " @ " + p.Site + " ₹" + p.Amount); return { success: true, message: "Advance sent successfully." }; }
      case "updateLabourAdvance": { const ok = await genericUpdate("LabourAdvance", p, { Date: p.Date, From: p.From, LabourName: p.LabourName, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Advance not found." }; await auditLog(p.CreatedBy, "Updated Labour Advance", "LabourAdvances", p.AdvanceID, p.LabourName + " @ " + p.Site + " ₹" + p.Amount); return { success: true, message: "Advance updated successfully." }; }
      case "deleteLabourAdvance": await genericDelete("LabourAdvance", p.AdvanceID); await auditLog(p.CreatedBy, "Deleted Labour Advance", "LabourAdvances", p.AdvanceID, ""); return { success: true, message: "Advance deleted successfully." };

      case "getFundTransfers": return { success: true, data: await colToArray("fundTransfers") };
      case "addFundTransfer": { const r = await genericAdd("FundTransfer", { Date: p.Date, From: p.From, To: p.To, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Fund Transfer", "FundTransfers", r.id, p.From + " -> " + p.To + " Rs." + p.Amount); return { success: true, message: "Fund transfer saved successfully." }; }
      case "updateFundTransfer": { const ok = await genericUpdate("FundTransfer", p, { Date: p.Date, From: p.From, To: p.To, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "", Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Fund transfer not found." }; await auditLog(p.CreatedBy, "Updated Fund Transfer", "FundTransfers", p.TransferID, p.From + " -> " + p.To + " Rs." + p.Amount); return { success: true, message: "Fund transfer updated successfully." }; }
      case "deleteFundTransfer": await genericDelete("FundTransfer", p.TransferID); await auditLog(p.CreatedBy, "Deleted Fund Transfer", "FundTransfers", p.TransferID, ""); return { success: true, message: "Fund transfer deleted successfully." };

      case "getSiteAllocations": return { success: true, data: await colToArray("siteAllocations") };
      case "addSiteAllocation": { const r = await genericAdd("SiteAllocation", { Date: p.Date, User: p.User, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "Cash", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Site Allocation", "SiteAllocations", r.id, p.User + " -> " + p.Site + " Rs." + p.Amount); return { success: true, message: "Site allocation saved successfully." }; }
      case "updateSiteAllocation": { const ok = await genericUpdate("SiteAllocation", p, { Date: p.Date, User: p.User, Site: p.Site, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "Cash", Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Site allocation not found." }; await auditLog(p.CreatedBy, "Updated Site Allocation", "SiteAllocations", p.AllocationID, p.User + " -> " + p.Site + " Rs." + p.Amount); return { success: true, message: "Site allocation updated successfully." }; }
      case "deleteSiteAllocation": await genericDelete("SiteAllocation", p.AllocationID); await auditLog(p.CreatedBy, "Deleted Site Allocation", "SiteAllocations", p.AllocationID, ""); return { success: true, message: "Site allocation deleted successfully." };

      case "getSiteExpenses": return { success: true, data: await colToArray("siteExpenses") };
      case "addSiteExpense": { const r = await genericAdd("SiteExpense", { Date: p.Date, Site: p.Site, Amount: p.Amount, Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Site Expense", "SiteExpenses", r.id, p.Site + " Rs." + p.Amount); return { success: true, message: "Site expenditure saved successfully." }; }
      case "updateSiteExpense": { const ok = await genericUpdate("SiteExpense", p, { Date: p.Date, Site: p.Site, Amount: p.Amount, Remarks: p.Remarks || "" }); if (!ok) return { success: false, message: "Site expense not found." }; await auditLog(p.CreatedBy, "Updated Site Expense", "SiteExpenses", p.ExpenseID, p.Site + " Rs." + p.Amount); return { success: true, message: "Site expenditure updated successfully." }; }
      case "deleteSiteExpense": await genericDelete("SiteExpense", p.ExpenseID); await auditLog(p.CreatedBy, "Deleted Site Expense", "SiteExpenses", p.ExpenseID, ""); return { success: true, message: "Site expenditure deleted successfully." };

      case "getOtherPayments": return { success: true, data: await colToArray("otherPayments") };
      case "addOtherPayment": { const r = await genericAdd("OtherPayment", { Date: p.Date, From: p.From, Name: p.Name, Purpose: p.Purpose, Amount: p.Amount, PaymentMethod: p.PaymentMethod || "Cash", Remarks: p.Remarks || "", CreatedBy: p.CreatedBy || "" }); await auditLog(p.CreatedBy, "Added Other Payment", "OtherPayments", r.id, p.Name + " ₹" + p.Amount); return { success: true, message: "Payment saved successfully." }; }
      case "updateOtherPayment": { const ok = await genericUpdate("OtherPayment", p, { Date: p.Date, From: p.From, Name: p.Name, Purpose: p.Purpose, Amount: p.Amount, PaymentMethod: p.PaymentMethod, Remarks: p.Remarks }); if (!ok) return { success: false, message: "Payment not found." }; await auditLog(p.CreatedBy, "Updated Other Payment", "OtherPayments", p.PaymentID, p.Name + " ₹" + p.Amount); return { success: true, message: "Payment updated successfully." }; }
      case "deleteOtherPayment": await genericDelete("OtherPayment", p.PaymentID); await auditLog(p.CreatedBy, "Deleted Other Payment", "OtherPayments", p.PaymentID, ""); return { success: true, message: "Payment deleted successfully." };

      case "getTaskCompletions": return { success: true, data: await colToArray("taskCompletions") };
      case "addTaskCompletion": { const arr = await colToArray("taskCompletions"); const exists = arr.some(function (x) { return x.Date === p.Date && x.User === p.User; }); if (exists) return { success: true, message: "Already marked completed." }; const id = p.Date + "_" + p.User; await db.collection("taskCompletions").doc(id).set({ Date: p.Date, User: p.User, CreatedAt: new Date().toISOString() }); await auditLog(p.User, "Marked Task Completed", "TaskCompletions", p.Date, p.User); return { success: true, message: "Task marked completed." }; }

      case "getBilling": {
        const invSnap = await db.collection("billing").doc("invoice").get();
        const mSnap = await db.collection("billing").doc("maintenance").get();
        const inv = invSnap.exists ? invSnap.data() : { amount: 478, status: "Pending" };
        const maint = mSnap.exists ? mSnap.data() : { amount: 125, firstDueYear: 2027, paidYears: [] };
        return { success: true, invoice: inv, maintenance: maint };
      }
      case "markInvoicePaid": {
        if (String(p.RequestedBy || "").toLowerCase() !== "hrushikesh padhi") return { success: false, message: "Only Hrushikesh Padhi can mark this as paid." };
        await db.collection("billing").doc("invoice").set({ amount: 478, status: "Paid", paidAt: new Date().toISOString(), paidBy: p.RequestedBy }, { merge: true });
        await auditLog(p.RequestedBy, "Marked Invoice Paid", "Billing", "invoice", "$478");
        return { success: true, message: "Invoice marked as paid." };
      }
      case "markMaintenancePaid": {
        if (String(p.RequestedBy || "").toLowerCase() !== "hrushikesh padhi") return { success: false, message: "Only Hrushikesh Padhi can mark this as paid." };
        const ref = db.collection("billing").doc("maintenance");
        const snap = await ref.get();
        const data = snap.exists ? snap.data() : { amount: 125, firstDueYear: 2027, paidYears: [] };
        const years = data.paidYears || [];
        if (years.indexOf(p.CycleYear) === -1) years.push(p.CycleYear);
        await ref.set({ amount: 125, firstDueYear: data.firstDueYear || 2027, paidYears: years, lastPaidAt: new Date().toISOString(), lastPaidBy: p.RequestedBy }, { merge: true });
        await auditLog(p.RequestedBy, "Marked Maintenance Paid", "Billing", "maintenance", "$125 for " + p.CycleYear);
        return { success: true, message: "Maintenance fee marked as paid for " + p.CycleYear + "." };
      }

      case "migrateFromSheets": return migrateFromSheets(p);
      default: return { success: false, message: "Unknown action: " + action };
    }
  }

  // ---------- one-time migration from the old Google Sheets backend ----------
  async function migrateFromSheets() {
    if (!window.OLD_GAS_URL) return { success: false, message: "No old Apps Script URL configured." };
    let res;
    try {
      const r = await fetch(window.OLD_GAS_URL + "?action=getAllData");
      res = await r.json();
    } catch (e) { return { success: false, message: "Could not reach old Google Sheets backend: " + e.message }; }
    if (!res || !res.success) return { success: false, message: "Old backend returned no data." };

    const idFieldByColl = {
      suppliers: "SupplierID", transactions: "SLNo", payments: "PaymentID", dieselTx: "SLNo", dieselPayments: "PaymentID",
      sites: "SiteID", materials: "MaterialID", users: "UserID", staff: "StaffID", staffSalary: "SalaryID",
      staffPayments: "PaymentID", staffAttendance: "AttendanceID", mistri: "MistriID", mistriDue: "DueID",
      mistriPayments: "PaymentID", mistriAdvances: "AdvanceID", labour: "LabourID", labourEntries: "EntryID",
      labourPayments: "PaymentID", labourAdvances: "AdvanceID", fundTransfers: "TransferID", siteAllocations: "AllocationID",
      siteExpenses: "ExpenseID"
    };
    const collSourceKey = {
      suppliers: "suppliers", transactions: "transactions", payments: "payments", bf: "bf",
      dieselTx: "dieselTx", dieselPayments: "dieselPayments", dieselBF: "dieselBF", sites: "sites",
      materials: "materials", users: "users", staff: "staff", staffSalary: "staffSalary", staffPayments: "staffPayments",
      staffAttendance: "staffAttendance", mistri: "mistri", mistriDue: "mistriDue", mistriPayments: "mistriPayments",
      mistriAdvances: "mistriAdvances", labour: "labour", labourEntries: "labourEntries", labourPayments: "labourPayments",
      labourAdvances: "labourAdvances", fundTransfers: "fundTransfers", siteAllocations: "siteAllocations",
      siteExpenses: "siteExpenses", taskCompletions: "taskCompletions", auditLog: "auditLog"
    };

    // Sync ID counters to the highest migrated numeric suffix so new records never collide
    // with (and silently overwrite) migrated ones.
    const counterByColl = {
      suppliers: ["SupplierID", "SUP"], transactions: ["SLNo", ""], payments: ["PaymentID", "PAY"],
      dieselTx: ["SLNo", ""], dieselPayments: ["PaymentID", "DPAY"], sites: ["SiteID", "S"], materials: ["MaterialID", "M"],
      staff: ["StaffID", "ST"], staffSalary: ["SalaryID", "SAL"], staffPayments: ["PaymentID", "SPAY"],
      staffAttendance: ["AttendanceID", "ATT"], mistri: ["MistriID", "MI"], mistriDue: ["DueID", "MD"],
      mistriPayments: ["PaymentID", "MP"], mistriAdvances: ["AdvanceID", "MA"], labour: ["LabourID", "LB"],
      labourEntries: ["EntryID", "LE"], labourPayments: ["PaymentID", "LP"], labourAdvances: ["AdvanceID", "LA"],
      fundTransfers: ["TransferID", "FT"], siteAllocations: ["AllocationID", "SA"], siteExpenses: ["ExpenseID", "SE"]
    };
    const counterNameByColl = {
      suppliers: "SupplierID", transactions: "SLNo", payments: "PaymentID", dieselTx: "DieselSLNo", dieselPayments: "DieselPaymentID",
      sites: "SiteID", materials: "MaterialID", staff: "StaffID", staffSalary: "SalaryID", staffPayments: "StaffPaymentID",
      staffAttendance: "AttendanceID", mistri: "MistriID", mistriDue: "DueID", mistriPayments: "MistriPaymentID",
      mistriAdvances: "MistriAdvanceID", labour: "LabourID", labourEntries: "EntryID", labourPayments: "LabourPaymentID",
      labourAdvances: "LabourAdvanceID", fundTransfers: "TransferID", siteAllocations: "AllocationID", siteExpenses: "ExpenseID"
    };
    let written = 0;
    for (const coll in collSourceKey) {
      const rows = res[collSourceKey[coll]] || [];
      if (!rows.length) continue;
      const idField = idFieldByColl[coll];
      let batch = db.batch(); let inBatch = 0;
      for (const row of rows) {
        const docId = idField && row[idField] !== undefined && row[idField] !== "" ? String(row[idField]) : db.collection(coll).doc().id;
        batch.set(db.collection(coll).doc(docId), row);
        inBatch++; written++;
        if (inBatch >= 450) { await batch.commit(); batch = db.batch(); inBatch = 0; }
      }
      if (inBatch > 0) await batch.commit();
      if (counterByColl[coll]) {
        const [idField, prefix] = counterByColl[coll];
        let maxN = 0;
        rows.forEach(function (row) {
          const raw = String(row[idField] || "");
          const num = Number(prefix ? raw.replace(prefix, "") : raw);
          if (!isNaN(num) && num > maxN) maxN = num;
        });
        if (maxN > 0) {
          const cname = counterNameByColl[coll];
          await db.collection("meta").doc("counters").set((function () { const o = {}; o[cname] = maxN; return o; })(), { merge: true });
        }
      }
    }
    // seed settings if missing
    const settingsSnap = await db.collection("settings").get();
    if (settingsSnap.empty) {
      await db.collection("settings").doc("LoginPassword").set({ Value: "panda@123" });
      await db.collection("settings").doc("CompanyName").set({ Value: "PANDA CONSTRUCTION" });
      await db.collection("settings").doc("MaintenanceMode").set({ Value: "FALSE" });
      await db.collection("settings").doc("MaintenanceMessage").set({ Value: "" });
    }
    return { success: true, message: "Migration complete — " + written + " records copied into Firestore." };
  }

  function trackUsage(kind, n) {
    try {
      const key = 'panda_usage_' + new Date().toISOString().slice(0, 10);
      const cur = JSON.parse(localStorage.getItem(key) || '{"reads":0,"writes":0,"deletes":0}');
      cur[kind] = (cur[kind] || 0) + n;
      localStorage.setItem(key, JSON.stringify(cur));
    } catch (e) {}
  }
  window.PandaAPI = {
    isDemo: false,
    getUsageEstimate: function () {
      try { return JSON.parse(localStorage.getItem('panda_usage_' + new Date().toISOString().slice(0, 10)) || '{"reads":0,"writes":0,"deletes":0}'); }
      catch (e) { return { reads: 0, writes: 0, deletes: 0 }; }
    },
    call: function (action, payload) {
      return route(action, payload).then(function (res) {
        if (/^get/.test(action)) trackUsage('reads', (res && res.data && res.data.length) || (action === 'getAllData' ? 500 : 1));
        else if (/^add/.test(action)) trackUsage('writes', 2);
        else if (/^update/.test(action)) trackUsage('writes', 1);
        else if (/^delete/.test(action)) trackUsage('deletes', 1);
        return res;
      }).catch(function (e) { console.error("PandaAPI (Firestore): " + action + " failed", e); return { success: false, message: "Database error: " + e.message }; });
    }
  };
})();
