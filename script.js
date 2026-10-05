// Catatan Keuangan Perjalanan Dinas - LocalStorage only
const KEY = "catatan_dinas_v2";

const incomeCategories = ["Uang Harian","Uang Saku","Reimbursement","Dana Perjalanan","Lainnya"];
const expenseCategories = ["Hotel/Penginapan","Transportasi","Makan/Minum","Tol/Parkir","Tiket","BBM","Laundry","Lainnya"];

const $ = id => document.getElementById(id);
const rupiah = n => Number(n || 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0,10);
const uid = prefix => prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function loadDB(){
  const raw = localStorage.getItem(KEY);
  if(raw){
    try {
      const parsed = JSON.parse(raw);
      // migrasi: pastikan field baru selalu ada pada data lama
      if(!Array.isArray(parsed.payments)) parsed.payments = [];
      parsed.transactions = (parsed.transactions||[]).map(t=>({receiptImage:null, ...t}));
      return parsed;
    } catch(e){}
  }
  const db = {
    users: [
      {id:"u_admin", name:"Administrator", username:"admin", password:"admin123", role:"admin"}
    ],
    trips: [],
    transactions: [],
    payments: [],
    currentUserId: null
  };
  saveDB(db);
  return db;
}
function saveDB(db){
  try{
    localStorage.setItem(KEY, JSON.stringify(db));
  }catch(e){
    alert("Gagal menyimpan data. Kemungkinan penyimpanan browser penuh karena foto yang diunggah terlalu banyak/besar.");
  }
}
let db = loadDB();

// ===== Utilitas file gambar (kompresi + preview) =====
function fileToResizedDataURL(file, opts={}){
  const { maxDim = 1200, mime, quality = 0.82 } = opts;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image-failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(mime || file.type || "image/png", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function isPngFile(file){
  return file.type === "image/png" || /\.png$/i.test(file.name||"");
}
function viewImage(src){
  $("image-modal-img").src = src;
  $("image-modal").classList.remove("hidden");
}

function currentUser(){ return db.users.find(u => u.id === db.currentUserId); }
function getUser(id){ return db.users.find(u => u.id === id); }
function getTrip(id){ return db.trips.find(t => t.id === id); }
function participants(trip){ return trip.participants.map(getUser).filter(Boolean); }
function tripTransactions(tripId){ return db.transactions.filter(t => t.tripId === tripId); }
function totalType(tripId,type){ return tripTransactions(tripId).filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0); }
function share(amount,count){
  if(!count) return 0;
  return Math.floor(amount/count);
}
function formatDate(s){
  if(!s) return "-";
  return new Date(s+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
}
function visibleTrips(){
  const u=currentUser();
  if(!u) return [];
  if(u.role==="admin") return db.trips;
  return db.trips.filter(t=>t.participants.includes(u.id));
}

// ===== Rekap dapat & pembayaran per orang =====
function tripPayments(tripId){ return db.payments.filter(p=>p.tripId===tripId); }
function personPayments(tripId,userId){ return tripPayments(tripId).filter(p=>p.userId===userId); }
function personPaid(tripId,userId){ return personPayments(tripId,userId).reduce((s,p)=>s+p.amount,0); }
// "Dapat" = porsi pemasukan dikurangi porsi pengeluaran untuk 1 orang pada 1 perjalanan.
// Bisa negatif (artinya orang tsb masih berutang ke bendahara perjalanan).
function personNet(tripId,userId){
  const t=getTrip(tripId); if(!t) return 0;
  const count=t.participants.length;
  return share(totalType(tripId,"income"),count) - share(totalType(tripId,"expense"),count);
}
function participantRecap(trip){
  return participants(trip).map(u=>{
    const net=personNet(trip.id,u.id);
    const paid=personPaid(trip.id,u.id);
    return {user:u, net, paid, remaining: net-paid};
  });
}

function showPage(logged){
  $("login-page").classList.toggle("hidden",logged);
  $("app-page").classList.toggle("hidden",!logged);
  if(logged){
    const u=currentUser();
    $("user-greeting").textContent = `${u.name} • ${u.role==="admin"?"Administrator":"Pengguna"}`;
    $("users-tab").style.display = u.role==="admin" ? "" : "none";
    renderAll();
  }
}

$("login-form").addEventListener("submit", e=>{
  e.preventDefault();
  const username=$("login-username").value.trim();
  const password=$("login-password").value;
  const u=db.users.find(x=>x.username===username && x.password===password);
  if(!u){ $("login-error").textContent="Username atau password salah."; return; }
  db.currentUserId=u.id; saveDB(db); $("login-error").textContent=""; showPage(true);
});
$("logout-btn").addEventListener("click",()=>{
  db.currentUserId=null; saveDB(db); showPage(false); $("login-form").reset();
});

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>activateTab(btn.dataset.tab));
});
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>activateTab(btn.dataset.go)));
function activateTab(id){
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  document.querySelectorAll(".tab-content").forEach(c=>c.classList.toggle("active",c.id===id));
  if(id==="reports") renderReports();
}

