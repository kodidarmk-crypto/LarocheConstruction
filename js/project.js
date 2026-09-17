(() => {
  const form = document.querySelector('#project-quiz');
  if (!form) return;
  const steps = [...form.querySelectorAll('.quiz-step')];
  const next = document.querySelector('#quiz-next');
  const previous = document.querySelector('#quiz-prev');
  const progressBar = document.querySelector('#quiz-progress-bar');
  const stepLabel = document.querySelector('#quiz-step-label');
  const summary = document.querySelector('#project-summary');
  const results = document.querySelector('#plan-results');
  const leadStatus = document.querySelector('#lead-status');
  const leadConfirmation = document.querySelector('#lead-confirmation');
  const choosePlan = document.querySelector('#choose-plan');
  const projectPlanResults = document.querySelector('#project-plan-results');
  const budgetInput = document.querySelector('#project-budget');
  const quizActions = document.querySelector('.quiz-actions');
  let currentStep = 0;
  let currentBudget = 0;
  const baseBudget = { residential: 18000000, commercial: 30000000, industrial: 45000000, renovation: 12000000, civil: 28000000, management: 8000000 };
  const surfaceFactor = { 'under-100': 0, '100-200': 8000000, '200-300': 19000000, 'over-300': 32000000 };
  const finishFactor = { essential: 0, comfort: 9000000, premium: 22000000 };
  const locationFactor = { douala: 0, 'other-cameroon': 3500000, other: 9000000 };
  const serviceParameters = {
    residential: {
      title: 'Paramétrez votre résidence',
      help: 'Précisez les pièces essentielles de votre future maison.',
      groups: [
        ['bedrooms', 'Nombre de chambres', [['1-2', '1 à 2 chambres', 0], ['3', '3 chambres', 2000000], ['4-plus', '4 chambres ou plus', 5000000]]],
        ['bathrooms', 'Nombre de douches / toilettes', [['1-2', '1 à 2', 0], ['3', '3', 1500000], ['4-plus', '4 ou plus', 3000000]]],
        ['main-room', 'Pièce principale', [['living', 'Séjour / salon', 0], ['living-dining', 'Séjour et salle à manger', 1500000], ['open-plan', 'Grande pièce ouverte', 3000000]]]
      ]
    },
    commercial: {
      title: 'Paramétrez votre bâtiment commercial',
      help: 'Décrivez l’usage et l’organisation de votre espace professionnel.',
      groups: [
        ['activity', 'Type d’activité', [['office', 'Bureaux', 0], ['retail', 'Commerce / boutique', 2500000], ['hospitality', 'Restaurant / hôtellerie', 5000000]]],
        ['commercial-levels', 'Nombre de niveaux', [['one', 'Un niveau', 0], ['two', 'Deux niveaux', 4000000], ['multi', 'Trois niveaux ou plus', 9000000]]],
        ['parking', 'Stationnement', [['none', 'Sans parking dédié', 0], ['standard', 'Parking standard', 1500000], ['large', 'Parking important', 4000000]]]
      ]
    },
    industrial: {
      title: 'Paramétrez votre projet industriel',
      help: 'Indiquez les grandes contraintes de votre site industriel.',
      groups: [
        ['industrial-use', 'Type de bâtiment', [['warehouse', 'Entrepôt / stockage', 0], ['workshop', 'Atelier / production', 6000000], ['technical', 'Bâtiment technique', 10000000]]],
        ['industrial-levels', 'Organisation', [['single', 'Plain-pied', 0], ['mixed', 'Niveaux ou mezzanine', 7000000]]],
        ['industrial-constraint', 'Contrainte principale', [['structure', 'Structure et portée', 3000000], ['logistics', 'Flux et logistique', 5000000], ['security', 'Sécurité et normes', 6000000]]]
      ]
    },
    renovation: {
      title: 'Paramétrez votre rénovation',
      help: 'Précisez le bâtiment existant et l’ampleur des travaux.',
      groups: [
        ['renovation-building', 'Bâtiment à rénover', [['house', 'Maison / villa', 0], ['apartment', 'Appartement', 1500000], ['commercial-building', 'Local commercial', 3500000]]],
        ['renovation-scope', 'Nature des travaux', [['interior', 'Intérieur uniquement', 0], ['complete', 'Intérieur et extérieur', 5000000], ['extension', 'Extension ou redistribution', 9000000]]],
        ['renovation-state', 'État du bâtiment', [['light', 'Rénovation légère', 0], ['heavy', 'Rénovation lourde', 7000000]]]
      ]
    },
    civil: {
      title: 'Paramétrez votre projet de génie civil',
      help: 'Décrivez l’infrastructure et les travaux à prévoir.',
      groups: [
        ['civil-work', 'Type d’ouvrage', [['foundation', 'Fondations / terrassement', 0], ['road', 'Route / voirie', 7000000], ['network', 'Réseaux / assainissement', 5000000]]],
        ['civil-terrain', 'Nature du terrain', [['accessible', 'Terrain accessible', 0], ['difficult', 'Terrain difficile', 6000000]]],
        ['civil-scale', 'Échelle du projet', [['local', 'Projet local', 0], ['large', 'Projet d’envergure', 10000000]]]
      ]
    },
    management: {
      title: 'Paramétrez votre mission de gestion',
      help: 'Indiquez le niveau d’accompagnement dont vous avez besoin.',
      groups: [
        ['management-mission', 'Mission principale', [['planning', 'Planification et budget', 0], ['coordination', 'Coordination des équipes', 2500000], ['complete', 'Pilotage complet', 5000000]]],
        ['management-phase', 'État d’avancement', [['idea', 'Projet au stade de l’idée', 0], ['studies', 'Études déjà engagées', 1500000], ['construction', 'Travaux en cours', 3000000]]]
      ]
    }
  };

  function selected(name) { return form.querySelector(`input[name="${name}"]:checked`); }
  function renderParameters(type) {
    const config = serviceParameters[type] || serviceParameters.residential;
    document.querySelector('#parameters-title').textContent = config.title;
    document.querySelector('#parameters-help').textContent = config.help;
    document.querySelector('#parameter-groups').innerHTML = config.groups.map(([name, label, options]) => `<div class="parameter-group"><h3>${label}</h3><div class="quiz-options compact">${options.map(([value, text, cost], index) => `<label><input type="radio" name="${name}" value="${value}" data-cost="${cost}" ${index === 0 ? 'required' : ''}><span>${text}</span></label>`).join('')}</div></div>`).join('');
  }
  function hasStepSelection(step) {
    if (step.dataset.step === '3') return [...step.querySelectorAll('.parameter-group')].every(group => group.querySelector(':checked'));
    if (step.dataset.step === '7') return [...step.querySelectorAll('input[required]')].every(input => input.checkValidity());
    return Boolean(step.querySelector(':checked'));
  }
  function showStep(index) {
    currentStep = index;
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    stepLabel.textContent = `Étape ${index + 1} sur ${steps.length}`;
    progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
    previous.hidden = index === 0;
    previous.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Voir mon estimation ↗' : 'Continuer ↗';
  }
  function updateSummary() {
    const type = selected('type')?.value;
    if (!type) return;
    currentBudget = calculateBudget(type);
    const formatted = `${Math.round(currentBudget / 1000000)} à ${Math.round((currentBudget * 1.18) / 1000000)} millions FCFA`;
    summary.innerHTML = `<p class="eyebrow">ESTIMATION INDICATIVE</p><strong>${formatted}</strong><p>Cette fourchette sera affinée après étude de votre terrain, de vos plans et de vos choix techniques.</p><small>Les montants affichés sont indicatifs et ne constituent pas un devis.</small>`;
    budgetInput.value = currentBudget;
  }
  function calculateBudget(type) {
    const parameterCost = [...form.querySelectorAll('#parameter-groups input:checked')].reduce((total, input) => total + Number(input.dataset.cost || 0), 0);
    return baseBudget[type] + parameterCost + (surfaceFactor[selected('surface')?.value] || 0) + (finishFactor[selected('finish')?.value] || 0) + (locationFactor[selected('location')?.value] || 0);
  }
  function quizAnswers() {
    return [...form.querySelectorAll('input:checked')].reduce((answers, input) => {
      const label = input.closest('label');
      const value = label?.querySelector('span')?.textContent.trim() || input.value;
      answers[input.name] = value;
      return answers;
    }, {});
  }
  async function sendLead() {
    const lead = Object.fromEntries(new FormData(form).entries());
    const payload = {
      contact: { lastName: lead.lastName, firstName: lead.firstName, email: lead.email, phone: lead.phone, budget: lead.budget },
      estimate: { amount: currentBudget, display: summary.querySelector('strong')?.textContent || '' },
      quiz: quizAnswers(),
      submittedAt: new Date().toISOString()
    };
    const endpoint = window.LAROCHE_CONFIG?.telegramEndpoint || '/api/project-leads';
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: lead.email, source: 'project-quiz' }) }).catch(() => {});
  }
  async function renderSuggestedPlans() {
    const type = selected('type')?.value;
    const surface = selected('surface')?.value;
    try {
      const response = await fetch('/api/public/plans');
      if (!response.ok) throw new Error(`Impossible de charger les plans (${response.status}).`);
      const plans = (await response.json()).filter((plan) => plan.status !== 'hidden' && (!type || plan.type === type) && (!plan.surfaces || String(plan.surfaces).split(' ').includes(surface))).sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      projectPlanResults.innerHTML = plans.map((plan) => `<article class="plan-result-card"><img class="plan-result-image" src="${plan.coverUrl || '../Screenshot_20260904_142806_Drive.jpg'}" alt="Aperçu de ${plan.name}"><p class="eyebrow">${plan.category || plan.type || 'PLAN'}</p><h3>${plan.name}</h3><p>${plan.description || ''}</p><div class="plan-result-actions"><a href="plans.html" class="text-link dark">Voir le plan <span>↗</span></a><strong>${Number(plan.price || 0).toLocaleString('fr-FR')} FCFA</strong></div></article>`).join('');
      return plans.length > 0;
    } catch (error) {
      projectPlanResults.innerHTML = '';
      console.error('Suggestions de plans indisponibles :', error);
      return false;
    }
  }
  next.addEventListener('click', async () => {
    if (!hasStepSelection(steps[currentStep])) {
      steps[currentStep].classList.add('has-error');
      return;
    }
    steps[currentStep].classList.remove('has-error');
    if (currentStep < steps.length - 1) {
      showStep(currentStep + 1);
      if (currentStep === steps.length - 2) {
        currentBudget = calculateBudget(selected('type')?.value);
        budgetInput.value = currentBudget;
      }
    } else {
      next.disabled = true;
      leadStatus.className = 'lead-status';
      leadStatus.textContent = 'Envoi de votre demande…';
      try {
        updateSummary();
        await sendLead();
        leadStatus.textContent = '';
        leadConfirmation.classList.remove('is-hidden');
        quizActions.classList.add('is-hidden');
      } catch (error) {
        leadStatus.classList.add('is-error');
        leadStatus.textContent = 'L’envoi n’a pas abouti. Vérifiez la connexion ou réessayez plus tard.';
        console.error('Envoi du projet impossible :', error);
      } finally {
        next.disabled = false;
      }
    }
  });
  previous.addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
  form.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener('change', () => renderParameters(input.value)));
  choosePlan.addEventListener('click', async () => {
    results.classList.add('is-hidden');
    if (await renderSuggestedPlans()) {
      results.classList.remove('is-hidden');
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  renderParameters(selected('type')?.value || 'residential');
  showStep(0);
})();
