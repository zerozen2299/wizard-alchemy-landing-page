/* ============================================================
   wizard alchemy — script.js
   ใช้ร่วมกันทุกหน้า: product.html / order.html / admin.html
   ============================================================ */

const APPS_SCRIPT_URL = '[APPS_SCRIPT_URL]';
const CSV_URL         = '[CSV_URL]';

/* ------------------------------------------------------------
   ยูทิลิตี้
   ------------------------------------------------------------ */

function getParams() {
  return new URLSearchParams(window.location.search);
}

/* ------------------------------------------------------------
   1. หน้า product.html
   ------------------------------------------------------------ */

function initProductPage() {
  const filterBar   = document.getElementById('filter-bar');
  const productList = document.getElementById('product-list');

  if (!filterBar || !productList) return;

  const MOOD_LABEL = {
    all:     'ทั้งหมด',
    fresh:   'Fresh',
    relax:   'Relax',
    focus:   'Focus',
    romance: 'Romance',
  };

  let products  = [];
  let activeMood = getParams().get('mood') || 'all';

  /* ---- สร้างปุ่มกรอง ---- */
  Object.entries(MOOD_LABEL).forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.dataset.mood = key;
    btn.setAttribute('aria-pressed', key === activeMood ? 'true' : 'false');

    if (key !== 'all') {
      const dot = document.createElement('span');
      dot.className = `dot dot--${key}`;
      btn.appendChild(dot);
    }

    btn.appendChild(document.createTextNode(label));
    btn.addEventListener('click', () => setFilter(key));
    filterBar.appendChild(btn);
  });

  /* ---- โหลดสินค้า ---- */
  fetch('products.json')
    .then(r => r.json())
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(() => {
      productList.innerHTML = '<p class="empty">ไม่สามารถโหลดข้อมูลสินค้าได้</p>';
    });

  /* ---- กรองและแสดงการ์ด ---- */
  function setFilter(mood) {
    activeMood = mood;
    filterBar.querySelectorAll('.chip').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.mood === mood ? 'true' : 'false');
    });
    renderProducts();
  }

  function renderProducts() {
    const list = activeMood === 'all'
      ? products
      : products.filter(p => p.mood === activeMood);

    if (list.length === 0) {
      productList.innerHTML = '<p class="empty">ไม่พบสินค้าในหมวดนี้</p>';
      return;
    }

    productList.innerHTML = '';

    list.forEach(p => {
      const card = document.createElement('article');
      card.className = `card mood-${p.mood}`;

      /* ตั้งค่า URL สำหรับหน้าสั่งซื้อ */
      const orderURL = `order.html?item=${encodeURIComponent(p.name + ' ' + p.size)}&price=${encodeURIComponent(p.price)}`;

      card.innerHTML = `
        <div class="card__media">
          <img src="${p.image}" alt="${p.name}" loading="lazy"
               onerror="this.style.visibility='hidden'">
        </div>
        <div class="card__mood">
          <span class="dot dot--${p.mood}"></span>${p.mood.charAt(0).toUpperCase() + p.mood.slice(1)}
        </div>
        <h3 class="card__name">${p.name}</h3>
        <p class="card__desc">${p.description}</p>
        <div class="card__meta">
          <span class="card__size">${p.size}</span>
          <span class="card__price">${p.price.toLocaleString()}<span>฿</span></span>
        </div>
        <a class="btn btn--full" href="${orderURL}">สั่งซื้อ</a>
      `;

      productList.appendChild(card);
    });
  }
}

/* ------------------------------------------------------------
   2. หน้า order.html
   ------------------------------------------------------------ */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  /* ---- เติมข้อมูลสินค้าจาก URL ---- */
  const params = getParams();
  const itemValue  = params.get('item')  || '';
  const priceValue = params.get('price') || '';

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  if (itemsInput && itemValue)  itemsInput.value = itemValue;
  if (totalInput && priceValue) totalInput.value = priceValue;

  /* ---- ส่งฟอร์ม ---- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = 'กำลังส่ง…';
    }

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact:      document.getElementById('contact').value.trim(),
      items:        document.getElementById('items').value.trim(),
      total:        document.getElementById('total').value.trim(),
      note:         document.getElementById('note').value.trim(),
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) {
          submitBtn.disabled    = false;
          submitBtn.textContent = 'ยืนยันสั่งซื้อ';
        }
      });
  });
}

/* ------------------------------------------------------------
   3. หน้า admin.html
   ------------------------------------------------------------ */

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  /* ---- parse CSV เอง (รองรับ field ที่มี comma อยู่ใน quote) ---- */
  function parseCSV(text) {
    const rows   = [];
    const lines  = text.trim().split('\n');

    lines.forEach(line => {
      const fields = [];
      let cur      = '';
      let inQuote  = false;

      for (let i = 0; i < line.length; i++) {
        const ch   = line[i];
        const next = line[i + 1];

        if (inQuote) {
          if (ch === '"' && next === '"') { cur += '"'; i++; }     // escaped quote
          else if (ch === '"')            { inQuote = false; }
          else                            { cur += ch; }
        } else {
          if      (ch === '"') { inQuote = true; }
          else if (ch === ',') { fields.push(cur.trim()); cur = ''; }
          else                 { cur += ch; }
        }
      }
      fields.push(cur.trim());
      rows.push(fields);
    });

    return rows;
  }

  /* ---- แสดงสถานะโหลด ---- */
  tbody.innerHTML = '<tr><td colspan="6" class="empty">กำลังโหลดข้อมูล…</td></tr>';

  fetch(CSV_URL)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(text => {
      const rows = parseCSV(text);

      /* ข้ามแถวหัวตาราง (แถวแรก) แล้วกลับลำดับให้ล่าสุดขึ้นก่อน */
      const dataRows = rows.slice(1).reverse();

      if (dataRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีรายการสั่งซื้อ</td></tr>';
        return;
      }

      tbody.innerHTML = '';

      dataRows.forEach(cols => {
        const tr = document.createElement('tr');
        /* คอลัมน์ใน Sheet: A=วันเวลา B=ชื่อ C=ติดต่อ D=สินค้า E=รวม F=หมายเหตุ */
        const cells = [
          cols[0] || '',   // วันเวลา
          cols[1] || '',   // ชื่อลูกค้า
          cols[2] || '',   // เบอร์โทร/Line
          cols[3] || '',   // รายการสินค้า
          cols[4] || '',   // จำนวนเงิน
          cols[5] || '',   // หมายเหตุ
        ];

        cells.forEach(val => {
          const td       = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="6" class="empty">ไม่สามารถโหลดข้อมูลได้</td></tr>';
    });
}

/* ------------------------------------------------------------
   เริ่มต้น: ตรวจว่าอยู่หน้าไหน
   ------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