$("new-trip-btn").addEventListener("click",()=>openTripModal());
function openTripModal(trip=null){
  $("trip-form").reset();
  $("trip-id").value=trip?.id || "";
  $("trip-modal-title").textContent=trip?"Edit Perjalanan Dinas":"Perjalanan Dinas Baru";
  $("trip-start").value=trip?.start || today();
  $("trip-end").value=trip?.end || trip?.start || today();
  $("trip-name").value=trip?.name || "";
  $("trip-location").value=trip?.location || "";
  $("trip-number").value=trip?.number || "";
  $("participant-error").textContent="";
  const selected=new Set(trip?.participants || (currentUser()?.role==="admin"?[]:[currentUser().id]));
  $("participant-options").innerHTML=db.users.map(u=>`
    <label class="check-item">
      <input type="checkbox" name="participants" value="${u.id}" ${selected.has(u.id)?"checked":""}>
      <span>${escapeHtml(u.name)}</span>
    </label>`).join("");
  $("trip-modal").classList.remove("hidden");
}
$("trip-form").addEventListener("submit",e=>{
  e.preventDefault();
  const ids=[...document.querySelectorAll('input[name="participants"]:checked')].map(x=>x.value);
  if(!ids.length){$("participant-error").textContent="Pilih minimal 1 peserta.";return;}
  const start=$("trip-start").value,end=$("trip-end").value;
  if(end<start){$("participant-error").textContent="Tanggal selesai tidak boleh sebelum tanggal mulai.";return;}
  const data={name:$("trip-name").value.trim(),location:$("trip-location").value.trim(),number:$("trip-number").value.trim(),start,end,participants:ids};
  const id=$("trip-id").value;
  if(id) Object.assign(getTrip(id),data);
  else db.trips.unshift({id:uid("trip"),...data});
  saveDB(db); closeModal("trip-modal"); renderAll();
});

function openTransactionModal(tripId){
  const trip=getTrip(tripId), ps=participants(trip);
  $("transaction-form").reset();
  $("transaction-trip-id").value=tripId;
  $("transaction-trip-title").textContent=trip.name+" • "+trip.location;
  $("transaction-date").value=today();
  $("transaction-payer").innerHTML=ps.map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("");
  $("transaction-receipt").value="";
  delete $("transaction-receipt").dataset.value;
  $("receipt-preview").innerHTML="";
  updateCategories();
  updateSplitPreview();
  $("transaction-modal").classList.remove("hidden");
}
$("transaction-receipt").addEventListener("change", async e=>{
  const file=e.target.files[0];
  $("receipt-preview").innerHTML="";
  delete $("transaction-receipt").dataset.value;
  if(!file) return;
  try{
    const dataUrl=await fileToResizedDataURL(file,{maxDim:1280, mime:"image/jpeg", quality:0.8});
    $("transaction-receipt").dataset.value=dataUrl;
    $("receipt-preview").innerHTML=`<img src="${dataUrl}" alt="Foto struk" onclick="viewImage('${dataUrl}')">`;
  }catch(err){
    alert("Gagal membaca file foto struk.");
  }
});
$("transaction-type").addEventListener("change",()=>{updateCategories();updateSplitPreview()});
$("transaction-amount").addEventListener("input",()=>{
  const raw=$("transaction-amount").value.replace(/\D/g,"");
  $("transaction-amount").value=raw?rupiah(parseInt(raw)): "";
  updateSplitPreview();
});
function updateCategories(){
  const arr=$("transaction-type").value==="income"?incomeCategories:expenseCategories;
  $("transaction-category").innerHTML=arr.map(x=>`<option>${x}</option>`).join("");
}
function updateSplitPreview(){
  const trip=getTrip($("transaction-trip-id").value);
  if(!trip)return;
  const amount=parseInt($("transaction-amount").value.replace(/\D/g,""))||0;
  const ps=participants(trip), per=share(amount,ps.length), remainder=amount-(per*ps.length);
  $("split-preview").innerHTML=`<div class="split-line"><span>${ps.length} peserta</span><strong>Rp ${rupiah(per)}/orang</strong></div>
  ${remainder?`<div class="small muted">Sisa pembulatan: Rp ${rupiah(remainder)} (tetap tercatat dalam total transaksi)</div>`:""}`;
}
$("transaction-form").addEventListener("submit",e=>{
  e.preventDefault();
  const tripId=$("transaction-trip-id").value;
  const amount=parseInt($("transaction-amount").value.replace(/\D/g,""))||0;
  if(amount<=0){alert("Jumlah harus lebih dari 0.");return;}
  const note=$("transaction-note").value.trim();
  const receiptImage=$("transaction-receipt").dataset.value || null;
  if(!receiptImage && !note){
    alert("Tambahkan foto struk, atau isi Keterangan apabila tidak ada struk.");
    return;
  }
  db.transactions.unshift({
    id:uid("trx"), tripId, type:$("transaction-type").value,
    category:$("transaction-category").value, amount,
    date:$("transaction-date").value, note,
    payerId:$("transaction-payer").value,
    receiptImage
  });
  saveDB(db); closeModal("transaction-modal"); renderAll();
});

