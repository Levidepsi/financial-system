/* Device-local schedules; no background charges or automatic transaction creation. */
(() => {
  const KEY = 'perfi-recurring-schedules-v1';
  const list = document.querySelector('#perfi-schedule-list');
  if (!list) return;
  const safe = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const read = () => { try { const data = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(data) ? data : []; } catch { return []; } };
  const write = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); return true; } catch { alert('Could not save schedules on this device.'); return false; } };
  const dateToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const nextDate = (date, cadence) => {
    const [y,m,d] = date.split('-').map(Number);
    const next = new Date(y,m-1,d,12);
    if (cadence === 'weekly') next.setDate(next.getDate()+7);
    else { const target = next.getMonth()+1; next.setDate(1); next.setMonth(target); next.setDate(Math.min(d, new Date(next.getFullYear(),next.getMonth()+1,0).getDate())); }
    return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
  };
  function render() {
    const items = read().sort((a,b)=>a.due.localeCompare(b.due));
    list.innerHTML = items.length ? items.map((item)=>`<div class="perfi-schedule-row"><div><strong>${safe(item.name)} · ₱${Number(item.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}</strong><small>${safe(item.type)} · ${safe(item.category)} · ${safe(item.cadence)} · Due ${safe(item.due)} ${item.due <= dateToday() ? '· Due now' : ''}</small></div><div><button type="button" data-pay="${safe(item.id)}">${item.type==='income'?'Record received':'Mark paid'}</button><button type="button" data-advance="${safe(item.id)}">Advance schedule</button><button type="button" data-remove="${safe(item.id)}">Remove</button></div></div>`).join('') : '<p>No scheduled entries yet. Add rent, salary, subscriptions, or bills to review them here.</p>';
  }
  document.querySelector('#perfi-new-schedule').addEventListener('click', () => {
    const name = prompt('Schedule name (e.g. Rent, Salary)'); if (name === null) return;
    if (!name.trim() || name.length > 60) return alert('Enter a name up to 60 characters.');
    const amount = Number(prompt('Amount in PHP', '1000')); if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) return alert('Invalid amount.');
    const type = prompt('Type: expense or income', 'expense'); if (!['expense','income'].includes(type)) return alert('Choose expense or income.');
    const category = type === 'income' ? 'Income' : (prompt('Category (e.g. Housing & Bills, Shopping, Debt Repayment)', 'Housing & Bills') || 'Housing & Bills').trim();
    const cadence = prompt('Repeat: monthly or weekly', 'monthly'); if (!['monthly','weekly'].includes(cadence)) return alert('Choose monthly or weekly.');
    const due = prompt('Next due date (YYYY-MM-DD)', dateToday());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(new Date(`${due}T12:00:00`).getTime())) return alert('Enter a valid due date.');
    const items = read(); items.push({id:`schedule-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:name.trim(),amount,type,category,cadence,due});
    if (write(items)) render();
  });
  list.addEventListener('click', async (event) => {
    const advance = event.target.closest('[data-advance]');
    if (advance) { const items = read(); const item = items.find((entry)=>entry.id===advance.dataset.advance); if (item && confirm('Advance this schedule to the next occurrence? Only do this after saving its payment.')) { item.due=nextDate(item.due,item.cadence); if(write(items))render(); } return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { if (confirm('Remove this recurring schedule?') && write(read().filter((item)=>item.id!==remove.dataset.remove))) render(); return; }
    const pay = event.target.closest('[data-pay]'); if (!pay) return;
    const items = read(); const item = items.find((entry)=>entry.id===pay.dataset.pay); if (!item) return;
    if (item.due > dateToday()) return alert('This payment is scheduled for a future date. Review it when due.');
    if (!confirm(`Record ${item.name} for ₱${item.amount} dated ${item.due}?`)) return;
    // Use the existing validated transaction form and save flow, not direct storage writes.
    document.querySelector('[data-open-dialog]')?.click();
    const dialog = document.querySelector('#transaction-dialog');
    if (!dialog?.open) { alert('Open Add transaction and enter this payment manually.'); return; }
    const form = document.querySelector('#transaction-form');
    const type = form.querySelector(`[name="type"][value="${item.type}"]`);
    if (type) { type.checked=true; type.dispatchEvent(new Event('change',{bubbles:true})); }
    form.elements.namedItem('name').value=item.name;
    form.elements.namedItem('amount').value=item.amount;
    form.elements.namedItem('date').value=item.due;
    const categorySelect=form.elements.namedItem('category');
    if ([...categorySelect.options].some((option)=>option.value===item.category)) categorySelect.value=item.category;
    alert('Review and save the prefilled transaction. After saving, use Advance schedule to move its due date.');
  });
  document.querySelector('#perfi-setup').addEventListener('click',()=>{
    alert('Getting started with Perfi:\n\n1. Click Add transaction and record your income.\n2. Click Manage beside Monthly budgets to set spending limits.\n3. Add your first expense.\n4. Create a recurring schedule for rent or bills.\n5. Check the account banner to confirm whether your data is saved on this device or synced.');
  });
  render();
})();
