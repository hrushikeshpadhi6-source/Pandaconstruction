// ============================================================
// PANDA CONSTRUCTION — DATA LAYER
// Talks to the Google Apps Script Web App configured in config.js.
// If no URL has been pasted in yet, falls back to a local demo
// dataset (persisted in localStorage) so the app is fully usable
// before deployment. Swap in the real URL and it starts writing
// straight to your Google Sheet with no other code changes.
// ============================================================
(function () {
  const isDemo = !CONFIG.GOOGLE_APPS_SCRIPT_URL || CONFIG.GOOGLE_APPS_SCRIPT_URL.indexOf("PASTE_YOUR") === 0;
  const DEMO_KEY = "panda_demo_db_v1";

  function seed() {
    const users = [
      { UserID: "U1", Name: "Subrat Panda", Role: "Owner", Status: "Active" },
      { UserID: "U2", Name: "Ayaskanta Giri", Role: "Admin 2", Status: "Active" },
      { UserID: "U3", Name: "Hrushikesh Padhi", Role: "Admin 1", Status: "Active" },
      { UserID: "U4", Name: "Sukadev", Role: "Admin 3", Status: "Active" }
    ];
    const sites = [
      { SiteID: "S1", SiteName: "Site A", Status: "Active" },
      { SiteID: "S2", SiteName: "Site B", Status: "Active" },
      { SiteID: "S3", SiteName: "Site C", Status: "Active" },
      { SiteID: "S4", SiteName: "Site D", Status: "Active" }
    ];
    const materials = [
      { MaterialID: "M1", MaterialName: "Cement", DefaultUnit: "NOS", Status: "Active" },
      { MaterialID: "M2", MaterialName: "Sand", DefaultUnit: "TON", Status: "Active" },
      { MaterialID: "M3", MaterialName: "Aggregate", DefaultUnit: "TON", Status: "Active" },
      { MaterialID: "M4", MaterialName: "Steel", DefaultUnit: "KG", Status: "Active" },
      { MaterialID: "M5", MaterialName: "Blocks", DefaultUnit: "NOS", Status: "Active" },
      { MaterialID: "M6", MaterialName: "Concrete", DefaultUnit: "FT", Status: "Active" }
    ];
    const suppliers = [
      { SupplierID: "SUP1", SupplierName: "ABC Materials", ContactPerson: "R. Sahoo", ContactNumber: "9876500001", MaterialType: "Sand, Aggregate", Status: "Active" },
      { SupplierID: "SUP2", SupplierName: "Odisha Cement Traders", ContactPerson: "B. Mishra", ContactNumber: "9876500002", MaterialType: "Cement", Status: "Active" },
      { SupplierID: "SUP3", SupplierName: "Sai Steel Corp", ContactPerson: "P. Nayak", ContactNumber: "9876500003", MaterialType: "Steel", Status: "Active" },
      { SupplierID: "SUP4", SupplierName: "Jagannath Blocks", ContactPerson: "S. Das", ContactNumber: "9876500004", MaterialType: "Blocks", Status: "Active" },
      { SupplierID: "SUP5", SupplierName: "Konark Concrete", ContactPerson: "A. Behera", ContactNumber: "9876500005", MaterialType: "Concrete", Status: "Active" }
    ];
    const tx = [
      { SLNo: 1, Date: "2026-09-02", Supplier: "ABC Materials", VehicleNumber: "OD-05-AB-1234", Material: "Sand", Quantity: 20, Unit: "TON", Rate: 1500, Value: 30000, Site: "Site A", Remarks: "", CreatedBy: "Hrushikesh Padhi", CreatedAt: "2026-09-02T10:15:00" },
      { SLNo: 2, Date: "2026-09-03", Supplier: "Odisha Cement Traders", VehicleNumber: "OD-02-CT-4521", Material: "Cement", Quantity: 200, Unit: "NOS", Rate: 380, Value: 76000, Site: "Site A", Remarks: "", CreatedBy: "Ayaskanta Giri", CreatedAt: "2026-09-03T09:00:00" },
      { SLNo: 3, Date: "2026-09-03", Supplier: "Sai Steel Corp", VehicleNumber: "OD-05-ST-7788", Material: "Steel", Quantity: 2500, Unit: "KG", Rate: 62, Value: 155000, Site: "Site B", Remarks: "TMT bars", CreatedBy: "Sukadev", CreatedAt: "2026-09-03T14:30:00" },
      { SLNo: 4, Date: "2026-09-04", Supplier: "ABC Materials", VehicleNumber: "OD-05-AB-1234", Material: "Aggregate", Quantity: 18, Unit: "TON", Rate: 1200, Value: 21600, Site: "Site A", Remarks: "", CreatedBy: "Hrushikesh Padhi", CreatedAt: "2026-09-04T11:00:00" },
      { SLNo: 5, Date: "2026-09-05", Supplier: "Jagannath Blocks", VehicleNumber: "OD-05-JB-3390", Material: "Blocks", Quantity: 3000, Unit: "NOS", Rate: 12, Value: 36000, Site: "Site C", Remarks: "", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-05T08:45:00" },
      { SLNo: 6, Date: "2026-09-06", Supplier: "Konark Concrete", VehicleNumber: "OD-05-KC-9091", Material: "Concrete", Quantity: 40, Unit: "FT", Rate: 900, Value: 36000, Site: "Site B", Remarks: "M25 grade", CreatedBy: "Ayaskanta Giri", CreatedAt: "2026-09-06T16:00:00" },
      { SLNo: 7, Date: "2026-09-07", Supplier: "ABC Materials", VehicleNumber: "OD-05-AB-5566", Material: "Sand", Quantity: 15, Unit: "TON", Rate: 1550, Value: 23250, Site: "Site D", Remarks: "", CreatedBy: "Hrushikesh Padhi", CreatedAt: "2026-09-07T09:30:00" },
      { SLNo: 8, Date: "2026-09-08", Supplier: "Odisha Cement Traders", VehicleNumber: "OD-02-CT-4521", Material: "Cement", Quantity: 100, Unit: "NOS", Rate: 385, Value: 38500, Site: "Site C", Remarks: "", CreatedBy: "Sukadev", CreatedAt: "2026-09-08T10:00:00" }
    ];
    const payments = [
      { PaymentID: "PAY1", Date: "2026-09-04", Supplier: "ABC Materials", AmountPaid: 40000, PaymentMethod: "Bank Transfer", ReferenceNumber: "TXN88213", Site: "Site A", Remarks: "", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-04T17:00:00" },
      { PaymentID: "PAY2", Date: "2026-09-05", Supplier: "Odisha Cement Traders", AmountPaid: 60000, PaymentMethod: "Cheque", ReferenceNumber: "CHQ0021", Site: "Site A", Remarks: "", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-05T17:00:00" },
      { PaymentID: "PAY3", Date: "2026-09-06", Supplier: "Sai Steel Corp", AmountPaid: 100000, PaymentMethod: "Bank Transfer", ReferenceNumber: "TXN88300", Site: "Site B", Remarks: "", CreatedBy: "Ayaskanta Giri", CreatedAt: "2026-09-06T17:00:00" },
      { PaymentID: "PAY4", Date: "2026-09-07", Supplier: "Jagannath Blocks", AmountPaid: 20000, PaymentMethod: "Cash", ReferenceNumber: "-", Site: "Site C", Remarks: "", CreatedBy: "Hrushikesh Padhi", CreatedAt: "2026-09-07T17:00:00" }
    ];
    const bf = [
      { Supplier: "ABC Materials", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 25000, Site: "Site A", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" },
      { Supplier: "Odisha Cement Traders", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 18000, Site: "Site A", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" },
      { Supplier: "Sai Steel Corp", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 42000, Site: "Site B", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" },
      { Supplier: "Jagannath Blocks", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 5000, Site: "Site C", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" },
      { Supplier: "Konark Concrete", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 0, Site: "Site B", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" }
    ];
    const dieselTx = [
      { SLNo: 1, Date: "2026-09-02", Supplier: "Sri Jagannath Fuel Station", VehicleNumber: "OD-05-EX-1001", DieselQuantity: 200, Unit: "Litres", Rate: 90, Value: 18000, Site: "Site A", Driver: "Ramesh", Remarks: "", CreatedBy: "Hrushikesh Padhi", CreatedAt: "2026-09-02T08:00:00" },
      { SLNo: 2, Date: "2026-09-03", Supplier: "Indian Oil - NH16", VehicleNumber: "OD-05-EX-1002", DieselQuantity: 500, Unit: "Litres", Rate: 90, Value: 45000, Site: "Site B", Driver: "Suresh", Remarks: "Excavator", CreatedBy: "Sukadev", CreatedAt: "2026-09-03T08:00:00" },
      { SLNo: 3, Date: "2026-09-05", Supplier: "Sri Jagannath Fuel Station", VehicleNumber: "OD-05-EX-1003", DieselQuantity: 150, Unit: "Litres", Rate: 91, Value: 13650, Site: "Site C", Driver: "Manoj", Remarks: "", CreatedBy: "Ayaskanta Giri", CreatedAt: "2026-09-05T08:00:00" }
    ];
    const dieselPayments = [
      { PaymentID: "DPAY1", Date: "2026-09-04", Supplier: "Sri Jagannath Fuel Station", AmountPaid: 15000, PaymentMethod: "Bank Transfer", ReferenceNumber: "TXN99120", Site: "Site A", Remarks: "", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-04T18:00:00" }
    ];
    const dieselBF = [
      { Supplier: "Sri Jagannath Fuel Station", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 8000, Site: "Site A", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" },
      { Supplier: "Indian Oil - NH16", BFMonth: "August 2026", BFDate: "2026-08-31", BFAmount: 0, Site: "Site B", Remarks: "Opening balance", CreatedBy: "Subrat Panda", CreatedAt: "2026-09-01T09:00:00" }
    ];
    const auditLog = [
      { Timestamp: "2026-09-08T17:30:00", User: "Hrushikesh Padhi", Action: "Added Supplier Payment", Module: "SupplierPayments", RecordID: "PAY4", Details: "₹20,000 to Jagannath Blocks" }
    ];
    const settings = [{ Setting: "LoginPassword", Value: CONFIG.DEMO_PASSWORD }, { Setting: "CompanyName", Value: CONFIG.COMPANY_NAME }];
    return { users, sites, materials, suppliers, tx, payments, bf, dieselTx, dieselPayments, dieselBF, auditLog, settings };
  }

  function loadDemo() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
    if (!db) { db = seed(); localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
    return db;
  }
  function saveDemo(db) { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
  function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 9).toUpperCase(); }
  function audit(db, user, action, module, recordId, details) {
    db.auditLog.unshift({ Timestamp: new Date().toISOString(), User: user || "", Action: action, Module: module, RecordID: recordId, Details: details });
  }

  async function callRemote(action, payload) {
    const res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight against Apps Script
      body: JSON.stringify({ action, payload: payload || {} })
    });
    return await res.json();
  }

  async function callDemo(action, payload) {
    const db = loadDemo();
    payload = payload || {};
    switch (action) {
      case "login": {
        const u = db.users.find(x => x.Name.toLowerCase() === (payload.name || "").toLowerCase() && x.Status === "Active");
        const pass = (db.settings.find(s => s.Setting === "LoginPassword") || {}).Value || CONFIG.DEMO_PASSWORD;
        if (u && payload.password === pass) return { success: true, user: { name: u.Name, role: u.Role } };
        return { success: false, message: "Invalid name or password." };
      }
      case "getUsers": return { success: true, data: db.users };
      case "getSuppliers": return { success: true, data: db.suppliers };
      case "addSupplier": {
        const rec = Object.assign({ SupplierID: uid("SUP"), Status: "Active" }, payload);
        db.suppliers.push(rec); audit(db, payload.CreatedBy, "Added Supplier", "Suppliers", rec.SupplierID, rec.SupplierName); saveDemo(db);
        return { success: true, message: "Supplier saved successfully.", data: rec };
      }
      case "getTransactions": return { success: true, data: db.tx };
      case "addTransaction": {
        const rec = Object.assign({ SLNo: db.tx.length + 1, CreatedAt: new Date().toISOString() }, payload);
        rec.Value = Number(rec.Quantity) * Number(rec.Rate);
        db.tx.push(rec); audit(db, payload.CreatedBy, "Added Supplier Transaction", "SupplierTransactions", String(rec.SLNo), rec.Supplier + " \u20B9" + rec.Value); saveDemo(db);
        return { success: true, message: "Transaction saved successfully.", data: rec };
      }
      case "getPayments": return { success: true, data: db.payments };
      case "addPayment": {
        const rec = Object.assign({ PaymentID: uid("PAY"), CreatedAt: new Date().toISOString() }, payload);
        db.payments.push(rec); audit(db, payload.CreatedBy, "Added Supplier Payment", "SupplierPayments", rec.PaymentID, rec.Supplier + " \u20B9" + rec.AmountPaid); saveDemo(db);
        return { success: true, message: "Payment saved successfully.", data: rec };
      }
      case "getBF": return { success: true, data: db.bf };
      case "addBF": {
        const rec = Object.assign({ CreatedAt: new Date().toISOString() }, payload);
        db.bf.push(rec); audit(db, payload.CreatedBy, "Updated Supplier BF", "SupplierBF", rec.Supplier, "\u20B9" + rec.BFAmount); saveDemo(db);
        return { success: true, message: "BF balance saved successfully.", data: rec };
      }
      case "getDieselTransactions": return { success: true, data: db.dieselTx };
      case "addDieselTransaction": {
        const rec = Object.assign({ SLNo: db.dieselTx.length + 1, CreatedAt: new Date().toISOString() }, payload);
        rec.Value = Number(rec.DieselQuantity) * Number(rec.Rate);
        db.dieselTx.push(rec); audit(db, payload.CreatedBy, "Added Diesel Transaction", "DieselTransactions", String(rec.SLNo), rec.Supplier + " \u20B9" + rec.Value); saveDemo(db);
        return { success: true, message: "Diesel transaction saved successfully.", data: rec };
      }
      case "getDieselPayments": return { success: true, data: db.dieselPayments };
      case "addDieselPayment": {
        const rec = Object.assign({ PaymentID: uid("DPAY"), CreatedAt: new Date().toISOString() }, payload);
        db.dieselPayments.push(rec); audit(db, payload.CreatedBy, "Added Diesel Payment", "DieselPayments", rec.PaymentID, rec.Supplier + " \u20B9" + rec.AmountPaid); saveDemo(db);
        return { success: true, message: "Diesel payment saved successfully.", data: rec };
      }
      case "getDieselBF": return { success: true, data: db.dieselBF };
      case "addDieselBF": {
        const rec = Object.assign({ CreatedAt: new Date().toISOString() }, payload);
        db.dieselBF.push(rec); audit(db, payload.CreatedBy, "Updated Diesel BF", "DieselBF", rec.Supplier, "\u20B9" + rec.BFAmount); saveDemo(db);
        return { success: true, message: "Diesel BF saved successfully.", data: rec };
      }
      case "getSites": return { success: true, data: db.sites };
      case "addSite": {
        const rec = Object.assign({ SiteID: uid("S"), Status: "Active" }, payload);
        db.sites.push(rec); audit(db, payload.CreatedBy, "Added Site", "Sites", rec.SiteID, rec.SiteName); saveDemo(db);
        return { success: true, message: "Site saved successfully.", data: rec };
      }
      case "getMaterials": return { success: true, data: db.materials };
      case "addMaterial": {
        const rec = Object.assign({ MaterialID: uid("M"), Status: "Active" }, payload);
        db.materials.push(rec); audit(db, payload.CreatedBy, "Added Material", "Materials", rec.MaterialID, rec.MaterialName); saveDemo(db);
        return { success: true, message: "Material saved successfully.", data: rec };
      }
      case "updateSupplier": {
        const rec = db.suppliers.find(x => x.SupplierID === payload.SupplierID);
        if (!rec) return { success: false, message: "Supplier not found." };
        Object.assign(rec, { SupplierName: payload.SupplierName, ContactPerson: payload.ContactPerson, ContactNumber: payload.ContactNumber, MaterialType: payload.MaterialType });
        audit(db, payload.CreatedBy, "Updated Supplier", "Suppliers", rec.SupplierID, rec.SupplierName); saveDemo(db);
        return { success: true, message: "Supplier updated successfully." };
      }
      case "updateSite": {
        const rec = db.sites.find(x => x.SiteID === payload.SiteID);
        if (!rec) return { success: false, message: "Site not found." };
        rec.SiteName = payload.SiteName;
        audit(db, payload.CreatedBy, "Updated Site", "Sites", rec.SiteID, rec.SiteName); saveDemo(db);
        return { success: true, message: "Site updated successfully." };
      }
      case "updateMaterial": {
        const rec = db.materials.find(x => x.MaterialID === payload.MaterialID);
        if (!rec) return { success: false, message: "Material not found." };
        Object.assign(rec, { MaterialName: payload.MaterialName, DefaultUnit: payload.DefaultUnit });
        audit(db, payload.CreatedBy, "Updated Material", "Materials", rec.MaterialID, rec.MaterialName); saveDemo(db);
        return { success: true, message: "Material updated successfully." };
      }
      case "updateTransaction": {
        const rec = db.tx.find(x => String(x.SLNo) === String(payload.SLNo));
        if (!rec) return { success: false, message: "Transaction not found." };
        Object.assign(rec, { Date: payload.Date, Supplier: payload.Supplier, VehicleNumber: payload.VehicleNumber, Material: payload.Material, Quantity: payload.Quantity, Unit: payload.Unit, Rate: payload.Rate, Site: payload.Site, Remarks: payload.Remarks });
        rec.Value = Number(rec.Quantity) * Number(rec.Rate);
        audit(db, payload.CreatedBy, "Updated Supplier Transaction", "SupplierTransactions", String(rec.SLNo), rec.Supplier + " \u20B9" + rec.Value); saveDemo(db);
        return { success: true, message: "Transaction updated successfully." };
      }
      case "updatePayment": {
        const rec = db.payments.find(x => x.PaymentID === payload.PaymentID);
        if (!rec) return { success: false, message: "Payment not found." };
        Object.assign(rec, { Date: payload.Date, Supplier: payload.Supplier, AmountPaid: payload.AmountPaid, PaymentMethod: payload.PaymentMethod, ReferenceNumber: payload.ReferenceNumber, Site: payload.Site, Remarks: payload.Remarks });
        audit(db, payload.CreatedBy, "Updated Supplier Payment", "SupplierPayments", rec.PaymentID, rec.Supplier + " \u20B9" + rec.AmountPaid); saveDemo(db);
        return { success: true, message: "Payment updated successfully." };
      }
      case "updateBF": {
        const rec = db.bf.find(x => x.Supplier === payload.OrigSupplier && x.BFMonth === payload.OrigBFMonth && x.BFDate === payload.OrigBFDate);
        if (!rec) return { success: false, message: "BF entry not found." };
        Object.assign(rec, { Supplier: payload.Supplier, BFMonth: payload.BFMonth, BFDate: payload.BFDate, BFAmount: payload.BFAmount, Site: payload.Site, Remarks: payload.Remarks });
        audit(db, payload.CreatedBy, "Updated Supplier BF", "SupplierBF", rec.Supplier, "\u20B9" + rec.BFAmount); saveDemo(db);
        return { success: true, message: "BF balance updated successfully." };
      }
      case "updateDieselTransaction": {
        const rec = db.dieselTx.find(x => String(x.SLNo) === String(payload.SLNo));
        if (!rec) return { success: false, message: "Diesel transaction not found." };
        Object.assign(rec, { Date: payload.Date, Supplier: payload.Supplier, VehicleNumber: payload.VehicleNumber, DieselQuantity: payload.DieselQuantity, Rate: payload.Rate, Site: payload.Site, Driver: payload.Driver, Remarks: payload.Remarks });
        rec.Value = Number(rec.DieselQuantity) * Number(rec.Rate);
        audit(db, payload.CreatedBy, "Updated Diesel Transaction", "DieselTransactions", String(rec.SLNo), rec.Supplier + " \u20B9" + rec.Value); saveDemo(db);
        return { success: true, message: "Diesel transaction updated successfully." };
      }
      case "updateDieselPayment": {
        const rec = db.dieselPayments.find(x => x.PaymentID === payload.PaymentID);
        if (!rec) return { success: false, message: "Diesel payment not found." };
        Object.assign(rec, { Date: payload.Date, Supplier: payload.Supplier, AmountPaid: payload.AmountPaid, PaymentMethod: payload.PaymentMethod, ReferenceNumber: payload.ReferenceNumber, Site: payload.Site, Remarks: payload.Remarks });
        audit(db, payload.CreatedBy, "Updated Diesel Payment", "DieselPayments", rec.PaymentID, rec.Supplier + " \u20B9" + rec.AmountPaid); saveDemo(db);
        return { success: true, message: "Diesel payment updated successfully." };
      }
      case "updateDieselBF": {
        const rec = db.dieselBF.find(x => x.Supplier === payload.OrigSupplier && x.BFMonth === payload.OrigBFMonth && x.BFDate === payload.OrigBFDate);
        if (!rec) return { success: false, message: "Diesel BF entry not found." };
        Object.assign(rec, { Supplier: payload.Supplier, BFMonth: payload.BFMonth, BFDate: payload.BFDate, BFAmount: payload.BFAmount, Site: payload.Site, Remarks: payload.Remarks });
        audit(db, payload.CreatedBy, "Updated Diesel BF", "DieselBF", rec.Supplier, "\u20B9" + rec.BFAmount); saveDemo(db);
        return { success: true, message: "Diesel BF updated successfully." };
      }
      case "getAuditLog": return { success: true, data: db.auditLog };
      case "deleteSupplier": {
        const idx = db.suppliers.findIndex(x => x.SupplierID === payload.SupplierID);
        if (idx === -1) return { success: false, message: "Supplier not found." };
        const rec = db.suppliers[idx];
        db.suppliers.splice(idx, 1);
        audit(db, payload.CreatedBy, "Deleted Supplier", "Suppliers", rec.SupplierID, rec.SupplierName); saveDemo(db);
        return { success: true, message: "Supplier deleted successfully." };
      }
      case "logAction": {
        db.auditLog.unshift(payload); saveDemo(db);
        return { success: true };
      }
      default: return { success: false, message: "Unknown action: " + action };
    }
  }

  window.PandaAPI = {
    isDemo: isDemo,
    call: function (action, payload) {
      return isDemo ? callDemo(action, payload) : callRemote(action, payload);
    }
  };
})();
