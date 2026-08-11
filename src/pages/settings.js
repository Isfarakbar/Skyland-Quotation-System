// ============================================
// SKYLAND ENERGY — Settings Page
// ============================================
import { getSetting, setSetting, exportAllData, importAllData, clearAllData } from '../db/database.js';
import { DEFAULT_TERMS, DEFAULT_SETTINGS } from '../db/seed-data.js';
import { createIcon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { showConfirm } from '../components/confirm-dialog.js';
import { toggleMobileSidebar } from '../components/sidebar.js';

export async function renderSettings() {
  const container = document.getElementById('page-content');

  const companyName = (await getSetting('companyName')) || DEFAULT_SETTINGS.companyName;
  const companyAddress = (await getSetting('companyAddress')) || DEFAULT_SETTINGS.companyAddress;
  const companyPhone = (await getSetting('companyPhone')) || '';
  const companyEmail = (await getSetting('companyEmail')) || '';
  const validityDays = (await getSetting('validityDays')) || DEFAULT_SETTINGS.validityDays;
  const advancePercent = (await getSetting('advancePercent')) || DEFAULT_SETTINGS.advancePercent;
  const exchangeRate = (await getSetting('exchangeRate')) || DEFAULT_SETTINGS.exchangeRate;
  const terms = (await getSetting('defaultTerms')) || DEFAULT_TERMS;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">System configuration and data management</p>
        </div>
      </div>
    </div>

    <div class="page-body">
      <div style="max-width: 700px;">
        <!-- Company Info -->
        <div class="card card-elevated" style="margin-bottom: 2rem;">
          <div class="card-header">
            <h3 class="card-title">Company Information</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Company Name</label>
                <input type="text" class="form-input" id="set-company-name" value="${companyName}" />
              </div>
              <div class="form-group">
                <label class="form-label">Address</label>
                <input type="text" class="form-input" id="set-company-address" value="${companyAddress}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="tel" class="form-input" id="set-company-phone" value="${companyPhone}" />
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="set-company-email" value="${companyEmail}" />
              </div>
            </div>
          </div>
        </div>

        <!-- Quotation Defaults -->
        <div class="card card-elevated" style="margin-bottom: 2rem;">
          <div class="card-header">
            <h3 class="card-title">Quotation Defaults</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Validity (Days)</label>
                <input type="number" class="form-input" id="set-validity" value="${validityDays}" />
              </div>
              <div class="form-group">
                <label class="form-label">Advance Payment %</label>
                <input type="number" class="form-input" id="set-advance" value="${advancePercent}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Exchange Rate (USD/PKR)</label>
              <input type="number" class="form-input" id="set-exchange" value="${exchangeRate}" style="max-width: 200px;" />
            </div>
          </div>
        </div>

        <!-- Default Terms -->
        <div class="card card-elevated" style="margin-bottom: 2rem;">
          <div class="card-header">
            <h3 class="card-title">Default Terms & Conditions</h3>
          </div>
          <textarea class="form-textarea" id="set-terms" style="min-height: 250px; font-size: 0.8rem;">${(Array.isArray(terms) ? terms : DEFAULT_TERMS).map((t, i) => `${i + 1}. ${t}`).join('\n')}</textarea>
        </div>

        <div style="margin-bottom: 2rem;">
          <button class="btn btn-primary btn-lg w-full" id="save-settings-btn">
            ${createIcon('save')} Save Settings
          </button>
        </div>

        <!-- Data Management -->
        <div class="card card-elevated" style="margin-bottom: 2rem;">
          <div class="card-header">
            <h3 class="card-title">Data Management</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <button class="btn btn-secondary" id="export-btn">
                ${createIcon('download')} Export All Data (JSON)
              </button>
              <button class="btn btn-secondary" id="import-btn">
                ${createIcon('upload')} Import Data
              </button>
              <input type="file" id="import-file" accept=".json" style="display: none;" />
            </div>
            <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
              <button class="btn btn-danger" id="clear-btn">
                ${createIcon('trash')} Clear All Data
              </button>
              <p class="form-hint" style="margin-top: 0.5rem;">⚠️ This permanently deletes all products, customers, and quotations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

  // Save settings
  container.querySelector('#save-settings-btn')?.addEventListener('click', async () => {
    await setSetting('companyName', document.getElementById('set-company-name').value);
    await setSetting('companyAddress', document.getElementById('set-company-address').value);
    await setSetting('companyPhone', document.getElementById('set-company-phone').value);
    await setSetting('companyEmail', document.getElementById('set-company-email').value);
    await setSetting('validityDays', parseInt(document.getElementById('set-validity').value) || 5);
    await setSetting('advancePercent', parseInt(document.getElementById('set-advance').value) || 20);
    await setSetting('exchangeRate', parseFloat(document.getElementById('set-exchange').value) || 285);

    const termsText = document.getElementById('set-terms').value;
    const termsArray = termsText.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    await setSetting('defaultTerms', termsArray);

    toast.success('Settings saved');
  });

  // Export
  container.querySelector('#export-btn')?.addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skyland-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  });

  // Import
  container.querySelector('#import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  container.querySelector('#import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmed = await showConfirm({
      title: 'Import Data?',
      message: 'This will replace ALL existing data. Make sure you have a backup.',
      confirmText: 'Import',
      type: 'warning',
    });

    if (confirmed) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllData(data);
        toast.success('Data imported successfully');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        toast.error('Invalid file: ' + err.message);
      }
    }
  });

  // Clear
  container.querySelector('#clear-btn')?.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Clear ALL Data?',
      message: 'This will permanently delete ALL products, customers, quotations, and settings. This cannot be undone!',
      confirmText: 'Yes, Delete Everything',
      type: 'danger',
    });

    if (confirmed) {
      const doubleConfirm = await showConfirm({
        title: 'Are you REALLY sure?',
        message: 'Last chance! All data will be lost forever.',
        confirmText: 'Delete Everything',
        type: 'danger',
      });

      if (doubleConfirm) {
        await clearAllData();
        toast.success('All data cleared');
        setTimeout(() => location.reload(), 1000);
      }
    }
  });
}
