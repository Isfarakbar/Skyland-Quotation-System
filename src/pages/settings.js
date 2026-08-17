import { getSetting, setSetting, exportAllData, importAllData, clearAllData } from '../db/database.js';
import { DEFAULT_TERMS, DEFAULT_SETTINGS } from '../db/seed-data.js';
import { createIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { showConfirm } from '../components/confirm-dialog.js';
import { toggleMobileSidebar } from '../components/sidebar.js';
import { hasRole } from '../auth.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderSettings() {
  const container = document.getElementById('page-content');
  const canManageCompany = hasRole('super_admin', 'admin');
  const canImport = hasRole('super_admin', 'admin');
  const canClear = hasRole('super_admin');
  const read = async (key, fallback = '') => (await getSetting(key)) ?? fallback;
  const [companyName, companyAddress, companyPhone, companyWhatsapp, companyEmail, companyWebsite, companyTagline, companyCredentials, validityDays, advancePercent, exchangeRate, terms] = await Promise.all([
    read('companyName', DEFAULT_SETTINGS.companyName), read('companyAddress', DEFAULT_SETTINGS.companyAddress),
    read('companyPhone'), read('companyWhatsapp', DEFAULT_SETTINGS.companyWhatsapp), read('companyEmail'),
    read('companyWebsite', DEFAULT_SETTINGS.companyWebsite), read('companyTagline', DEFAULT_SETTINGS.companyTagline),
    read('companyCredentials', DEFAULT_SETTINGS.companyCredentials), read('validityDays', DEFAULT_SETTINGS.validityDays),
    read('advancePercent', DEFAULT_SETTINGS.advancePercent), read('exchangeRate', DEFAULT_SETTINGS.exchangeRate),
    read('defaultTerms', DEFAULT_TERMS),
  ]);

  const field = (label, id, value, type = 'text') => `<div class="form-group"><label class="form-label">${label}</label><input type="${type}" class="form-input" id="${id}" value="${escapeHtml(value)}" /></div>`;
  const companyCard = canManageCompany ? `
    <div class="card card-elevated" style="margin-bottom:2rem">
      <div class="card-header"><h3 class="card-title">Company Information</h3></div>
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="form-row">${field('Company Name', 'set-company-name', companyName)}${field('Address', 'set-company-address', companyAddress)}</div>
        <div class="form-row">${field('WhatsApp', 'set-company-whatsapp', companyWhatsapp, 'tel')}${field('Website', 'set-company-website', companyWebsite, 'url')}</div>
        <div class="form-row">${field('Tagline', 'set-company-tagline', companyTagline)}${field('Credentials', 'set-company-credentials', companyCredentials)}</div>
        <div class="form-row">${field('Phone', 'set-company-phone', companyPhone, 'tel')}${field('Email', 'set-company-email', companyEmail, 'email')}</div>
      </div>
    </div>` : `<div class="card" style="margin-bottom:2rem"><strong>Manager access</strong><p class="form-hint" style="margin-top:.35rem">You can maintain quotation defaults. Company identity and system data are controlled by administrators.</p></div>`;

  container.innerHTML = `
    <div class="page-header"><div class="page-header-left"><button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button><div><h1 class="page-title">Settings</h1><p class="page-subtitle">System configuration and data management</p></div></div></div>
    <div class="page-body"><div style="max-width:700px">
      ${companyCard}
      <div class="card card-elevated" style="margin-bottom:2rem">
        <div class="card-header"><h3 class="card-title">Quotation Defaults</h3></div>
        <div style="display:flex;flex-direction:column;gap:1rem">
          <div class="form-row">${field('Validity (Days)', 'set-validity', validityDays, 'number')}${field('Advance Payment %', 'set-advance', advancePercent, 'number')}</div>
          <div class="form-group"><label class="form-label">Exchange Rate (USD/PKR)</label><input type="number" class="form-input" id="set-exchange" value="${escapeHtml(exchangeRate)}" style="max-width:200px" /></div>
        </div>
      </div>
      <div class="card card-elevated" style="margin-bottom:2rem"><div class="card-header"><h3 class="card-title">Default Terms & Conditions</h3></div><textarea class="form-textarea" id="set-terms" style="min-height:250px;font-size:.8rem">${escapeHtml((Array.isArray(terms) ? terms : DEFAULT_TERMS).map((term, index) => `${index + 1}. ${term}`).join('\n'))}</textarea></div>
      <div style="margin-bottom:2rem"><button class="btn btn-primary btn-lg w-full" id="save-settings-btn">${createIcon('save')} Save Settings</button></div>
      <div class="card card-elevated" style="margin-bottom:2rem">
        <div class="card-header"><h3 class="card-title">Data Management</h3></div>
        <div style="display:flex;flex-direction:column;gap:1rem"><div style="display:flex;gap:1rem;flex-wrap:wrap">
          <button class="btn btn-secondary" id="export-btn">${createIcon('download')} Export All Data (JSON)</button>
          ${canImport ? `<button class="btn btn-secondary" id="import-btn">${createIcon('upload')} Import Data</button><input type="file" id="import-file" accept=".json" hidden />` : ''}
        </div>${canClear ? `<div style="border-top:1px solid var(--border-color);padding-top:1rem"><button class="btn btn-danger" id="clear-btn">${createIcon('trash')} Clear All Data</button><p class="form-hint" style="margin-top:.5rem">This permanently deletes all products, customers, and quotations. Settings and user accounts are retained.</p></div>` : ''}</div>
      </div>
    </div></div>`;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelector('#save-settings-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (canManageCompany) {
        await Promise.all([
          ['companyName', 'set-company-name'], ['companyAddress', 'set-company-address'], ['companyPhone', 'set-company-phone'],
          ['companyWhatsapp', 'set-company-whatsapp'], ['companyEmail', 'set-company-email'], ['companyWebsite', 'set-company-website'],
          ['companyTagline', 'set-company-tagline'], ['companyCredentials', 'set-company-credentials'],
        ].map(([key, id]) => setSetting(key, document.getElementById(id).value)));
      }
      const termsArray = document.getElementById('set-terms').value.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      await Promise.all([
        setSetting('validityDays', parseInt(document.getElementById('set-validity').value, 10) || 5),
        setSetting('advancePercent', parseInt(document.getElementById('set-advance').value, 10) || 20),
        setSetting('exchangeRate', parseFloat(document.getElementById('set-exchange').value) || 285),
        setSetting('defaultTerms', termsArray),
      ]);
      toast.success('Settings saved');
    } catch (error) { toast.error(error.message); } finally { button.disabled = false; }
  });

  container.querySelector('#export-btn')?.addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = Object.assign(document.createElement('a'), { href: url, download: `skyland-backup-${new Date().toISOString().slice(0, 10)}.json` });
      anchor.click(); URL.revokeObjectURL(url); toast.success('Data exported successfully');
    } catch (error) { toast.error(error.message); }
  });
  container.querySelector('#import-btn')?.addEventListener('click', () => document.getElementById('import-file').click());
  container.querySelector('#import-file')?.addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file || !(await showConfirm({ title: 'Import Data?', message: 'This adds backup records to existing data. Duplicate quotation references will be rejected.', confirmText: 'Import', type: 'warning' }))) return;
    try { await importAllData(JSON.parse(await file.text())); toast.success('Data imported successfully'); setTimeout(() => location.reload(), 1000); }
    catch (error) { toast.error(`Import failed: ${error.message}`); }
  });
  container.querySelector('#clear-btn')?.addEventListener('click', async () => {
    const first = await showConfirm({ title: 'Clear all quotation data?', message: 'This permanently deletes products, customers, and quotations. Settings and users remain.', confirmText: 'Continue', type: 'danger' });
    if (!first) return;
    const second = await showConfirm({ title: 'Final confirmation', message: 'This operation cannot be undone. Export a backup first if needed.', confirmText: 'Delete Everything', type: 'danger' });
    if (!second) return;
    try { await clearAllData(); toast.success('Quotation data cleared'); setTimeout(() => location.reload(), 1000); }
    catch (error) { toast.error(error.message); }
  });
}
