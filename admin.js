const ordersBody = document.getElementById('orders-body');
const refreshButton = document.getElementById('refresh-orders');
const logoutButton = document.getElementById('logout');

const statuses = [
  'created',
  'payment_created',
  'paid',
  'pending_payphone_config',
  'payment_error',
  'cancelled',
  'contacted'
];

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersBody.innerHTML = '<tr><td colspan="5">Todavía no hay órdenes.</td></tr>';
    return;
  }

  ordersBody.innerHTML = orders.map(order => `
    ${(() => {
      const cardLabel = order.cardType === 'debit'
        ? 'Débito'
        : order.creditPlan === 'deferred'
          ? `Crédito diferido ${order.installments} meses`
          : 'Crédito corriente';
      return `
    <tr>
      <td>
        <strong>${escapeHtml(order.id.slice(0, 8))}</strong><br>
        ${escapeHtml(formatDate(order.createdAt))}
      </td>
      <td>
        <strong>${escapeHtml(order.buyer)}</strong><br>
        Edad: ${escapeHtml(order.age)}<br>
        ${escapeHtml(order.phone || '')}<br>
        ${escapeHtml(order.email || '')}
      </td>
      <td>
        <strong>${escapeHtml(order.planName)}</strong><br>
        ${escapeHtml(order.amountLabel)} · ${escapeHtml(order.studyMonths || '')} meses<br>
        Ahorro: ${escapeHtml(order.savingsLabel || '$0.00')}
      </td>
      <td>
        ${escapeHtml(order.interest)}<br>
        ${escapeHtml(order.schedule)}<br>
        ${escapeHtml(order.paymentMethod)}<br>
        ${escapeHtml(cardLabel)}
      </td>
      <td>
        <span class="status-pill" data-status="${escapeHtml(order.status)}">${escapeHtml(order.status)}</span><br><br>
        <select class="status-select" data-order-id="${escapeHtml(order.id)}">
          ${statuses.map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </td>
    </tr>
      `;
    })()}
  `).join('');
}

function loadOrders() {
  fetch('/api/admin/orders')
    .then(async response => {
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = '/login.html';
        return null;
      }
      if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las órdenes.');
      return data.orders;
    })
    .then(orders => {
      if (orders) renderOrders(orders);
    })
    .catch(error => {
      ordersBody.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
    });
}

ordersBody?.addEventListener('change', event => {
  const select = event.target.closest('.status-select');
  if (!select) return;

  fetch(`/api/admin/orders/${select.dataset.orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: select.value })
  })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo actualizar la orden.');
      loadOrders();
    })
    .catch(error => {
      alert(error.message);
      loadOrders();
    });
});

refreshButton?.addEventListener('click', loadOrders);

logoutButton?.addEventListener('click', () => {
  fetch('/api/admin/logout', { method: 'POST' }).finally(() => {
    window.location.href = '/login.html';
  });
});

loadOrders();
