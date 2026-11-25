// ==========================================
// 1. ISI KONFIGURASI SUPABASE LU DI SINI
// ==========================================
const SUPABASE_URL = 'https://qfskyzccthayeijwgpwy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZKinN9nq-Z_c7DXCylmAg_gX1SNJ8A';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Ambil elemen dari HTML
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const btnSetSaldo = document.getElementById('btn-set-saldo');
const btnReset = document.getElementById('btn-reset');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnSubmit = document.getElementById('btn-submit');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const inputDateTrigger = document.getElementById('input-date-trigger');
const inputDateLabel = document.getElementById('input-date-label');
const dateStrip = document.getElementById('date-strip');
const historyMonthLabel = document.getElementById('history-month-label');
const historyPrevMonthBtn = document.getElementById('history-prev-month');
const historyNextMonthBtn = document.getElementById('history-next-month');
const historyMonthBtn = document.getElementById('history-month-btn');
const btnShowAll = document.getElementById('btn-show-all');

// Elemen Bottom Sheet Calendar
const calendarModal = document.getElementById('calendar-modal');
const calMonthYear = document.getElementById('cal-month-year');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const closeCalendarBtn = document.getElementById('close-calendar');

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toDateString(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateString(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatTanggalIndo(str) {
  const d = parseDateString(str);
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// State awal
const todayStr = toDateString(new Date());
let selectedInputDate = todayStr;
let selectedFilterDate = todayStr;
let isShowAll = false;
let calendarViewDate = new Date();
let calendarMode = 'input'; // 'input' atau 'filter'

let initialBalance = 0;
let transactions = [];

function formatRibuan(angka) {
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRupiah(angka) {
  const isNegative = angka < 0;
  const formatted = formatRibuan(Math.abs(angka));
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

function parseRupiahToNumber(str) {
  const cleanNumber = str.replace(/[^0-9]/g, '');
  return Number(cleanNumber) || 0;
}

// Auto-format titik ribuan saat ngetik nominal
amountInput.addEventListener('input', (e) => {
  const rawValue = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = rawValue === '' ? '' : formatRibuan(Number(rawValue));
});

// ==========================================
// AMBIL DATA DARI SUPABASE CLOUD
// ==========================================
async function loadCloudData() {
  try {
    const { data: settingData, error: settingErr } = await db
      .from('settings')
      .select('initial_balance')
      .eq('id', 1)
      .single();

    if (!settingErr && settingData) {
      initialBalance = Number(settingData.initial_balance) || 0;
    }

    const { data: trxData, error: trxErr } = await db
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: true });

    if (!trxErr && trxData) {
      transactions = trxData.map((item) => ({
        id: item.id,
        type: item.type,
        amount: Number(item.amount),
        description: item.description,
        date: item.date
      }));
    }

    updateUI();
  } catch (err) {
    console.error('Gagal load data Supabase:', err);
    totalBalanceEl.textContent = 'Error Koneksi';
  }
}

// Realtime Sync
db.channel('public-sync')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
    loadCloudData();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
    loadCloudData();
  })
  .subscribe();

function updateInputDateDisplay() {
  dateInput.value = selectedInputDate;
  inputDateLabel.textContent = selectedInputDate === todayStr
    ? `Hari ini (${formatTanggalIndo(selectedInputDate)})`
    : formatTanggalIndo(selectedInputDate);
}

// Fungsi pindah bulan pada riwayat transaksi
function shiftFilterMonth(offset) {
  const current = parseDateString(selectedFilterDate);
  const targetYear = current.getFullYear();
  const targetMonth = current.getMonth() + offset;
  const maxDaysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(current.getDate(), maxDaysInTarget);

  selectedFilterDate = toDateString(new Date(targetYear, targetMonth, safeDay));
  isShowAll = false;
  btnShowAll.classList.remove('active');
  updateUI();
}

historyPrevMonthBtn.addEventListener('click', () => shiftFilterMonth(-1));
historyNextMonthBtn.addEventListener('click', () => shiftFilterMonth(1));

// Klik label bulan di Riwayat untuk langsung loncat ke bulan/tahun/tanggal mana pun
historyMonthBtn.addEventListener('click', () => {
  calendarMode = 'filter';
  calendarViewDate = parseDateString(selectedFilterDate);
  renderCalendarModal();
  calendarModal.classList.add('open');
});

function renderDateStrip() {
  const refDate = parseDateString(selectedFilterDate);
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  historyMonthLabel.textContent = `${NAMA_BULAN[month]} ${year}`;
  dateStrip.innerHTML = '';

  const datesWithTrx = new Set(transactions.map((t) => t.date));

  for (let day = 1; day <= daysInMonth; day++) {
    const dObj = new Date(year, month, day);
    const dStr = toDateString(dObj);

    const pill = document.createElement('div');
    pill.className = 'date-pill';
    if (!isShowAll && dStr === selectedFilterDate) pill.classList.add('active');
    if (datesWithTrx.has(dStr)) pill.classList.add('has-trx');

    pill.innerHTML = `
      <span class="day-name">${NAMA_HARI[dObj.getDay()]}</span>
      <span class="day-num">${day}</span>
      <span class="dot-indicator"></span>
    `;

    pill.addEventListener('click', () => {
      isShowAll = false;
      btnShowAll.classList.remove('active');
      selectedFilterDate = dStr;
      updateUI();
    });

    dateStrip.appendChild(pill);
  }

  setTimeout(() => {
    const activePill = dateStrip.querySelector('.date-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 50);
}

function renderCalendarModal() {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  calMonthYear.textContent = `${NAMA_BULAN[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeTargetDate = calendarMode === 'input' ? selectedInputDate : selectedFilterDate;
  const datesWithTrx = new Set(transactions.map((t) => t.date));

  calendarGrid.innerHTML = '';

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day empty';
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = toDateString(new Date(year, month, day));
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = day;

    if (dStr === todayStr) cell.classList.add('today');
    if (dStr === activeTargetDate) cell.classList.add('selected');
    if (datesWithTrx.has(dStr)) cell.classList.add('has-trx');

    cell.addEventListener('click', () => {
      if (calendarMode === 'input') {
        selectedInputDate = dStr;
        updateInputDateDisplay();
      } else {
        selectedFilterDate = dStr;
        isShowAll = false;
        btnShowAll.classList.remove('active');
        updateUI();
      }

      // Aktifkan indikator tombol Selesai jadi biru + tampilkan tanggal terpilih
      const pickedObj = parseDateString(dStr);
      closeCalendarBtn.classList.add('ready');
      closeCalendarBtn.textContent = `Selesai (${pickedObj.getDate()} ${NAMA_BULAN[pickedObj.getMonth()].slice(0, 3)})`;

      renderCalendarModal();
    });

    calendarGrid.appendChild(cell);
  }
}

inputDateTrigger.addEventListener('click', () => {
  calendarMode = 'input';
  calendarViewDate = parseDateString(selectedInputDate);
  // Reset tombol ke status netral saat modal baru dibuka
  closeCalendarBtn.classList.remove('ready');
  closeCalendarBtn.textContent = 'Tutup';
  renderCalendarModal();
  calendarModal.classList.add('open');
});

closeCalendarBtn.addEventListener('click', () => {
  calendarModal.classList.remove('open');
});

calendarModal.addEventListener('click', (e) => {
  if (e.target === calendarModal) calendarModal.classList.remove('open');
});

prevMonthBtn.addEventListener('click', () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendarModal();
});

nextMonthBtn.addEventListener('click', () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendarModal();
});

function getDisplayedTransactions() {
  const indexedTransactions = transactions.map((trx, idx) => ({ ...trx, _order: idx }));
  const sortedTransactions = indexedTransactions.sort((a, b) => {
    const dateDiff = parseDateString(a.date) - parseDateString(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a._order - b._order;
  });

  return isShowAll
    ? sortedTransactions
    : sortedTransactions.filter((trx) => trx.date === selectedFilterDate);
}

function updateUI() {
  let income = 0;
  let expense = 0;

  transactions.forEach((trx) => {
    if (trx.type === 'income') {
      income += trx.amount;
    } else {
      expense += trx.amount;
    }
  });

  const currentBalance = initialBalance + income - expense;
  totalBalanceEl.textContent = formatRupiah(currentBalance);
  totalIncomeEl.textContent = formatRupiah(income);
  totalExpenseEl.textContent = formatRupiah(expense);

  renderDateStrip();

  const visibleTransactions = getDisplayedTransactions();
  transactionList.innerHTML = '';

  if (visibleTransactions.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.className = 'empty-state';
    emptyMsg.textContent = isShowAll
      ? 'Belum ada catatan transaksi sama sekali.'
      : `Tidak ada transaksi pada ${formatTanggalIndo(selectedFilterDate)}.`;
    transactionList.appendChild(emptyMsg);
    return;
  }

  visibleTransactions.forEach((trx) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    const isIncome = trx.type === 'income';
    const sign = isIncome ? '+' : '-';
    const amountClass = isIncome ? 'amount-plus' : 'amount-minus';

    li.innerHTML = `
      <div class="item-info">
        <h4>${trx.description}</h4>
        <span>${formatTanggalIndo(trx.date)}</span>
      </div>
      <div class="item-right">
        <span class="${amountClass}">${sign} ${formatRupiah(trx.amount)}</span>
        <button class="delete-btn" onclick="deleteTransaction('${trx.id}')">✕</button>
      </div>
    `;

    transactionList.appendChild(li);
  });
}

// Export to Excel
btnExportExcel.addEventListener('click', () => {
  const dataToExport = getDisplayedTransactions();

  if (dataToExport.length === 0) {
    alert('Belum ada data transaksi untuk di-export ke Excel!');
    return;
  }

  let tableRows = '';
  dataToExport.forEach((trx) => {
    const isIncome = trx.type === 'income';
    const sign = isIncome ? '+' : '-';
    const nominalText = `${sign} ${formatRupiah(trx.amount)}`;
    const textColor = isIncome ? '#1e7e34' : '#d93025';

    tableRows += `
      <tr>
        <td style="border: 1px solid #000000; padding: 6px 10px;">${formatTanggalIndo(trx.date)}</td>
        <td style="border: 1px solid #000000; padding: 6px 10px; color: ${textColor}; font-weight: bold;">${nominalText}</td>
        <td style="border: 1px solid #000000; padding: 6px 10px;">${trx.description}</td>
      </tr>
    `;
  });

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"></head>
    <body>
      <table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12pt;">
        <thead>
          <tr>
            <th style="border: 1px solid #000000; background-color: #1c1c1e; color: #ffffff; padding: 8px 12px;">Tanggal</th>
            <th style="border: 1px solid #000000; background-color: #1c1c1e; color: #ffffff; padding: 8px 12px;">Nominal</th>
            <th style="border: 1px solid #000000; background-color: #1c1c1e; color: #ffffff; padding: 8px 12px;">Keterangan</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = isShowAll
    ? `MyMoney_Semua_Transaksi_${todayStr}.xls`
    : `MyMoney_Transaksi_${selectedFilterDate}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

btnShowAll.addEventListener('click', () => {
  isShowAll = !isShowAll;
  btnShowAll.classList.toggle('active', isShowAll);
  updateUI();
});

// Set Saldo Awal ke Supabase
btnSetSaldo.addEventListener('click', async () => {
  const defaultFormatted = initialBalance > 0 ? formatRibuan(initialBalance) : '';
  const input = prompt('Masukkan nominal saldo awal kamu (Rp):', defaultFormatted);
  if (input !== null && input.trim() !== '') {
    const newSaldo = parseRupiahToNumber(input);
    btnSetSaldo.textContent = 'Menyimpan...';

    const { error } = await db
      .from('settings')
      .upsert({ id: 1, initial_balance: newSaldo });

    btnSetSaldo.textContent = 'Set Saldo Awal';
    if (error) {
      alert('Gagal menyimpan saldo: ' + error.message);
      return;
    }

    initialBalance = newSaldo;
    updateUI();
  }
});

// Simpan Transaksi Baru ke Supabase
transactionForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.querySelector('input[name="type"]:checked').value;
  const amount = parseRupiahToNumber(amountInput.value);
  const description = document.getElementById('description').value.trim();
  const date = selectedInputDate;

  if (amount <= 0 || !description || !date) return;

  const newTransaction = {
    id: generateUniqueId(),
    type,
    amount,
    description,
    date
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Menyimpan ke Cloud...';

  const { error } = await db.from('transactions').insert([newTransaction]);

  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Simpan Transaksi';

  if (error) {
    alert('Gagal menyimpan transaksi: ' + error.message);
    return;
  }

  transactions.push(newTransaction);
  if (!isShowAll) {
    selectedFilterDate = date;
  }

  updateUI();
  amountInput.value = '';
  document.getElementById('description').value = '';
});

// Hapus 1 Transaksi dari Supabase
async function deleteTransaction(id) {
  const { error } = await db.from('transactions').delete().eq('id', String(id));
  if (error) {
    alert('Gagal menghapus: ' + error.message);
    return;
  }
  transactions = transactions.filter((trx) => String(trx.id) !== String(id));
  updateUI();
}

// Reset Semua Data di Supabase
btnReset.addEventListener('click', async () => {
  if (confirm('Yakin mau hapus semua saldo dan riwayat transaksi di Mac & iPhone?')) {
    await db.from('transactions').delete().neq('id', '0');
    await db.from('settings').upsert({ id: 1, initial_balance: 0 });
    initialBalance = 0;
    transactions = [];
    updateUI();
  }
});

// Jalankan pertama kali
updateInputDateDisplay();
loadCloudData();