const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = [...document.querySelectorAll('.main-nav a[href^="#"]')];

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!open));
  navToggle.classList.toggle('is-open', !open);
  mainNav.classList.toggle('is-open', !open);
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.classList.remove('is-open');
    mainNav?.classList.remove('is-open');
  });
});

window.addEventListener('scroll', () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 10);
}, { passive: true });

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal').forEach(item => revealObserver.observe(item));

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const node = entry.target;
    const target = Number(node.dataset.count || 0);
    const duration = 1300;
    const start = performance.now();

    const update = now => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(target * eased).toLocaleString('es-EC');
      if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
    counterObserver.unobserve(node);
  });
}, { threshold: 0.55 });

document.querySelectorAll('[data-count]').forEach(item => counterObserver.observe(item));

const sections = [...document.querySelectorAll('main section[id]')];
const activeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
    });
  });
}, { rootMargin: '-35% 0px -55% 0px' });
sections.forEach(section => activeObserver.observe(section));

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.program-card, .price-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -6;
      card.style.transform = `translateY(-6px) rotateX(${y}deg) rotateY(${x}deg)`;
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}

const whatsappForm = document.getElementById('whatsapp-form');
whatsappForm?.addEventListener('submit', event => {
  event.preventDefault();
  const name = document.getElementById('contact-name').value.trim();
  const interest = document.getElementById('contact-interest').value;
  const message = `Hola GeniosBot, soy ${name}. Quiero información sobre ${interest}.`;
  window.open(`https://wa.me/593993072653?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

const selectedPlan = {
  id: 'trimestre_3',
  name: 'Formación trimestral',
  price: '$255',
  type: '3 meses de estudio',
  months: '3 meses',
  saving: '$15',
  progress: '48'
};

const selectedPlanName = document.getElementById('selected-plan');
const selectedPlanPrice = document.getElementById('selected-price');
const selectedPlanType = document.getElementById('selected-type');
const selectedMonths = document.getElementById('selected-months');
const selectedTotal = document.getElementById('selected-total');
const selectedSaving = document.getElementById('selected-saving');
const selectedProgressLabel = document.getElementById('selected-progress-label');
const selectedProgressBar = document.getElementById('selected-progress-bar');
const checkoutForm = document.getElementById('checkout-form');
const checkoutSubmit = document.getElementById('checkout-submit');
const checkoutMessage = document.getElementById('checkout-message');
const paymentPreview = document.getElementById('payment-preview');
const creditOptions = document.getElementById('credit-options');
const installmentsField = document.getElementById('installments-field');
const installmentsSelect = document.getElementById('checkout-installments');

const getCheckedValue = name => document.querySelector(`input[name="${name}"]:checked`)?.value;

const updatePaymentOptions = () => {
  const cardType = getCheckedValue('cardType');
  const creditPlan = getCheckedValue('creditPlan');
  const installments = installmentsSelect?.value || '3';
  const isCredit = cardType === 'credit';
  const isDeferred = isCredit && creditPlan === 'deferred';

  creditOptions.hidden = !isCredit;
  installmentsField.hidden = !isDeferred;

  const title = cardType === 'debit'
    ? 'Débito'
    : isDeferred
      ? `Crédito diferido a ${installments} meses`
      : 'Crédito corriente';

  paymentPreview.querySelector('strong').textContent = title;
  paymentPreview.querySelector('span').textContent = isDeferred
    ? 'PayPhone procesará el diferido según tu banco.'
    : 'Pago seguro con PayPhone';
};

const updateSelectedPlan = planCard => {
  selectedPlan.id = planCard.dataset.planId;
  selectedPlan.name = planCard.dataset.plan;
  selectedPlan.price = planCard.dataset.price;
  selectedPlan.type = planCard.dataset.type;
  selectedPlan.months = planCard.dataset.months;
  selectedPlan.saving = planCard.dataset.saving;
  selectedPlan.progress = planCard.dataset.progress;

  selectedPlanName.textContent = selectedPlan.name;
  selectedPlanPrice.textContent = selectedPlan.price;
  selectedPlanType.textContent = selectedPlan.type;
  selectedMonths.textContent = selectedPlan.months;
  selectedTotal.textContent = selectedPlan.price;
  selectedSaving.textContent = selectedPlan.saving;
  selectedProgressLabel.textContent = `${selectedPlan.progress}%`;
  selectedProgressBar.style.width = `${selectedPlan.progress}%`;

  if (['semestre_6', 'anual_12'].includes(selectedPlan.id)) {
    document.querySelector('input[name="cardType"][value="credit"]').checked = true;
    document.querySelector('input[name="creditPlan"][value="deferred"]').checked = true;
    installmentsSelect.value = selectedPlan.id === 'anual_12' ? '12' : '6';
    updatePaymentOptions();
  }

  document.querySelectorAll('.price-card').forEach(card => {
    card.classList.toggle('is-selected', card === planCard);
  });
};

document.querySelectorAll('.buy-button').forEach(button => {
  button.addEventListener('click', () => {
    const card = button.closest('.price-card');
    updateSelectedPlan(card);
    checkoutForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('buyer-name')?.focus({ preventScroll: true });
  });
});

document.querySelectorAll('input[name="cardType"], input[name="creditPlan"]').forEach(input => {
  input.addEventListener('change', updatePaymentOptions);
});
installmentsSelect?.addEventListener('change', updatePaymentOptions);
updatePaymentOptions();

checkoutForm?.addEventListener('submit', event => {
  event.preventDefault();
  const buyer = document.getElementById('buyer-name').value.trim();
  const age = document.getElementById('student-age').value;
  const interest = document.getElementById('checkout-interest').value;
  const schedule = document.getElementById('checkout-schedule').value;
  const payment = document.getElementById('checkout-payment').value;
  const phone = document.getElementById('buyer-phone').value.trim();
  const email = document.getElementById('buyer-email').value.trim();
  const cardType = getCheckedValue('cardType');
  const creditPlan = getCheckedValue('creditPlan');
  const installments = creditPlan === 'deferred' ? installmentsSelect.value : '';

  checkoutSubmit.disabled = true;
  checkoutSubmit.textContent = 'Creando pago...';
  checkoutMessage.textContent = 'Estamos preparando tu orden segura.';
  checkoutMessage.classList.remove('is-error');

  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: selectedPlan.id,
      buyer,
      age,
      interest,
      schedule,
      payment,
      cardType,
      creditPlan,
      installments,
      phone,
      email
    })
  })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo crear el pago.');
      return data;
    })
    .then(data => {
      if (data.paymentUrl) {
        checkoutMessage.textContent = 'Pago creado. Te estamos llevando a PayPhone.';
        window.location.href = data.paymentUrl;
        return;
      }

      checkoutMessage.textContent = data.message || `Orden ${data.orderId} creada. Falta configurar PayPhone.`;
    })
    .catch(error => {
      checkoutMessage.textContent = error.message;
      checkoutMessage.classList.add('is-error');
    })
    .finally(() => {
      checkoutSubmit.disabled = false;
      checkoutSubmit.textContent = 'Pagar con PayPhone';
    });
});

document.querySelector('.price-card--featured')?.classList.add('is-selected');
document.getElementById('year').textContent = new Date().getFullYear();
