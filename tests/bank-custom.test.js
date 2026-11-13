const assert = require("assert"), fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/app/app.js", "utf8");
const grab = (n) => { const i = src.indexOf("function " + n + "("); let d = 0, j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); } };
const ctx = { methodLabel: (k) => k }; vm.createContext(ctx);
["computeWalletTotal", "accountsForMethod", "standaloneAccounts", "transferCashEntries"].forEach((n) => vm.runInContext(grab(n), ctx));
// ব্যাংক অ্যাকাউন্ট মোটে যোগ হয় না; বাকি সব হয়
assert.strictEqual(ctx.computeWalletTotal([{ balance: 100 }], [{ type: "bank", balance: 5000 }, { type: "custom", balance: 40 }, { type: "mfs", balance: 10 }]), 150);
const accs = [{ id: "d", type: "bank", name: "DBBL" }, { id: "b2", type: "custom", parentMethod: "bkash", name: "বিকাশ ২" }, { id: "s", type: "custom", parentMethod: null, name: "Ap" }, { id: "m", type: "mfs", name: "old" }];
const names = (m) => ctx.accountsForMethod(accs, m).map((a) => a.id).join();
assert.strictEqual(names("bkash"), "b2,m"); assert.strictEqual(names("nagad"), "m"); assert.strictEqual(names("bank"), "d"); assert.strictEqual(names("rocket"), "m");
assert.strictEqual(ctx.standaloneAccounts(accs).map((a) => a.id).join(), "s");
const tr = (o) => ctx.transferCashEntries([Object.assign({ id: 1, amount: 5 }, o)], accs)[0].bankDir;
assert.strictEqual(tr({ fromMethod: "bkash", toAccountId: "d" }), "deposit");
assert.strictEqual(tr({ fromAccountId: "d", toMethod: "nagad" }), "withdraw");
assert.strictEqual(tr({ fromAccountId: "d", toMethod: "bank" }), null);
assert.strictEqual(tr({ fromMethod: "cash", toMethod: "bkash" }), null);
console.log("bank-custom: 10 passed");
