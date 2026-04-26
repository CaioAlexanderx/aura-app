/* chrome.js — injeta nav e footer compartilhados via data-mount
   Páginas que usam: <div data-mount="nav"></div> e <div data-mount="footer"></div>
*/

(function () {
  const NAV_HTML = `
<nav class="site-nav" data-cursor="hover">
  <a href="index.html" class="brand">
    <span class="glyph"></span>
    <span class="brand-name">Aura</span>
  </a>
  <div class="nav-links">
    <a href="index.html">Início</a>
    <div class="nav-dropdown">
      <button>Verticais ▾</button>
      <div class="nav-dropdown-panel">
        <a class="nav-dropdown-item" href="negocio.html" style="--v-accent:#7c3aed; --v-glow:rgba(124,58,237,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4l8 16H4z"/><circle cx="12" cy="14" r="1.5" fill="currentColor"/></svg></span>
          <span><div class="v-name">Aura Negócio</div><div class="v-tag">Carro-chefe · varejo geral</div></span>
        </a>
        <a class="nav-dropdown-item" href="odonto.html" style="--v-accent:#06B6D4; --v-glow:rgba(6,182,212,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4c-3 0-5 1.5-7 1.5C4 5.5 4 7 4 8c0 5 1.5 11 3 12 .8 1 1.5 0 2-1.5l.5-3c.2-.7.7-1 1.5-1h2c.8 0 1.3.3 1.5 1l.5 3c.5 1.5 1.2 2.5 2 1.5 1.5-1 3-7 3-12 0-1 0-2.5-1-2.5-2 0-4-1.5-7-1.5z"/></svg></span>
          <span><div class="v-name">Aura Odonto</div><div class="v-tag">Clínicas e consultórios</div></span>
        </a>
        <a class="nav-dropdown-item" href="beauty.html" style="--v-accent:#F472B6; --v-glow:rgba(244,114,182,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c-1.5 4.5-6 6-6 10.5 0 3.8 2.7 7.5 6 7.5s6-3.7 6-7.5C18 9 13.5 7.5 12 3z"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg></span>
          <span><div class="v-name">Aura Beauty</div><div class="v-tag">Salões, barbearias, estúdios</div></span>
        </a>
        <a class="nav-dropdown-item" href="food.html" style="--v-accent:#F97316; --v-glow:rgba(249,115,22,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c-2.5 3-4 5-4 9 0 3 1.5 5 4 7 2.5-2 4-4 4-7 0-4-1.5-6-4-9z"/></svg></span>
          <span><div class="v-name">Aura Food</div><div class="v-tag">Restaurantes, bares, deliveries</div></span>
        </a>
        <a class="nav-dropdown-item" href="pet.html" style="--v-accent:#10B981; --v-glow:rgba(16,185,129,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="6" cy="14" r="1.4"/><circle cx="18" cy="14" r="1.4"/><path d="M12 13c-3 0-5.5 2.5-5.5 4.8 0 1.5 1 2.2 2.5 2.2h6c1.5 0 2.5-.7 2.5-2.2 0-2.3-2.5-4.8-5.5-4.8z"/></svg></span>
          <span><div class="v-name">Aura Pet</div><div class="v-tag">Pet shops, banho e tosa, vets</div></span>
        </a>
        <a class="nav-dropdown-item" href="planos.html" style="--v-accent:#a78bfa; --v-glow:rgba(167,139,250,0.4)">
          <span class="v-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 11h16M9 6V4M15 6V4"/></svg></span>
          <span><div class="v-name">Comparar verticais</div><div class="v-tag">Veja todas lado a lado</div></span>
        </a>
      </div>
    </div>
    <a href="planos.html">Planos</a>
    <a href="sobre.html">Sobre</a>
    <a href="index.html#contato">Contato</a>
    <span class="nav-cta-row">
      <a href="https://app.getaura.com.br" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Entrar</a>
      <a href="https://app.getaura.com.br/cadastro" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Criar conta</a>
    </span>
  </div>
  <button class="nav-mobile-toggle" aria-label="Menu">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h14M3 10h14M3 14h14"/></svg>
  </button>
</nav>`;

  const FOOTER_HTML = `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <img src="assets/aura-icon.svg" alt="Aura" style="width: 36px; height: 36px; border-radius: 9px; box-shadow: 0 6px 18px rgba(124,58,237,0.4);" />
          <span style="font-family: var(--font-heading); font-size: 26px; color: white; letter-spacing: -0.02em;">Aura<span style="color: #a78bfa;">.</span></span>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: rgba(196,181,253,0.7); max-width: 280px;">Tecnologia para Negócios. Cinco verticais especialistas, uma plataforma única, feita no Brasil.</p>
        <p style="font-family: var(--font-heading); font-style: italic; font-size: 17px; line-height: 1.4; color: #fff; max-width: 300px; margin-top: 20px; letter-spacing: -0.01em;">&ldquo;Aura, a plataforma do empreendedor brasileiro.&rdquo;</p>
        <div style="margin-top: 24px; display: flex; gap: 10px;">
          <a href="https://instagram.com/aura_tecnologia" target="_blank" rel="noopener" aria-label="Instagram" style="width: 36px; height: 36px; padding: 0; border-radius: 10px; background: rgba(124,58,237,0.18); display: grid; place-items: center; color: #c4b5fd;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/></svg>
          </a>
          <a href="https://tiktok.com/@aura_tecnologia" target="_blank" rel="noopener" aria-label="TikTok" style="width: 36px; height: 36px; padding: 0; border-radius: 10px; background: rgba(124,58,237,0.18); display: grid; place-items: center; color: #c4b5fd;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 6.7c-1.7-.4-3-1.6-3.6-3.2-.1-.4-.2-.7-.2-1H12v13.4c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9c.3 0 .6 0 .9.1V8.5c-.3 0-.6-.1-.9-.1-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7 6.7-3 6.7-6.7V9.5c1.4 1 3 1.6 4.7 1.6V7.3c-.3 0-.6-.2-.9-.6z"/></svg>
          </a>
          <a href="https://wa.me/5511956305269" target="_blank" rel="noopener" aria-label="WhatsApp" style="width: 36px; height: 36px; padding: 0; border-radius: 10px; background: rgba(37,211,102,0.18); display: grid; place-items: center; color: #6ee7a8;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.4.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          </a>
        </div>
      </div>
      <div>
        <h5>Verticais</h5>
        <a href="negocio.html">Aura Negócio</a>
        <a href="odonto.html">Aura Odonto</a>
        <a href="beauty.html">Aura Beauty</a>
        <a href="food.html">Aura Food</a>
        <a href="pet.html">Aura Pet</a>
      </div>
      <div>
        <h5>Produto</h5>
        <a href="planos.html">Planos</a>
        <a href="https://app.getaura.com.br" target="_blank" rel="noopener">Entrar</a>
        <a href="https://app.getaura.com.br/cadastro" target="_blank" rel="noopener">Criar conta</a>
        <a href="sobre.html">Sobre a Aura</a>
      </div>
      <div>
        <h5>Contato</h5>
        <a href="https://wa.me/5511956305269" target="_blank" rel="noopener">(11) 95630-5269</a>
        <a href="index.html#contato">Formulário</a>
        <a href="https://instagram.com/aura_tecnologia" target="_blank" rel="noopener">@aura_tecnologia</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; 2026 Aura Tecnologia</div>
      <div class="row" style="gap: 24px;">
        <a href="#" style="opacity: 0.6;">Termos</a>
        <a href="#" style="opacity: 0.6;">Privacidade</a>
        <a href="#" style="opacity: 0.6;">LGPD</a>
      </div>
    </div>
  </div>
</footer>`;

  const WA_HTML = `
<a href="https://wa.me/5511956305269?text=Vim%20pelo%20site%20da%20Aura" target="_blank" rel="noopener" class="wa-float" aria-label="WhatsApp">
  <span class="wa-icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 14.2c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.2 0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.1.2 1.6.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.4.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
  </span>
  <span class="wa-num">(11) 95630-5269</span>
</a>`;

  function mount() {
    document.querySelectorAll('[data-mount]').forEach(function (el) {
      var type = el.getAttribute('data-mount');
      if (type === 'nav')    el.outerHTML = NAV_HTML;
      if (type === 'footer') el.outerHTML = FOOTER_HTML;
      if (type === 'wa')     el.outerHTML = WA_HTML;
    });

    // Marcar link ativo na nav
    var path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      if (a.getAttribute('href') === path) a.classList.add('active');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