// ===== Modal Pembayaran (mengurangi sisa "Dapat" dengan bukti tanda tangan PNG) =====
function openPaymentModal(tripId, userId){
  const trip=getTrip(tripId), u=getUser(userId);
  if(!trip || !u) return;
  $("payment-form").reset();
  $("payment-proof").value="";
  delete $("payment-proof").dataset.value;
  $("payment-preview").innerHTML="";
  $("payment-trip-id").value=tripId;
  $("payment-user-id").value=userId;
  $("payment-date").value=today();
  const net=personNet(tripId,userId), paid=personPaid(tripId,userId), remaining=net-paid;
  $("payment-context").textContent=`${trip.name} • ${u.name} — Sisa saat ini: Rp ${rupiah(remaining)}`;
  $("payment-amount").value = remaining>0 ? rupiah(remaining) : "";
  $("payment-modal").classList.remove("hidden");
}
$("payment-amount").addEventListener("input",()=>{
  const raw=$("payment-amount").value.replace(/\D/g,"");
  $("payment-amount").value=raw?rupiah(parseInt(raw)):"";
});
$("payment-proof").addEventListener("change", async e=>{
  const file=e.target.files[0];
  $("payment-preview").innerHTML="";
  delete $("payment-proof").dataset.value;
  if(!file) return;
  if(!isPngFile(file)){
    alert("Foto bukti tanda tangan harus berformat PNG (.png).");
    e.target.value="";
    return;
  }
  try{
    const dataUrl=await fileToResizedDataURL(file,{maxDim:1000, mime:"image/png"});
    $("payment-proof").dataset.value=dataUrl;
    $("payment-preview").innerHTML=`<img src="${dataUrl}" alt="Bukti tanda tangan" onclick="viewImage('${dataUrl}')">`;
  }catch(err){
    alert("Gagal membaca file bukti tanda tangan.");
  }
});
$("payment-form").addEventListener("submit", e=>{
  e.preventDefault();
  const proof=$("payment-proof").dataset.value;
  if(!proof){ alert("Unggah foto bukti tanda tangan (PNG) terlebih dahulu."); return; }
  const amount=parseInt($("payment-amount").value.replace(/\D/g,""))||0;
  if(amount<=0){ alert("Jumlah harus lebih dari 0."); return; }
  const tripId=$("payment-trip-id").value;
  db.payments.unshift({
    id:uid("pay"), tripId, userId:$("payment-user-id").value,
    amount, date:$("payment-date").value, note:$("payment-note").value.trim(),
    proof
  });
  saveDB(db); closeModal("payment-modal"); renderAll();
  openDetail(tripId);
});
function deletePayment(id, tripId){
  if(!confirm("Hapus catatan pembayaran ini?"))return;
  db.payments=db.payments.filter(p=>p.id!==id);
  saveDB(db); renderAll(); openDetail(tripId);
}

