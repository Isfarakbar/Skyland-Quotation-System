// ============================================
// SKYLAND ENERGY — Products Page
// ============================================
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../db/database.js';
import { formatCurrency, CATEGORY_LABELS, matchesSearch, debounce, escapeHtml } from '../utils/helpers.js';
import { hasPermission, uploadImage } from '../auth.js';
import { createIcon } from '../components/icons.js';
import { openModal, closeModal } from '../components/modal.js';
import { showConfirm } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { toggleMobileSidebar } from '../components/sidebar.js';

let currentCategory = 'all';
let searchQuery = '';

export async function renderProducts() {
  const container = document.getElementById('page-content');
  const products = await getAllProducts();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-btn">${createIcon('menu')}</button>
        <div>
          <h1 class="page-title">Product Catalog</h1>
          <p class="page-subtitle">${products.length} reusable catalog items · prices only, no stock tracking</p>
        </div>
      </div>
      <div class="page-header-right">
        ${hasPermission('products_manage') ? `<button class="btn btn-primary" id="add-product-btn">
          ${createIcon('plus')} Add Product
        </button>` : ''}
      </div>
    </div>

    <div class="page-body">
      <!-- Toolbar -->
      <div class="page-toolbar">
        <div class="page-toolbar-left">
          <div class="search-input-wrapper">
            ${createIcon('search')}
            <input type="text" class="search-input" placeholder="Search products..." id="product-search" value="${escapeHtml(searchQuery)}" />
          </div>
          <div class="tab-filters" id="category-filters">
            <button class="tab-filter ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">All</button>
            <button class="tab-filter ${currentCategory === 'solar-panel' ? 'active' : ''}" data-cat="solar-panel">Solar Panels</button>
            <button class="tab-filter ${currentCategory === 'inverter' ? 'active' : ''}" data-cat="inverter">Inverters</button>
            <button class="tab-filter ${currentCategory === 'battery' ? 'active' : ''}" data-cat="battery">Batteries</button>
            <button class="tab-filter ${currentCategory === 'structure' ? 'active' : ''}" data-cat="structure">Structures</button>
            <button class="tab-filter ${currentCategory === 'cable' ? 'active' : ''}" data-cat="cable">Cables</button>
            <button class="tab-filter ${currentCategory === 'accessory' ? 'active' : ''}" data-cat="accessory">Accessories</button>
            <button class="tab-filter ${currentCategory === 'service' ? 'active' : ''}" data-cat="service">Services</button>
            <button class="tab-filter ${currentCategory === 'other' ? 'active' : ''}" data-cat="other">Other</button>
          </div>
        </div>
      </div>

      <!-- Products Grid -->
      <div class="products-grid" id="products-grid">
        ${renderProductGrid(products)}
      </div>
    </div>
  `;

  // Events
  container.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  container.querySelector('#add-product-btn')?.addEventListener('click', () => openProductForm());

  // Search
  container.querySelector('#product-search')?.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value;
    filterProducts(products);
  }, 200));

  // Category filters
  container.querySelector('#category-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-filter');
    if (!btn) return;
    currentCategory = btn.dataset.cat;
    container.querySelectorAll('.tab-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterProducts(products);
  });

  // Card actions
  bindCardActions(container);
}

function renderProductGrid(products) {
  const filtered = products.filter(p => {
    if (currentCategory !== 'all' && p.category !== currentCategory) return false;
    return matchesSearch(p, searchQuery, ['name', 'brand', 'model', 'category']);
  });

  if (filtered.length === 0) {
    return `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">${createIcon('package', 48)}</div>
        <h4 class="empty-state-title">No products found</h4>
        <p class="empty-state-text">${searchQuery ? 'Try a different search term' : 'Add your first product to get started'}</p>
      </div>
    `;
  }

  return filtered.map(p => `
    <div class="card card-elevated product-card animate-fade-in" data-id="${escapeHtml(p.id)}">
      ${p.image ? `
        <div class="product-card-image">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />
        </div>
      ` : `
        <div class="product-card-image-placeholder">
          ${createIcon(p.category === 'solar-panel' ? 'solar-panel' : p.category === 'battery' ? 'battery' : 'package', 40)}
        </div>
      `}
      <span class="badge badge-category">${escapeHtml(CATEGORY_LABELS[p.category] || p.category)}</span>
      <h4 class="product-card-name">${escapeHtml(p.name)}</h4>
      <p class="product-card-brand">${escapeHtml(p.brand || '')}${p.capacity ? ` — ${escapeHtml(p.capacity)}${escapeHtml(p.capacityUnit || '')}` : ''}</p>
      <div class="product-card-footer">
        <span class="product-card-price">${formatCurrency(p.unitPrice)}</span>
        ${hasPermission('products_manage') || hasPermission('products_delete') ? `<div class="product-card-actions">
          ${hasPermission('products_manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${p.id}" data-tooltip="Edit">
            ${createIcon('edit')}
          </button>` : ''}
          ${hasPermission('products_delete') ? `<button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-id="${p.id}" data-tooltip="Delete" style="color: var(--color-danger-light);">
            ${createIcon('trash')}
          </button>` : ''}
        </div>` : ''}
      </div>
    </div>
  `).join('');
}

