// ==========================================
// 1. ISI KONFIGURASI SUPABASE LU DI SINI
// ==========================================
const SUPABASE_URL = 'https://qfskyzccthayeijwgpwy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZKinN9nq-Z_c7DXCylmAg_gX1SNJ8A';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Elemen KPI
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const initialBalanceDisplayEl = document.getElementById('initial-balance-display');
const badgeBalanceEl = document.getElementById('badge-balance');
const badgeExpenseEl = document.getElementById('badge-expense');
const badgeIncomeEl = document.getElementById('badge-income');

// Elemen Form & Riwayat
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const btnSetSaldo = document.getElementById('btn-set-saldo');
const btnReset = document.getElementById('btn-reset');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnExportExcelSide = document.getElementById('btn-export-excel-side');
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
const searchInput = document.getElementById('search-input');

// Elemen Bottom Sheet Calendar
const calendarModal = document.getElementById('calendar-modal');
const calMonthYear = document.getElementById('cal-month-year');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const closeCalendarBtn = document.getElementById('close-calendar');

// Elemen Custom Modal Set Saldo Awal
const saldoModal = document.getElementById('saldo-modal');
const saldoForm = document.getElementById('saldo-form');
const saldoModalInput = document.getElementById('saldo-modal-input');
const closeSaldoModalBtn = document.getElementById('close-saldo-modal');
const btnSaveSaldo = document.getElementById('btn-save-saldo');

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
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// State awal
const todayStr = toDateString(new Date());
let selectedInputDate = todayStr;
let selectedFilterDate = todayStr;
let isShowAll = false;
let searchQuery = '';
let calendarViewDate = new Date();
let calendarMode = 'input';

let initialBalance = 0;
let transactions = [];

let renderedStripMonthKey = '';
let slideDirection = 'next';

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

amountInput.addEventListener('input', (e) => {
  const rawValue = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = rawValue === '' ? '' : formatRibuan(Number(rawValue));
});

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  updateUI();
});

// ==========================================
// SINKRONISASI TANGGAL FORM INPUT <-> RIWAYAT
// ==========================================
function syncActiveDate(newDateStr) {
  if (newDateStr < selectedFilterDate) {
    slideDirection = 'prev';
  } else {
    slideDirection = 'next';
  }

  selectedInputDate = newDateStr;
  selectedFilterDate = newDateStr;
  isShowAll = false;
  btnShowAll.classList.remove('active');
  updateInputDateDisplay();
  updateUI();
}

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

function shiftFilterMonth(offset) {
  const current = parseDateString(selectedFilterDate);
  const targetYear = current.getFullYear();
  const targetMonth = current.getMonth() + offset;
  const maxDaysInTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(current.getDate(), maxDaysInTarget);

  const nextDateStr = toDateString(new Date(targetYear, targetMonth, safeDay));
  syncActiveDate(nextDateStr);
}

historyPrevMonthBtn.addEventListener('click', () => shiftFilterMonth(-1));
historyNextMonthBtn.addEventListener('click', () => shiftFilterMonth(1));

historyMonthBtn.addEventListener('click', () => {
  calendarMode = 'filter';
  calendarViewDate = parseDateString(selectedFilterDate);
  closeCalendarBtn.classList.remove('ready');
  closeCalendarBtn.textContent = 'Tutup';
  renderCalendarModal();
  calendarModal.classList.add('open');
});