function renderDashboard(){
  const trips=visibleTrips();
  const incomes=trips.reduce((s,t)=>s+totalType(t.id,"income"),0);
  const expenses=trips.reduce((s,t)=>s+totalType(t.id,"expense"),0);
  const myId=currentUser().id;
  let myShare=0;
  trips.forEach(t=>{
    const count=t.participants.length;
    myShare += share(totalType(t.id,"expense"),count);
  });
  $("dashboard-cards").innerHTML=`
    <div class="card"><p>Perjalanan</p><h3>${trips.length}</h3></div>
    <div class="card"><p>Total Pemasukan</p><h3>Rp ${rupiah(incomes)}</h3></div>
    <div class="card"><p>Total Pengeluaran</p><h3>Rp ${rupiah(expenses)}</h3></div>
    <div class="card"><p>Beban Saya</p><h3>Rp ${rupiah(myShare)}</h3></div>`;
  $("dashboard-trips").innerHTML=trips.length?trips.slice(0,6).map(tripCard).join(""):`<div class="empty">Belum ada perjalanan dinas.</div>`;
}
function tripCard(t){
  const ps=participants(t), income=totalType(t.id,"income"),expense=totalType(t.id,"expense");
  return `<article class="trip-card">
    <h3>${escapeHtml(t.name)}</h3>
    <div class="trip-meta">📍 ${escapeHtml(t.location)}<br>📅 ${formatDate(t.start)} – ${formatDate(t.end)}<br>👥 ${ps.length} peserta</div>
    <div class="participant-pills">${ps.map(u=>`<span class="pill">${escapeHtml(u.name)}</span>`).join("")}</div>
    <div class="trip-total"><span>Total transaksi</span><strong>Rp ${rupiah(income+expense)}</strong></div>
    <div class="trip-actions">
      <button class="btn secondary" onclick="openDetail('${t.id}')">Detail</button>
      <button class="btn primary" onclick="openTransactionModal('${t.id}')">+ Transaksi</button>
    </div>
  </article>`;
}
function renderTrips(){
  const trips=visibleTrips();
  $("trip-list").innerHTML=trips.length?trips.map(t=>tripCard(t)+`
    <div style="display:none"></div>`).join(""):`<div class="empty">Belum ada perjalanan dinas.</div>`;
  // add edit/delete actions by injecting through event delegation below
  document.querySelectorAll("#trip-list .trip-card").forEach((card,i)=>{
    const t=trips[i];
    const actions=card.querySelector(".trip-actions");
    if(currentUser().role==="admin"){
      actions.insertAdjacentHTML("beforeend",`<button class="btn secondary" onclick="openTripModal(getTrip('${t.id}'))">Edit</button>
      <button class="btn danger" onclick="deleteTrip('${t.id}')">Hapus</button>`);
    }
  });
}
function renderUsers(){
  if(currentUser().role!=="admin")return;
  $("user-list").innerHTML=db.users.map(u=>`<div class="user-row">
    <div><strong>${escapeHtml(u.name)}</strong><div class="small muted">@${escapeHtml(u.username)} ${u.role==="admin"?"• Admin":""}</div></div>
    <div class="user-actions">
      <button class="edit-link" onclick="editUser('${u.id}')">Edit</button>
      ${u.id!=="u_admin"?`<button class="delete-link" onclick="deleteUser('${u.id}')">Hapus</button>`:""}
    </div>
  </div>`).join("");
}
$("user-form").addEventListener("submit",e=>{
  e.preventDefault();
  if(currentUser().role!=="admin")return;
  const id=$("user-id").value,name=$("user-name").value.trim(),username=$("user-username").value.trim(),password=$("user-password").value;
  if(db.users.some(u=>u.username===username && u.id!==id)){alert("Username sudah digunakan.");return;}
  if(id){
    const u=getUser(id);u.name=name;u.username=username;if(password)u.password=password;
  }else{
    if(!password){alert("Password wajib diisi.");return;}
    db.users.push({id:uid("user"),name,username,password,role:"user"});
  }
  saveDB(db);$("user-form").reset();$("user-id").value="";renderUsers();renderAll();
});
function editUser(id){
  const u=getUser(id);$("user-id").value=u.id;$("user-name").value=u.name;$("user-username").value=u.username;$("user-password").value="";
  activateTab("users");window.scrollTo({top:0,behavior:"smooth"});
}
function deleteUser(id){
  if(!confirm("Hapus orang ini? Jika sudah menjadi peserta, data perjalanan lama tetap ada."))return;
  db.users=db.users.filter(u=>u.id!==id);saveDB(db);renderAll();
}
function deleteTrip(id){
  if(!confirm("Hapus perjalanan ini beserta seluruh transaksi dan pembayarannya?"))return;
  db.trips=db.trips.filter(t=>t.id!==id);
  db.transactions=db.transactions.filter(t=>t.tripId!==id);
  db.payments=db.payments.filter(p=>p.tripId!==id);
  saveDB(db);renderAll();
}