function filterProducts(products) {
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = renderProductGrid(products);
  bindCardActions(document.getElementById('page-content'));
}

function bindCardActions(container) {
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const products = await getAllProducts();
      const product = products.find(p => String(p.id) === btn.dataset.id);
      if (product) openProductForm(product);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Product?',
        message: 'This product will be permanently removed from your catalog.',
        confirmText: 'Delete Product',
      });
      if (confirmed) {
        try { await deleteProduct(btn.dataset.id); toast.success('Product deleted successfully'); renderProducts(); }
        catch (error) { toast.error(error.message); }
      }
    });
  });
}

function openProductForm(existingProduct = null) {
  const isEdit = !!existingProduct;
  const p = existingProduct || {};

  const formEl = document.createElement('div');
  formEl.innerHTML = `
    <form id="product-form" autocomplete="off">
      <div class="image-upload-zone ${p.image ? 'has-image' : ''}" id="image-zone">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="Product" />` : `
          <div class="image-upload-icon">${createIcon('upload', 32)}</div>
          <p class="image-upload-text">Click or drag to upload image</p>
          <p class="image-upload-hint">JPEG, PNG, WebP — Max 2MB</p>
        `}
        <input type="file" accept="image/*" id="product-image-input" />
      </div>
      <input type="hidden" id="product-image-data" value="${escapeHtml(p.image || '')}" />

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Product Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="product-name" value="${escapeHtml(p.name || '')}" placeholder="e.g., Jinko Tiger Neo 725W" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category <span class="required">*</span></label>
            <select class="form-select" id="product-category" required>
              <option value="">Select category</option>
              <option value="solar-panel" ${p.category === 'solar-panel' ? 'selected' : ''}>Solar Panel</option>
              <option value="inverter" ${p.category === 'inverter' ? 'selected' : ''}>Inverter</option>
              <option value="battery" ${p.category === 'battery' ? 'selected' : ''}>Battery</option>
              <option value="structure" ${p.category === 'structure' ? 'selected' : ''}>Structure</option>
              <option value="cable" ${p.category === 'cable' ? 'selected' : ''}>Cable</option>
              <option value="accessory" ${p.category === 'accessory' ? 'selected' : ''}>Accessory</option>
              <option value="service" ${p.category === 'service' ? 'selected' : ''}>Service</option>
              <option value="other" ${p.category === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Brand</label>
            <input type="text" class="form-input" id="product-brand" value="${escapeHtml(p.brand || '')}" placeholder="e.g., Jinko, Huawei" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Model</label>
            <input type="text" class="form-input" id="product-model" value="${escapeHtml(p.model || '')}" placeholder="e.g., Tiger Neo" />
          </div>
          <div class="form-group">
            <label class="form-label">Capacity</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" class="form-input" id="product-capacity" value="${escapeHtml(p.capacity || '')}" placeholder="e.g., 725" style="flex: 1;" />
              <select class="form-select" id="product-capacity-unit" style="width: 80px;">
                <option value="W" ${p.capacityUnit === 'W' ? 'selected' : ''}>W</option>
                <option value="kW" ${p.capacityUnit === 'kW' ? 'selected' : ''}>kW</option>
                <option value="kWh" ${p.capacityUnit === 'kWh' ? 'selected' : ''}>kWh</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Unit Price (PKR) <span class="required">*</span></label>
            <input type="number" class="form-input" id="product-price" value="${p.unitPrice || ''}" placeholder="e.g., 29725" required min="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Unit</label>
            <select class="form-select" id="product-unit">
              <option value="piece" ${p.unit === 'piece' ? 'selected' : ''}>Piece</option>
              <option value="set" ${p.unit === 'set' ? 'selected' : ''}>Set</option>
              <option value="job" ${p.unit === 'job' ? 'selected' : ''}>Job</option>
              <option value="meter" ${p.unit === 'meter' ? 'selected' : ''}>Meter</option>
            </select>
          </div>
        </div>

        <div class="form-group" id="price-per-watt-group" style="${p.category && p.category !== 'solar-panel' ? 'display:none;' : ''}">
          <label class="form-label">Price per Watt (PKR)</label>
          <input type="number" step="0.01" class="form-input" id="product-ppw" value="${p.pricePerWatt || ''}" placeholder="e.g., 41.00" />
        </div>
      </div>

      <div class="modal-footer" style="margin: 1.5rem -1.5rem -1.5rem; padding: 1rem 1.5rem;">
        <button type="button" class="btn btn-secondary" id="form-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">
          ${createIcon('save')} ${isEdit ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? 'Edit Product' : 'Add New Product',
    content: formEl,
    size: 'lg',
  });

  // Image upload handler
  const imageInput = document.getElementById('product-image-input');
  const imageZone = document.getElementById('image-zone');
  const imageDataInput = document.getElementById('product-image-data');

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.warning('Image must be under 2MB');
      return;
    }
    try {
      const uploaded = await uploadImage(file, 'products');
      imageDataInput.value = uploaded.url;
      imageZone.classList.add('has-image');
      imageZone.innerHTML = `<img src="${escapeHtml(uploaded.url)}" alt="Product" /><input type="file" accept="image/*" id="product-image-input" />`;
      imageZone.querySelector('input')?.addEventListener('change', handleImageChange);
    } catch (err) {
      toast.error('Failed to process image');
    }
  };

  imageInput?.addEventListener('change', handleImageChange);
  document.getElementById('product-category')?.addEventListener('change', (event) => {
    const group = document.getElementById('price-per-watt-group');
    if (group) group.style.display = event.target.value === 'solar-panel' ? '' : 'none';
  });

  // Cancel
  document.getElementById('form-cancel')?.addEventListener('click', closeModal);

  // Submit
  document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('product-name').value.trim(),
      category: document.getElementById('product-category').value,
      brand: document.getElementById('product-brand').value.trim(),
      model: document.getElementById('product-model').value.trim(),
      capacity: document.getElementById('product-capacity').value.trim(),
      capacityUnit: document.getElementById('product-capacity-unit').value,
      unitPrice: parseFloat(document.getElementById('product-price').value) || 0,
      unit: document.getElementById('product-unit').value,
      image: document.getElementById('product-image-data').value,
      pricePerWatt: parseFloat(document.getElementById('product-ppw')?.value) || 0,
      specifications: existingProduct?.specifications || {},
    };

    if (!data.name || !data.category) {
      toast.warning('Please fill in required fields');
      return;
    }

    try {
      if (isEdit) {
        await updateProduct(existingProduct.id, data);
        toast.success('Product updated successfully');
      } else {
        await addProduct(data);
        toast.success('Product added successfully');
      }
      closeModal();
      renderProducts();
    } catch (err) {
      toast.error('Failed to save product: ' + err.message);
    }
  });
}