function renderDateStrip() {
  const refDate = parseDateString(selectedFilterDate);
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const monthKey = `${year}-${month}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const datesWithTrx = new Set(transactions.map((t) => t.date));

  historyMonthLabel.textContent = `${NAMA_BULAN[month]} ${year}`;

  if (renderedStripMonthKey !== monthKey) {
    dateStrip.innerHTML = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(year, month, day);
      const dStr = toDateString(dObj);

      const pill = document.createElement('div');
      pill.className = 'date-pill';
      pill.dataset.date = dStr;

      pill.innerHTML = `
        <span class="day-name">${NAMA_HARI[dObj.getDay()]}</span>
        <span class="day-num">${day}</span>
        <span class="dot-indicator"></span>
      `;

      pill.addEventListener('click', () => {
        syncActiveDate(dStr);
      });

      dateStrip.appendChild(pill);
    }
    renderedStripMonthKey = monthKey;
  }

  let activePill = null;
  dateStrip.querySelectorAll('.date-pill').forEach((pill) => {
    const dStr = pill.dataset.date;
    const isActive = !isShowAll && dStr === selectedFilterDate;
    pill.classList.toggle('active', isActive);
    pill.classList.toggle('has-trx', datesWithTrx.has(dStr));
    if (isActive) activePill = pill;
  });

  if (activePill) {
    const targetScrollLeft =
      activePill.offsetLeft - dateStrip.clientWidth / 2 + activePill.clientWidth / 2;
    dateStrip.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    });
  }
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
      syncActiveDate(dStr);

      const pickedObj = parseDateString(dStr);
      closeCalendarBtn.classList.add('ready');
      closeCalendarBtn.textContent = `Selesai (${pickedObj.getDate()} ${NAMA_BULAN[pickedObj.getMonth()].slice(0, 3)})`;

      renderCalendarModal();
    });

    calendarGrid.appendChild(cell);
  }
}

if (inputDateTrigger) {
  inputDateTrigger.addEventListener('click', () => {
    calendarMode = 'input';
    calendarViewDate = parseDateString(selectedInputDate);
    if (closeCalendarBtn) {
      closeCalendarBtn.classList.remove('ready');
      closeCalendarBtn.textContent = 'Tutup';
    }
    renderCalendarModal();
    if (calendarModal) calendarModal.classList.add('open');
  });
}

if (closeCalendarBtn && calendarModal) {
  closeCalendarBtn.addEventListener('click', () => {
    calendarModal.classList.remove('open');
  });
}

if (calendarModal) {
  calendarModal.addEventListener('click', (e) => {
    if (e.target === calendarModal) calendarModal.classList.remove('open');
  });
}

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
    renderCalendarModal();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
    renderCalendarModal();
  });
}

function getDisplayedTransactions() {
  const indexedTransactions = transactions.map((trx, idx) => ({ ...trx, _order: idx }));
  const sortedTransactions = indexedTransactions.sort((a, b) => {
    const dateDiff = parseDateString(a.date) - parseDateString(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a._order - b._order;
  });

  let filtered = isShowAll
    ? sortedTransactions
    : sortedTransactions.filter((trx) => trx.date === selectedFilterDate);

  if (searchQuery) {
    filtered = filtered.filter((trx) =>
      trx.description.toLowerCase().includes(searchQuery)
    );
  }

  return filtered;
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

  const totalFunds = initialBalance + income;
  const currentBalance = totalFunds - expense;

  totalBalanceEl.textContent = formatRupiah(currentBalance);
  totalIncomeEl.textContent = formatRupiah(income);
  totalExpenseEl.textContent = formatRupiah(expense);
  initialBalanceDisplayEl.textContent = formatRupiah(initialBalance);

  const spentPct = totalFunds > 0
    ? Math.min(100, Math.round((expense / totalFunds) * 100))
    : (expense > 0 ? 100 : 0);
  const remainPct = Math.max(0, 100 - spentPct);
  const incomeGrowthPct = initialBalance > 0
    ? Math.round((income / initialBalance) * 100)
    : (income > 0 ? 100 : 0);

  badgeBalanceEl.textContent = `${remainPct}%`;
  badgeExpenseEl.textContent = `-${spentPct}%`;
  badgeIncomeEl.textContent = `+${incomeGrowthPct}%`;

  renderDateStrip();

  const tableWrapper = document.querySelector('.table-wrapper');
  const startHeight = tableWrapper ? tableWrapper.offsetHeight : 0;

  const visibleTransactions = getDisplayedTransactions();
  transactionList.innerHTML = '';

  transactionList.classList.remove('slide-next', 'slide-prev');
  void transactionList.offsetWidth;
  transactionList.classList.add(slideDirection === 'prev' ? 'slide-prev' : 'slide-next');

  if (visibleTransactions.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.className = 'empty-state';
    emptyMsg.textContent = searchQuery
      ? `Tidak ditemukan transaksi dengan kata kunci "${searchQuery}".`
      : isShowAll
        ? 'Belum ada catatan transaksi sama sekali.'
        : `Tidak ada transaksi pada ${formatTanggalIndo(selectedFilterDate)}.`;
    transactionList.appendChild(emptyMsg);
  } else {
    visibleTransactions.forEach((trx) => {
      const li = document.createElement('li');
      li.className = 'transaction-item';

      const isIncome = trx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'amount-plus' : 'amount-minus';
      const pillClass = isIncome ? 'credit' : 'debit';
      const pillText = isIncome ? 'Credit' : 'Debit';

      li.innerHTML = `
        <span class="col-date">${formatTanggalIndo(trx.date)}</span>
        <span class="col-desc">${trx.description}</span>
        <span class="col-type"><span class="type-pill ${pillClass}">${pillText}</span></span>
        <span class="col-amount ${amountClass}">${sign} ${formatRupiah(trx.amount)}</span>
        <span class="col-action">
          <button class="delete-btn" onclick="deleteTransaction('${trx.id}')" title="Hapus">✕</button>
        </span>
      `;

      transactionList.appendChild(li);
    });
  }

  if (tableWrapper && startHeight > 0) {
    tableWrapper.style.height = 'auto';
    const endHeight = tableWrapper.offsetHeight;
    tableWrapper.style.height = `${startHeight}px`;
    void tableWrapper.offsetHeight;
    tableWrapper.style.height = `${endHeight}px`;

    clearTimeout(tableWrapper._heightTimer);
    tableWrapper._heightTimer = setTimeout(() => {
      tableWrapper.style.height = 'auto';
    }, 300);
  }
}

// ==========================================
// EXPORT KE EXCEL
// ==========================================
function exportToExcel() {
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
}

btnExportExcel.addEventListener('click', exportToExcel);
if (btnExportExcelSide) btnExportExcelSide.addEventListener('click', exportToExcel);

btnShowAll.addEventListener('click', () => {
  isShowAll = !isShowAll;
  btnShowAll.classList.toggle('active', isShowAll);
  updateUI();
});

// ==========================================
// CUSTOM MODAL SET SALDO AWAL
// ==========================================
if (saldoModalInput) {
  saldoModalInput.addEventListener('input', (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = rawValue === '' ? '' : formatRibuan(Number(rawValue));
  });
}

document.querySelectorAll('.preset-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (!saldoModalInput) return;
    const val = Number(chip.dataset.val);
    saldoModalInput.value = formatRibuan(val);
    saldoModalInput.focus();
  });
});

btnSetSaldo.addEventListener('click', () => {
  if (!saldoModal || !saldoModalInput) return;
  saldoModalInput.value = initialBalance > 0 ? formatRibuan(initialBalance) : '';
  saldoModal.classList.add('open');
  setTimeout(() => saldoModalInput.focus(), 120);
});

if (closeSaldoModalBtn) {
  closeSaldoModalBtn.addEventListener('click', () => {
    saldoModal.classList.remove('open');
  });
}

if (saldoModal) {
  saldoModal.addEventListener('click', (e) => {
    if (e.target === saldoModal) saldoModal.classList.remove('open');
  });
}

if (saldoForm) {
  saldoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSaldo = parseRupiahToNumber(saldoModalInput.value);

    btnSaveSaldo.disabled = true;
    btnSaveSaldo.textContent = 'Menyimpan...';

    const { error } = await db
      .from('settings')
      .upsert({ id: 1, initial_balance: newSaldo });

    btnSaveSaldo.disabled = false;
    btnSaveSaldo.textContent = 'Simpan Saldo';

    if (error) {
      alert('Gagal menyimpan saldo: ' + error.message);
      return;
    }

    initialBalance = newSaldo;
    updateUI();
    saldoModal.classList.remove('open');
  });
}

// ==========================================
// SIMPAN & HAPUS TRANSAKSI
// ==========================================
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
  btnSubmit.textContent = 'Menyimpan...';

  const { error } = await db.from('transactions').insert([newTransaction]);

  btnSubmit.disabled = false;

  if (error) {
    btnSubmit.textContent = 'Simpan Transaksi';
    alert('Gagal menyimpan transaksi: ' + error.message);
    return;
  }

  transactions.push(newTransaction);
  syncActiveDate(date);

  amountInput.value = '';
  document.getElementById('description').value = '';

  btnSubmit.textContent = `✓ Tersimpan di ${formatTanggalIndo(date)}`;
  setTimeout(() => {
    btnSubmit.textContent = 'Simpan Transaksi';
  }, 1800);
});

async function deleteTransaction(id) {
  const { error } = await db.from('transactions').delete().eq('id', String(id));
  if (error) {
    alert('Gagal menghapus: ' + error.message);
    return;
  }
  transactions = transactions.filter((trx) => String(trx.id) !== String(id));
  updateUI();
}

btnReset.addEventListener('click', async () => {
  if (confirm('Yakin mau hapus semua saldo dan riwayat transaksi di semua perangkat?')) {
    await db.from('transactions').delete().neq('id', '0');
    await db.from('settings').upsert({ id: 1, initial_balance: 0 });
    initialBalance = 0;
    transactions = [];
    updateUI();
  }
});

updateInputDateDisplay();
loadCloudData();

// ==========================================
// SWITCH LIGHT & DARK MODE
// ==========================================
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light-mode', isLight);
  if (themeIcon) {
    themeIcon.textContent = isLight ? '🌙' : '☀️';
  }
}

// Muat tema terakhir yang tersimpan (default: dark)
const savedTheme = localStorage.getItem('mymoney_theme') || 'dark';
applyTheme(savedTheme);

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const isCurrentlyLight = document.body.classList.contains('light-mode');
    const nextTheme = isCurrentlyLight ? 'dark' : 'light';
    applyTheme(nextTheme);
    localStorage.setItem('mymoney_theme', nextTheme);
  });
}