function openDetail(id){
  const t=getTrip(id),ps=participants(t),tx=tripTransactions(id);
  $("detail-title").textContent=t.name;
  const income=totalType(id,"income"),expense=totalType(id,"expense"),count=ps.length;
  const recap=participantRecap(t);
  const payments=tripPayments(id);
  $("detail-content").innerHTML=`
    <div class="report-grid">
      <div class="report-card"><p>Pemasukan</p><h3 class="income">Rp ${rupiah(income)}</h3></div>
      <div class="report-card"><p>Pengeluaran</p><h3 class="expense">Rp ${rupiah(expense)}</h3></div>
      <div class="report-card"><p>Beban per Orang</p><h3>Rp ${rupiah(share(expense,count))}</h3></div>
    </div>
    <p class="muted">📍 ${escapeHtml(t.location)} • 📅 ${formatDate(t.start)} – ${formatDate(t.end)} • 👥 ${count} peserta</p>
    <div class="participant-pills">${ps.map(u=>`<span class="pill">${escapeHtml(u.name)}</span>`).join("")}</div>

    <div class="section-head" style="margin-top:20px"><h3>Dapat &amp; Pembayaran per Orang</h3></div>
    <div style="overflow:auto"><table class="recap-table"><thead><tr><th>Orang</th><th>Dapat</th><th>Sudah Dibayar</th><th>Sisa</th><th></th></tr></thead>
    <tbody>${recap.map(r=>recapRow(r,id)).join("")}</tbody></table></div>
    <div class="section-head" style="margin-top:14px"><h4 style="margin:0">Riwayat Pembayaran</h4></div>
    ${payments.length?`<div class="payment-history">${payments.map(p=>paymentHistoryRow(p,id)).join("")}</div>`:`<p class="small muted">Belum ada pembayaran tercatat.</p>`}

    <div class="section-head" style="margin-top:20px"><h3>Transaksi</h3><button class="btn primary" onclick="openTransactionModal('${id}');closeModal('detail-modal')">+ Tambah</button></div>
    <div class="transaction-list">${tx.length?tx.map(x=>transactionRow(x,t)).join(""):"<div class='empty'>Belum ada transaksi.</div>"}</div>`;
  $("detail-modal").classList.remove("hidden");
}
function recapRow(r, tripId){
  const dapatLabel = r.net<0 ? `<span class="expense">Utang Rp ${rupiah(Math.abs(r.net))}</span>` : `Rp ${rupiah(r.net)}`;
  const sisaLabel = r.remaining<0 ? `<span class="income">Lebih bayar Rp ${rupiah(Math.abs(r.remaining))}</span>` : `Rp ${rupiah(r.remaining)}`;
  return `<tr>
    <td><strong>${escapeHtml(r.user.name)}</strong></td>
    <td>${dapatLabel}</td>
    <td>Rp ${rupiah(r.paid)}</td>
    <td>${sisaLabel}</td>
    <td><button class="btn secondary tiny-btn" onclick="openPaymentModal('${tripId}','${r.user.id}')">Bayar</button></td>
  </tr>`;
}
function paymentHistoryRow(p, tripId){
  const u=getUser(p.userId);
  return `<div class="payment-row">
    <img class="receipt-thumb" src="${p.proof}" alt="Bukti tanda tangan" onclick="viewImage('${p.proof}')">
    <div><strong>${escapeHtml(u?.name||"-")}</strong> — Rp ${rupiah(p.amount)}
      <div class="small muted">${formatDate(p.date)}${p.note?" • "+escapeHtml(p.note):""}</div>
    </div>
    <button class="delete-link" onclick="deletePayment('${p.id}','${tripId}')">Hapus</button>
  </div>`;
}
function transactionRow(x,t){
  const sign=x.type==="income"?"+":"-";
  const per=share(x.amount,t.participants.length);
  const receiptHtml = x.receiptImage
    ? `<img class="receipt-thumb" src="${x.receiptImage}" alt="Foto struk" onclick="viewImage('${x.receiptImage}')">`
    : `<span class="small muted">Tidak ada struk</span>`;
  return `<div class="transaction-row">
    <div>
      <strong>${escapeHtml(x.category)}</strong>
      <div class="small muted">${formatDate(x.date)}${x.note?" • "+escapeHtml(x.note):""}<br>${x.type==="income"?"Diterima":"Dibayar"} oleh ${escapeHtml(getUser(x.payerId)?.name||"-")}</div>
      <div style="margin-top:6px">${receiptHtml}</div>
    </div>
    <div><strong class="${x.type}">${sign} Rp ${rupiah(x.amount)}</strong><div class="small muted">Rp ${rupiah(per)}/orang</div></div>
    <button class="delete-link" onclick="deleteTransaction('${x.id}','${t.id}')">Hapus</button>
  </div>`;
}
function deleteTransaction(id,tripId){
  if(!confirm("Hapus transaksi ini?"))return;
  db.transactions=db.transactions.filter(t=>t.id!==id);saveDB(db);renderAll();openDetail(tripId);
}

