/**
 * Main Application Engine
 */

class App {
  constructor() {
    this.grid = null;
    this.currentDashboard = null;
    this.dashboardsList = [];
    this.refreshTimer = null;
    this.countdown = 40;
    this.countdownInterval = null;
    this.isEditMode = false;
    this.isKioskMode = false;
  }

  async init() {
    this.initGridstack();
    await this.loadDashboardsList();
    
    // Verifica parâmetro de URL ou localStorage ou prioriza switch_analysis
    const urlParams = new URLSearchParams(window.location.search);
    const urlDashId = urlParams.get('dashboard') || localStorage.getItem('last_active_dashboard');

    if (this.dashboardsList.length > 0) {
      const match = this.dashboardsList.find(d => d.id === urlDashId) 
                 || this.dashboardsList.find(d => d.id === 'switch_analysis') 
                 || this.dashboardsList[0];
      await this.loadDashboard(match.id);
    } else {
      await this.createNewDashboard('Dashboard Principal');
    }

    this.startAutoRefresh();
  }

  initGridstack() {
    this.grid = GridStack.init({
      column: 12,
      cellHeight: 70,
      margin: 8,
      animate: true,
      float: false,
      draggable: { handle: '.bg-slate-900\\/40' },
      resizable: { handles: 'e, se, s, sw, w' }
    });

    // Quando mover ou redimensionar, salva coordenadas e persiste automaticamente no servidor
    this.grid.on('change', () => {
      this.syncGridToDashboardData();
      if (this._saveTimeout) clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this.saveCurrentDashboard(true); // auto-save silencioso
      }, 600);
    });
  }

  async loadDashboardsList() {
    try {
      const res = await fetch('api/dashboards.php?action=list');
      const data = await res.json();
      if (data.success) {
        this.dashboardsList = data.dashboards || [];
        this.renderDashboardDropdown();
      }
    } catch (e) {
      console.error('Erro ao listar dashboards:', e);
    }
  }

  renderDashboardDropdown() {
    const select = document.getElementById('dashboard-select');
    if (!select) return;

    select.innerHTML = this.dashboardsList.map(d => `
      <option value="${d.id}" ${this.currentDashboard?.id === d.id ? 'selected' : ''}>
        📊 ${d.title} (${d.widget_count} widgets)
      </option>
    `).join('');
  }

  async loadDashboard(id) {
    try {
      const res = await fetch(`api/dashboards.php?action=get&id=${id}`);
      const data = await res.json();
      if (data.success && data.dashboard) {
        this.currentDashboard = data.dashboard;
        localStorage.setItem('last_active_dashboard', id);
        this.renderActiveDashboard();
        this.renderDashboardDropdown();
        this.countdown = this.currentDashboard.refresh_interval || 40;
      }
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e);
    }
  }

  renderActiveDashboard() {
    if (!this.grid || !this.currentDashboard) return;

    // Destrói instâncias de gráficos do dashboard anterior para liberar recursos
    if (window.widgetRegistry && typeof window.widgetRegistry.destroyCharts === 'function') {
      window.widgetRegistry.destroyCharts();
    }

    // Limpa widgets anteriores do DOM e do gridstack
    this.grid.removeAll(true);

    const widgets = this.currentDashboard.widgets || [];
    widgets.forEach(w => {
      const el = document.createElement('div');
      el.className = 'grid-stack-item';
      el.id = `widget-node-${w.id}`;
      el.setAttribute('gs-id', w.id);
      el.setAttribute('gs-x', w.x !== undefined ? w.x : 0);
      el.setAttribute('gs-y', w.y !== undefined ? w.y : 0);
      el.setAttribute('gs-w', w.w || 4);
      el.setAttribute('gs-h', w.h || 3);
      el.setAttribute('gs-min-w', '2');
      el.setAttribute('gs-min-h', '2');

      const content = document.createElement('div');
      content.className = 'grid-stack-item-content';
      el.appendChild(content);

      this.grid.el.appendChild(el);
      this.grid.makeWidget(el);

      // Renderiza o conteúdo específico do widget
      window.widgetRegistry.render(w, content);
    });

    // Atualiza título na barra
    const titleEl = document.getElementById('dash-header-title');
    if (titleEl) titleEl.textContent = this.currentDashboard.title;
  }

  syncGridToDashboardData() {
    if (!this.grid || !this.currentDashboard) return;
    const items = this.grid.getGridItems();
    items.forEach(el => {
      const node = el.gridstackNode;
      if (!node) return;
      const widget = this.currentDashboard.widgets.find(w => w.id === node.id);
      if (widget) {
        widget.x = node.x;
        widget.y = node.y;
        widget.w = node.w;
        widget.h = node.h;
      }
    });
  }

  async saveCurrentDashboard(silent = false) {
    this.syncGridToDashboardData();
    if (!this.currentDashboard) return;

    try {
      const saveBtn = document.getElementById('btn-save-dashboard');
      if (saveBtn) saveBtn.classList.add('opacity-70');

      const res = await fetch('api/dashboards.php?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentDashboard)
      });
      const data = await res.json();
      if (saveBtn) saveBtn.classList.remove('opacity-70');

      if (data.success) {
        if (!silent) {
          this.showToast('✅ Layout e posições salvos com sucesso!');
        }
      } else {
        this.showToast('❌ ' + (data.error || 'Erro ao salvar dashboard.'));
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        this.showToast('❌ Erro ao salvar dashboard.');
      }
    }
  }

  addWidget(widgetObj) {
    if (!this.currentDashboard) return;
    this.currentDashboard.widgets.push(widgetObj);
    this.renderActiveDashboard();
    this.saveCurrentDashboard();
  }

  removeWidget(widgetId) {
    if (!confirm('Deseja realmente remover este widget?')) return;
    if (!this.currentDashboard) return;
    
    this.currentDashboard.widgets = this.currentDashboard.widgets.filter(w => w.id !== widgetId);
    this.renderActiveDashboard();
    this.saveCurrentDashboard();
  }

  async createNewDashboard(title = 'Novo Dashboard') {
    const newDash = {
      id: 'dash_' + Date.now(),
      title: title,
      description: 'Dashboard criado pelo usuário',
      refresh_interval: 40,
      columns: 12,
      widgets: [
        {
          id: 'w_clock_' + Date.now(),
          type: 'clock',
          title: 'Relógio Operacional',
          x: 0,
          y: 0,
          w: 3,
          h: 2,
          config: { show_utc: true }
        },
        {
          id: 'w_stat_' + Date.now(),
          type: 'stat_card',
          title: 'Incidentes Ativos',
          x: 3,
          y: 0,
          w: 3,
          h: 2,
          config: { metric_type: 'problems_count' }
        },
        {
          id: 'w_probs_' + Date.now(),
          type: 'problems_table',
          title: 'Alarmes Recentes',
          x: 0,
          y: 2,
          w: 12,
          h: 4,
          config: { limit: 15 }
        }
      ]
    };

    try {
      const res = await fetch('api/dashboards.php?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDash)
      });
      const data = await res.json();
      if (data.success) {
        await this.loadDashboardsList();
        await this.loadDashboard(newDash.id);
        this.showToast('Novo dashboard criado!');
      }
    } catch (e) {
      console.error(e);
    }
  }

  promptNewDashboard() {
    const title = prompt('Digite o nome do novo dashboard:', 'Novo Painel NOC');
    if (title && title.trim()) {
      this.createNewDashboard(title.trim());
    }
  }

  async deleteCurrentDashboard() {
    if (!this.currentDashboard) return;
    if (!confirm(`Tem certeza que deseja excluir o dashboard "${this.currentDashboard.title}"?`)) return;

    try {
      const res = await fetch(`api/dashboards.php?action=delete&id=${this.currentDashboard.id}`);
      const data = await res.json();
      if (data.success) {
        this.showToast('Dashboard excluído!');
        await this.loadDashboardsList();
        if (this.dashboardsList.length > 0) {
          await this.loadDashboard(this.dashboardsList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  startAutoRefresh() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdown = this.currentDashboard?.refresh_interval || 40;
    this.updateTimerDisplay();

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      this.updateTimerDisplay();

      if (this.countdown <= 0) {
        this.refreshDashboardData();
        this.countdown = this.currentDashboard?.refresh_interval || 40;
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const el = document.getElementById('refresh-counter');
    if (el) el.textContent = `${this.countdown}s`;
    const kioskEl = document.getElementById('kiosk-refresh');
    if (kioskEl) kioskEl.textContent = `${this.countdown}s`;
  }

  refreshDashboardData() {
    if (!this.currentDashboard) return;
    const items = this.grid?.getGridItems() || [];
    items.forEach(el => {
      const content = el.querySelector('.grid-stack-item-content');
      const widgetId = el.getAttribute('gs-id');
      const widget = this.currentDashboard.widgets.find(w => w.id === widgetId);
      if (widget && content) {
        window.widgetRegistry.render(widget, content);
      }
    });
  }

  // Atualiza em tempo real os cartões de estatística quando um grupo de switches é filtrado
  updateStatCardsWithSummary(summary, groupId = null) {
    if (!summary || !this.currentDashboard) return;
    this.currentDashboard.widgets.forEach(w => {
      if (w.type === 'stat_card') {
        const metric = w.config?.metric_type;
        const valEl = document.getElementById(`stat_val_${w.id}`);
        const subEl = document.getElementById(`stat_sub_${w.id}`);
        if (!valEl) return;

        // Se o card não tem grupo próprio fixado ou usa o mesmo grupo selecionado
        if (!w.config?.group_id || w.config.group_id === groupId) {
          if (metric === 'switches_total') {
            valEl.textContent = summary.total;
          } else if (metric === 'switches_up') {
            valEl.textContent = summary.up;
          } else if (metric === 'switches_down') {
            valEl.textContent = summary.down;
            if (subEl) subEl.textContent = summary.down === 0 ? 'Nenhum switch fora' : `${summary.down} Offline / Atenção`;
          }
        }
      }
    });
  }

  // Permite que clicar nos cartões de total/up/down filtre a tabela de switches
  filterSwitchesTableByStatus(status) {
    if (!this.currentDashboard) return;
    const swTableWidget = this.currentDashboard.widgets.find(w => w.type === 'switches_table');
    if (swTableWidget && window.widgetRegistry) {
      window.widgetRegistry.setSwitchesStatusFilter(swTableWidget.id, status);
    }
  }

  toggleKioskMode() {
    this.isKioskMode = !this.isKioskMode;
    if (this.isKioskMode) {
      document.body.classList.add('kiosk-mode');
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      this.showToast('Modo NOC TV Ativado! Pressione ESC ou clique no botão flutuante para sair.');
    } else {
      document.body.classList.remove('kiosk-mode');
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-slate-800/95 border border-cyan-500/40 text-cyan-300 font-medium text-xs shadow-2xl transition-all duration-300 transform translate-y-10 opacity-0';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('translate-y-10', 'opacity-0');
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
    }, 3000);
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