function renderReports(){
  const trips=visibleTrips();
  $("report-trip").innerHTML=`<option value="">Semua Perjalanan</option>`+trips.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  renderSelectedReport();
}
$("report-trip").addEventListener("change",renderSelectedReport);
function renderSelectedReport(){
  const selected=$("report-trip").value;
  const trips=selected?[getTrip(selected)].filter(Boolean):visibleTrips();
  if(!trips.length){$("report-content").innerHTML='<div class="empty">Belum ada data.</div>';return;}
  const totalIncome=trips.reduce((s,t)=>s+totalType(t.id,"income"),0);
  const totalExpense=trips.reduce((s,t)=>s+totalType(t.id,"expense"),0);
  const rows={};
  trips.forEach(t=>{
    const ps=participants(t), exp=totalType(t.id,"expense"), inc=totalType(t.id,"income");
    ps.forEach(u=>{
      if(!rows[u.id])rows[u.id]={name:u.name,income:0,expense:0,net:0,paid:0};
      rows[u.id].income+=share(inc,ps.length);
      rows[u.id].expense+=share(exp,ps.length);
      rows[u.id].net+=personNet(t.id,u.id);
      rows[u.id].paid+=personPaid(t.id,u.id);
    });
  });
  $("report-content").innerHTML=`
    <div class="report-grid">
      <div class="report-card"><p>Total Pemasukan</p><h3 class="income">Rp ${rupiah(totalIncome)}</h3></div>
      <div class="report-card"><p>Total Pengeluaran</p><h3 class="expense">Rp ${rupiah(totalExpense)}</h3></div>
      <div class="report-card"><p>Saldo</p><h3>Rp ${rupiah(totalIncome-totalExpense)}</h3></div>
    </div>
    <div class="panel">
      <h3>Rekap per Orang${selected?" (perjalanan ini)":" (total seluruh perjalanan)"}</h3>
      <div style="overflow:auto"><table class="person-table"><thead><tr><th>Orang</th><th>Porsi Pemasukan</th><th>Porsi Pengeluaran</th><th>Total Dapat</th><th>Sudah Dibayar</th><th>Sisa</th></tr></thead><tbody>
      ${Object.values(rows).map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong></td><td class="income">Rp ${rupiah(r.income)}</td><td class="expense">Rp ${rupiah(r.expense)}</td><td>Rp ${rupiah(r.net)}</td><td>Rp ${rupiah(r.paid)}</td><td>Rp ${rupiah(r.net-r.paid)}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="small muted" style="margin-top:10px">Untuk mencatat pembayaran beserta bukti tanda tangan (PNG), buka Detail pada perjalanan terkait.</p>
    </div>`;
}

function renderAll(){renderDashboard();renderTrips();renderUsers();renderReports();}

document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));
function closeModal(id){$(id).classList.add("hidden")}

$("reset-btn").addEventListener("click",()=>{
  if(!confirm("Hapus SEMUA data aplikasi dari browser ini?"))return;
  localStorage.removeItem(KEY);db=loadDB();showPage(false);alert("Semua data telah dihapus.");
});

function escapeHtml(str){
  return String(str??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

updateCategories();
if(db.currentUserId && currentUser()) showPage(true); else showPage(false);
