/**
 * Widget Registry & Renderers for Zabbix Dashboards
 * Suporte a atualização em segundo plano sem cintilação / piscamento (Zero-Flicker)
 * e filtros interativos de grupos e status de switches
 */

const SEVERITY_CONFIG = {
  0: { label: 'Não classificado', class: 'badge-notclass', bg: '#64748b' },
  1: { label: 'Informação', class: 'badge-info', bg: '#0284c7' },
  2: { label: 'Atenção', class: 'badge-warning', bg: '#eab308' },
  3: { label: 'Média', class: 'badge-average', bg: '#d97706' },
  4: { label: 'Alta', class: 'badge-high', bg: '#ea580c' },
  5: { label: 'Desastre', class: 'badge-disaster', bg: '#e11d48' }
};

class WidgetRegistry {
  constructor() {
    this.charts = {}; // Armazena instâncias de ApexCharts para atualizar sem recriar
    this.tables = {}; // Armazena instâncias e callbacks de tabelas ativas
  }

  // Destrói gráficos e limpa memória quando troca de dashboard
  destroyCharts() {
    Object.keys(this.charts).forEach(id => {
      try {
        if (this.charts[id] && typeof this.charts[id].destroy === 'function') {
          this.charts[id].destroy();
        }
      } catch (e) {
        console.warn('Erro ao destruir chart:', e);
      }
    });
    this.charts = {};
  }

  // Utilitário para formatar tempo decorrido
  timeAgo(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - timestamp);
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  }

  // Renderiza o cabeçalho padrão de qualquer widget
  renderHeader(widget) {
    return `
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-slate-900/40 select-none">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          <h3 class="text-xs font-semibold text-slate-200 tracking-wide uppercase truncate" title="${widget.title}">
            ${widget.title}
          </h3>
        </div>
        <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <button onclick="editor.openEditWidgetModal('${widget.id}')" class="p-1 hover:text-cyan-400 text-slate-400 text-xs rounded" title="Configurar Painel / Filtro de Grupo">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
          <button onclick="app.removeWidget('${widget.id}')" class="widget-delete-btn p-1 hover:text-rose-400 text-slate-400 text-xs rounded" title="Remover Widget">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  // 1. Widget: Relógio NOC
  renderClock(widget, container) {
    if (container.querySelector(`#clock_time_${widget.id}`)) {
      return; // Já está montado e com intervalo ativo
    }

    container.innerHTML = `
      ${this.renderHeader(widget)}
      <div class="flex-1 flex flex-col justify-center items-center p-4">
        <div id="clock_time_${widget.id}" class="text-3xl font-bold font-mono tracking-wider text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">
          --:--:--
        </div>
        <div id="clock_date_${widget.id}" class="text-xs text-slate-400 font-medium mt-1">
          Carregando...
        </div>
        ${widget.config?.show_utc ? `
          <div id="clock_utc_${widget.id}" class="text-[11px] font-mono text-slate-500 mt-2">
            UTC: --:--:--
          </div>
        ` : ''}
      </div>
    `;

    const updateClock = () => {
      const now = new Date();
      const timeEl = document.getElementById(`clock_time_${widget.id}`);
      const dateEl = document.getElementById(`clock_date_${widget.id}`);
      const utcEl = document.getElementById(`clock_utc_${widget.id}`);
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('pt-BR');
      if (dateEl) dateEl.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (utcEl) utcEl.textContent = 'UTC: ' + now.toISOString().substring(11, 19);
    };

    updateClock();
    if (widget._clockInterval) clearInterval(widget._clockInterval);
    widget._clockInterval = setInterval(updateClock, 1000);
  }

  // 2. Widget: Stat Card / Cartão de Estatística
  async renderStatCard(widget, container) {
    const cardTheme = widget.config?.card_style || 'glass';
    const metric = widget.config?.metric_type || 'problems_count';
    let bgClasses = 'bg-slate-900/40 border-white/5';
    let textValClass = 'text-slate-100';
    let iconBgClass = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';

    if (cardTheme === 'solid_blue') {
      bgClasses = 'bg-gradient-to-r from-blue-700 to-blue-600 border-blue-500/40 text-white';
      textValClass = 'text-white drop-shadow-md';
      iconBgClass = 'bg-white/15 border-white/20 text-white';
    } else if (cardTheme === 'solid_green') {
      bgClasses = 'bg-gradient-to-r from-emerald-700 to-emerald-600 border-emerald-500/40 text-white';
      textValClass = 'text-white drop-shadow-md';
      iconBgClass = 'bg-white/15 border-white/20 text-white';
    } else if (cardTheme === 'solid_red') {
      bgClasses = 'bg-gradient-to-r from-rose-800 to-rose-700 border-rose-500/40 text-white';
      textValClass = 'text-white drop-shadow-md';
      iconBgClass = 'bg-white/15 border-white/20 text-white';
    } else if (cardTheme === 'solid_amber') {
      bgClasses = 'bg-gradient-to-r from-amber-700 to-amber-600 border-amber-500/40 text-white';
      textValClass = 'text-white drop-shadow-md';
      iconBgClass = 'bg-white/15 border-white/20 text-white';
    }

    const showHeader = widget.config?.show_header !== false;
    let valEl = document.getElementById(`stat_val_${widget.id}`);
    let subEl = document.getElementById(`stat_sub_${widget.id}`);

    // Configuração de clique para filtrar tabela caso seja métrica de switch
    let clickAction = '';
    let cursorClass = '';
    let cardTitleTooltip = '';
    if (metric === 'switches_total') {
      clickAction = `onclick="app.filterSwitchesTableByStatus('all')"`;
      cursorClass = 'cursor-pointer hover:brightness-110 active:scale-[0.99] transition transform';
      cardTitleTooltip = 'Clique para ver todos os switches na tabela';
    } else if (metric === 'switches_up') {
      clickAction = `onclick="app.filterSwitchesTableByStatus('up')"`;
      cursorClass = 'cursor-pointer hover:brightness-110 active:scale-[0.99] transition transform';
      cardTitleTooltip = 'Clique para filtrar apenas switches UP (Online)';
    } else if (metric === 'switches_down') {
      clickAction = `onclick="app.filterSwitchesTableByStatus('down')"`;
      cursorClass = 'cursor-pointer hover:brightness-110 active:scale-[0.99] transition transform';
      cardTitleTooltip = 'Clique para filtrar apenas switches DOWN (Offline / Atenção)';
    }

    // Monta a casca DOM apenas na primeira carga do widget
    if (!valEl || !subEl) {
      container.innerHTML = `
        ${showHeader ? this.renderHeader(widget) : `
          <div class="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
            <button onclick="editor.openEditWidgetModal('${widget.id}')" class="p-1 hover:text-white text-slate-300 text-xs rounded" title="Configurar Card / Grupo de Hosts">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
            <button onclick="app.removeWidget('${widget.id}')" class="p-1 hover:text-rose-400 text-slate-300 text-xs rounded" title="Remover">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        `}
        <div ${clickAction} title="${cardTitleTooltip}" class="flex-1 flex items-center justify-between p-4 ${cursorClass} ${cardTheme !== 'glass' ? bgClasses : ''}">
          <div>
            ${!showHeader ? `<div class="text-[11px] font-bold uppercase tracking-wider text-white/80 mb-0.5">${widget.title}</div>` : ''}
            <div class="text-3xl font-black font-mono tracking-tight ${textValClass}" id="stat_val_${widget.id}">
              <span class="animate-pulse text-white/50">...</span>
            </div>
            <div class="text-xs ${cardTheme !== 'glass' ? 'text-white/80' : 'text-slate-400'} mt-0.5 font-medium" id="stat_sub_${widget.id}">
              Buscando dados...
            </div>
          </div>
          <div class="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClass}">
            ${widget.config?.custom_icon === 'check' ? `
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
            ` : (widget.config?.custom_icon === 'alert' ? `
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            ` : `
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            `)}
          </div>
        </div>
      `;
      valEl = document.getElementById(`stat_val_${widget.id}`);
      subEl = document.getElementById(`stat_sub_${widget.id}`);
    }

    if (!valEl) return;

    if (metric === 'switches_total' || metric === 'switches_up' || metric === 'switches_down') {
      const gid = widget.config?.group_id || null;
      const swData = await window.zabbix.getSwitchesAnalysis(gid);
      const sum = swData.summary || { total: 0, up: 0, down: 0 };
      if (metric === 'switches_total') {
        valEl.textContent = sum.total;
        if (subEl) subEl.textContent = 'Switches Monitorados';
      } else if (metric === 'switches_up') {
        valEl.textContent = sum.up;
        if (subEl) subEl.textContent = 'Operando Online (UP)';
      } else if (metric === 'switches_down') {
        valEl.textContent = sum.down;
        if (subEl) subEl.textContent = sum.down === 0 ? 'Nenhum switch fora' : `${sum.down} Offline / Atenção`;
      }
      return;
    }

    const summary = await window.zabbix.getSummary();
    if (summary && summary.result) {
      const data = summary.result;
      if (metric === 'hosts_availability') {
        const total = data.total_hosts || 0;
        const avail = data.available_hosts || 0;
        const pct = total > 0 ? ((avail / total) * 100).toFixed(1) : '100';
        valEl.innerHTML = `${pct}% <span class="text-xs opacity-80">(${avail}/${total})</span>`;
        if (subEl) subEl.textContent = 'Hosts operando normalmente';
      } else if (metric === 'problems_count') {
        const total = data.problems_total || 0;
        valEl.textContent = total;
        if (subEl) subEl.textContent = total === 0 ? 'Tudo operando normalmente' : `${data.by_severity[5] || 0} Desastre(s), ${data.by_severity[4] || 0} Alto(s)`;
      } else if (metric === 'problems_unack') {
        const unack = data.problems_unack || 0;
        valEl.textContent = unack;
        if (subEl) subEl.textContent = 'Alertas não reconhecidos';
      }
    } else {
      valEl.innerHTML = `<span class="text-white/70 text-base">39</span>`;
      if (subEl) subEl.textContent = 'Demonstração NOC';
    }
  }

  // 3. Widget: Tabela de Problemas (Incidentes)
  async renderProblemsTable(widget, container) {
    let tbody = document.getElementById(`prob_body_${widget.id}`);
    
    // Monta a estrutura da tabela apenas se não existir
    if (!tbody) {
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="flex-1 overflow-auto p-2">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-white/10 text-slate-400 font-semibold">
                <th class="pb-2 px-2">Severidade</th>
                <th class="pb-2 px-2">Alarme / Problema</th>
                <th class="pb-2 px-2">Tempo</th>
                <th class="pb-2 px-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody id="prob_body_${widget.id}" class="divide-y divide-white/5">
              <tr><td colspan="4" class="py-6 text-center text-slate-500">Buscando alarmes ativos no Zabbix...</td></tr>
            </tbody>
          </table>
        </div>
      `;
      tbody = document.getElementById(`prob_body_${widget.id}`);
    }

    const limit = widget.config?.limit || 20;
    const problems = await window.zabbix.getProblems(limit);
    if (!tbody) return;

    if (!problems || problems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center">
            <div class="flex flex-col items-center justify-center text-emerald-400">
              <svg class="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span class="font-medium">Nenhum incidente ativo no momento!</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = problems.map(p => {
      const sev = SEVERITY_CONFIG[p.severity] || SEVERITY_CONFIG[0];
      const time = this.timeAgo(parseInt(p.clock));
      const isAck = p.acknowledged == '1';
      return `
        <tr class="hover:bg-white/[0.03] transition-colors">
          <td class="py-2 px-2 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${sev.class}">
              ${sev.label}
            </span>
          </td>
          <td class="py-2 px-2 font-medium text-slate-200">
            <div class="truncate max-w-md" title="${p.name}">
              ${p.name}
            </div>
          </td>
          <td class="py-2 px-2 whitespace-nowrap text-slate-400 font-mono text-[11px]">
            ${time}
          </td>
          <td class="py-2 px-2 text-right whitespace-nowrap">
            ${isAck 
              ? '<span class="text-emerald-400 text-[11px]">✓ Reconhecido</span>' 
              : '<span class="text-rose-400 font-semibold text-[11px]">⚠️ Não Reconhecido</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 4. Widget: Grid de Status dos Hosts
  async renderHostStatusGrid(widget, container) {
    let grid = document.getElementById(`host_grid_${widget.id}`);
    let searchInput = document.getElementById(`host_search_${widget.id}`);

    if (!grid || !searchInput) {
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="p-2 border-b border-white/5">
          <input type="text" placeholder="Filtrar host..." id="host_search_${widget.id}" 
                 class="w-full bg-slate-900/80 border border-slate-700/60 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
        </div>
        <div class="flex-1 overflow-auto p-2">
          <div id="host_grid_${widget.id}" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="col-span-full py-6 text-center text-slate-500">Carregando lista de hosts...</div>
          </div>
        </div>
      `;
      grid = document.getElementById(`host_grid_${widget.id}`);
      searchInput = document.getElementById(`host_search_${widget.id}`);
    }

    const hosts = await window.zabbix.getHosts();
    if (!grid) return;

    const renderList = (filterText = '') => {
      const filtered = hosts.filter(h => h.name.toLowerCase().includes(filterText.toLowerCase()) || h.host.toLowerCase().includes(filterText.toLowerCase()));
      if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-4 text-center text-slate-500">Nenhum host encontrado.</div>`;
        return;
      }

      grid.innerHTML = filtered.slice(0, widget.config?.limit || 30).map(h => {
        const isUp = h.status === '0' && (h.available === '1' || h.available === '0');
        const ip = h.interfaces?.[0]?.ip || 'Sem IP';
        return `
          <div class="p-2 rounded-lg bg-slate-900/60 border border-white/5 hover:border-slate-600 transition flex items-center justify-between">
            <div class="overflow-hidden">
              <div class="text-xs font-semibold text-slate-200 truncate" title="${h.name}">${h.name}</div>
              <div class="text-[10px] text-slate-400 font-mono">${ip}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="w-2.5 h-2.5 rounded-full ${isUp ? 'bg-emerald-500 pulse-active' : 'bg-rose-500'}"></span>
              <span class="text-[10px] ${isUp ? 'text-emerald-400' : 'text-rose-400'} font-medium">
                ${isUp ? 'UP' : 'DOWN'}
              </span>
            </div>
          </div>
        `;
      }).join('');
    };

    renderList(searchInput?.value || '');
    if (searchInput) {
      searchInput.oninput = (e) => renderList(e.target.value);
    }
  }

  // 5. Widget: Top N Recursos Consumidos
  async renderTopN(widget, container) {
    let body = document.getElementById(`top_n_body_${widget.id}`);
    if (!body) {
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="flex-1 overflow-auto p-3" id="top_n_body_${widget.id}">
          <div class="py-6 text-center text-slate-500">Buscando itens e métricas...</div>
        </div>
      `;
      body = document.getElementById(`top_n_body_${widget.id}`);
    }

    const searchKey = widget.config?.search_item || 'CPU';
    const unit = widget.config?.unit || '%';
    const limit = widget.config?.limit || 5;

    const items = await window.zabbix.getItems(null, searchKey);
    if (!body) return;

    if (!items || items.length === 0) {
      body.innerHTML = `<div class="py-6 text-center text-slate-500">Nenhum item encontrado com o termo "${searchKey}".</div>`;
      return;
    }

    const validItems = items
      .map(i => ({
        ...i,
        valNum: parseFloat(i.lastvalue) || 0,
        hostName: i.hosts?.[0]?.name || 'Host'
      }))
      .sort((a, b) => b.valNum - a.valNum)
      .slice(0, limit);

    body.innerHTML = `
      <div class="space-y-3">
        ${validItems.map((item, idx) => {
          const pct = Math.min(100, Math.max(0, item.valNum));
          let colorClass = 'bg-cyan-500';
          if (pct > 90) colorClass = 'bg-rose-500';
          else if (pct > 75) colorClass = 'bg-amber-500';

          return `
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center font-bold">
                    ${idx + 1}
                  </span>
                  <span class="text-slate-200 font-medium truncate" title="${item.hostName}">${item.hostName}</span>
                  <span class="text-[10px] text-slate-500 truncate">- ${item.name}</span>
                </div>
                <div class="font-mono font-bold text-slate-100 shrink-0 ml-2">
                  ${item.valNum.toFixed(1)}${unit}
                </div>
              </div>
              <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full ${colorClass} transition-all duration-500 rounded-full" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 6. Widget: Gauge / Medidor Radial
  async renderGauge(widget, container) {
    let chartContainer = document.getElementById(`chart_${widget.id}`);
    let labelEl = document.getElementById(`gauge_label_${widget.id}`);

    if (!chartContainer || !labelEl) {
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="flex-1 flex flex-col items-center justify-center p-2 relative">
          <div id="chart_${widget.id}" class="w-full flex justify-center"></div>
          <div class="text-xs text-slate-400 font-medium mt-[-10px] text-center truncate max-w-[80%]" id="gauge_label_${widget.id}">
            Carregando...
          </div>
        </div>
      `;
      chartContainer = document.getElementById(`chart_${widget.id}`);
      labelEl = document.getElementById(`gauge_label_${widget.id}`);
    }

    const searchKey = widget.config?.search_item || 'CPU utilization';
    const items = await window.zabbix.getItems(null, searchKey);
    if (!chartContainer) return;

    let value = 0;
    let label = searchKey;

    if (items && items.length > 0) {
      const topItem = items[0];
      value = parseFloat(topItem.lastvalue) || 0;
      label = `${topItem.hosts?.[0]?.name || ''} - ${topItem.name}`;
    }

    if (labelEl) labelEl.textContent = label;

    const seriesVal = Math.min(100, Math.max(0, Math.round(value)));
    const fillColor = value > 90 ? '#e11d48' : (value > 75 ? '#d97706' : '#06b6d4');

    if (this.charts[widget.id]) {
      this.charts[widget.id].updateOptions({
        fill: { colors: [fillColor] }
      }, false, true);
      this.charts[widget.id].updateSeries([seriesVal], true);
      return;
    }

    const options = {
      series: [seriesVal],
      chart: {
        height: 180,
        type: 'radialBar',
        sparkline: { enabled: true }
      },
      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 135,
          hollow: { size: '65%' },
          track: {
            background: 'rgba(255, 255, 255, 0.05)',
            strokeWidth: '100%'
          },
          dataLabels: {
            name: { show: false },
            value: {
              offsetY: 8,
              fontSize: '22px',
              fontWeight: '700',
              fontFamily: 'JetBrains Mono',
              color: '#f8fafc',
              formatter: (val) => val + (widget.config?.unit || '%')
            }
          }
        }
      },
      fill: {
        colors: [fillColor]
      },
      stroke: { dashArray: 4 }
    };

    this.charts[widget.id] = new ApexCharts(chartContainer, options);
    this.charts[widget.id].render();
  }

  // 7. Widget: Gráfico Temporal de Histórico (ApexCharts)
  async renderGraph(widget, container) {
    let chartContainer = document.getElementById(`chart_${widget.id}`);
    if (!chartContainer) {
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="flex-1 flex flex-col p-2 relative">
          <div id="chart_${widget.id}" class="flex-1 w-full min-h-[160px]"></div>
        </div>
      `;
      chartContainer = document.getElementById(`chart_${widget.id}`);
    }

    const searchKey = widget.config?.search_item || 'CPU';
    const chartType = widget.config?.chart_type || 'area';
    const chartColor = widget.config?.color || '#38bdf8';
    if (!chartContainer) return;

    const items = await window.zabbix.getItems(null, searchKey);
    let seriesData = [];
    let itemName = searchKey;

    if (items && items.length > 0) {
      const item = items[0];
      itemName = `${item.hosts?.[0]?.name || ''} - ${item.name}`;
      const history = await window.zabbix.getHistory(item.itemid, parseInt(item.value_type) || 0, widget.config?.history_limit || 40);
      
      if (history && history.length > 0) {
        seriesData = history.map(h => [
          parseInt(h.clock) * 1000,
          parseFloat(h.value) || 0
        ]);
      }
    }

    if (seriesData.length === 0) {
      const now = Date.now();
      for (let i = 20; i >= 0; i--) {
        seriesData.push([now - (i * 60000), Math.floor(Math.random() * 25) + 15]);
      }
    }

    if (this.charts[widget.id]) {
      this.charts[widget.id].updateSeries([{
        name: itemName,
        data: seriesData
      }], true);
      return;
    }

    const options = {
      series: [{
        name: itemName,
        data: seriesData
      }],
      chart: {
        type: chartType,
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 400 },
        background: 'transparent'
      },
      colors: [chartColor],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 95, 100]
        }
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: { colors: '#64748b', fontSize: '10px', fontFamily: 'JetBrains Mono' },
          datetimeUTC: false,
          format: 'HH:mm'
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: '#64748b', fontSize: '10px', fontFamily: 'JetBrains Mono' },
          formatter: (val) => val.toFixed(1)
        }
      },
      grid: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        strokeDashArray: 3
      },
      tooltip: {
        theme: 'dark',
        x: { format: 'dd/MM HH:mm:ss' }
      }
    };

    this.charts[widget.id] = new ApexCharts(chartContainer, options);
    this.charts[widget.id].render();
  }

  // 8. Widget: Brand / Logo Banner
  renderBrandBanner(widget, container) {
    if (container.querySelector('.brand-banner-content')) {
      return;
    }
    const brandName = widget.config?.brand_name || 'DTCEA-SJ';
    const subtitle = widget.config?.subtitle || 'NOC & NETWORK OPERATIONS CENTER';

    container.innerHTML = `
      <div class="brand-banner-content flex-1 flex flex-col justify-center px-5 py-3 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/20 rounded-xl">
        <div class="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none"></div>
        <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl pointer-events-none"></div>
        
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </div>
          <div class="overflow-hidden">
            <div class="text-lg font-black tracking-wider text-cyan-400 font-mono uppercase drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              ${brandName}
            </div>
            <div class="text-[10px] font-semibold tracking-widest text-slate-400 uppercase truncate">
              ${subtitle}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Método auxiliar para alterar o filtro de status da tabela externamente (ex: ao clicar nos cartões)
  setSwitchesStatusFilter(widgetId, status) {
    if (this.tables[widgetId] && typeof this.tables[widgetId].setStatusFilter === 'function') {
      this.tables[widgetId].setStatusFilter(status);
    }
  }

  // 9. Widget: Tabela de Análise Geral de Switches (Estilo Grafana NOC)
  async renderSwitchesTable(widget, container) {
    const tableId = `sw_tbl_${widget.id}`;
    const searchId = `sw_srch_${widget.id}`;
    const countId = `sw_cnt_${widget.id}`;
    const groupId = `sw_grp_${widget.id}`;
    let tbody = document.getElementById(`tbody_${widget.id}`);
    let searchInput = document.getElementById(searchId);
    let groupSelect = document.getElementById(groupId);
    let countBadge = document.getElementById(countId);

    if (!widget._tableState) {
      widget._tableState = {
        sort: { col: 'name', dir: 'asc' },
        switches: [],
        statusFilter: 'all', // 'all', 'up', 'down', 'sw_only'
        groupsLoaded: false
      };
    }
    const state = widget._tableState;

    if (!tbody || !searchInput || !groupSelect) {
      const currentGroupId = widget.config?.group_id || '';
      container.innerHTML = `
        ${this.renderHeader(widget)}
        <div class="p-2.5 border-b border-white/5 bg-slate-900/30 flex flex-wrap items-center justify-between gap-2">
          
          <!-- Filtros de Grupo, Busca e Status -->
          <div class="flex items-center flex-wrap gap-2">
            <div class="relative w-52">
              <input type="text" id="${searchId}" placeholder="Filtrar por nome ou IP..." 
                     class="w-full bg-slate-900/90 border border-slate-700/70 focus:border-cyan-500 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 outline-none transition">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <!-- Dropdown com todos os grupos de hosts do Zabbix -->
            <select id="${groupId}" class="bg-slate-900/90 border border-slate-700/70 focus:border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none max-w-[220px] truncate cursor-pointer font-medium">
              <option value="">📁 Todos os Grupos (Zabbix)</option>
            </select>

            <!-- Botões de Filtro Rápido (Todos / UP / DOWN / Só Switches) -->
            <div class="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button id="sw_btn_all_${widget.id}" class="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-600 text-white transition">Todos</button>
              <button id="sw_btn_up_${widget.id}" class="px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-white transition">🟢 UP</button>
              <button id="sw_btn_down_${widget.id}" class="px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-white transition">🔴 DOWN</button>
              <button id="sw_btn_swonly_${widget.id}" class="px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-white transition" title="Filtrar somente equipamentos com 'SW' ou 'Switch' no nome">⚡ Só Switches</button>
            </div>

            <span id="${countId}" class="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono font-semibold border border-slate-700">
              Carregando...
            </span>
          </div>

          <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span class="w-2 h-2 rounded-full bg-emerald-500 pulse-active"></span>
            <span>Tempo Real</span>
          </div>
        </div>

        <div class="flex-1 overflow-auto bg-[#0c121e]">
          <table class="w-full text-left border-collapse text-xs" id="${tableId}">
            <thead class="sticky top-0 bg-[#0f172a] z-10 select-none shadow-md border-b border-white/10">
              <tr class="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <th data-sort="name" class="py-2.5 px-3 cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center gap-1">Host <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="ping" class="py-2.5 px-3 text-center cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-center gap-1">Ping <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="serial" class="py-2.5 px-3 text-center cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-center gap-1">Serial Number <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="latency" class="py-2.5 px-3 text-center cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-center gap-1">Latencia (ms) <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="cpu" class="py-2.5 px-3 cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center gap-1">CPU (%) <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="memory" class="py-2.5 px-3 cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center gap-1">Memoria (%) <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="temp" class="py-2.5 px-3 text-center cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-center gap-1">Temperatura (C°) <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="os_version" class="py-2.5 px-3 text-center cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-center gap-1">Versão SO / Firmware <span class="text-[9px] opacity-60">▽</span></div>
                </th>
                <th data-sort="uptime" class="py-2.5 px-3 text-right cursor-pointer hover:text-cyan-400 transition">
                  <div class="flex items-center justify-end gap-1">Uptime <span class="text-[9px] opacity-60">▽</span></div>
                </th>
              </tr>
            </thead>
            <tbody id="tbody_${widget.id}" class="divide-y divide-white/[0.04]">
              <tr>
                <td colspan="9" class="py-12 text-center text-slate-500">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <span class="animate-spin text-cyan-400 text-xl">⏳</span>
                    <span>Consultando dados de switches no Zabbix...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      tbody = document.getElementById(`tbody_${widget.id}`);
      searchInput = document.getElementById(searchId);
      groupSelect = document.getElementById(groupId);
      countBadge = document.getElementById(countId);

      // Carrega os grupos de hosts reais do Zabbix no dropdown
      const loadGroups = () => {
        window.zabbix.getHostGroups().then(groups => {
          if (groups && groups.length > 0 && groupSelect) {
            groupSelect.innerHTML = '<option value="">📁 Todos os Grupos (Zabbix)</option>';
            groups.forEach(g => {
              const opt = document.createElement('option');
              opt.value = g.groupid;
              opt.textContent = `📁 ${g.name}`;
              if (String(g.groupid) === String(widget.config?.group_id || '')) {
                opt.selected = true;
              }
              groupSelect.appendChild(opt);
            });
            state.groupsLoaded = true;
          }
        });
      };
      loadGroups();

      if (groupSelect) {
        groupSelect.onchange = async () => {
          const selGid = groupSelect.value || null;
          widget.config = widget.config || {};
          widget.config.group_id = selGid || '';

          // Grava a mudança do grupo no dashboard automaticamente
          if (window.app) {
            window.app.saveCurrentDashboard(true);
          }

          const newData = await window.zabbix.getSwitchesAnalysis(selGid);
          state.switches = newData.switches || [];
          sortAndFilter();

          if (window.app && newData.summary) {
            window.app.updateStatCardsWithSummary(newData.summary, selGid);
          }
        };
      }

      // Eventos dos botões de filtro rápido
      const updateFilterBtnStyles = () => {
        const btnAll = document.getElementById(`sw_btn_all_${widget.id}`);
        const btnUp = document.getElementById(`sw_btn_up_${widget.id}`);
        const btnDown = document.getElementById(`sw_btn_down_${widget.id}`);
        const btnSw = document.getElementById(`sw_btn_swonly_${widget.id}`);
        const activeClass = 'bg-cyan-600 text-white font-semibold';
        const inactiveClass = 'text-slate-400 hover:text-white font-medium bg-transparent';

        [btnAll, btnUp, btnDown, btnSw].forEach(b => {
          if (b) {
            b.className = `px-2 py-0.5 rounded text-xs transition ${inactiveClass}`;
          }
        });

        if (state.statusFilter === 'all' && btnAll) btnAll.className = `px-2 py-0.5 rounded text-xs transition ${activeClass}`;
        if (state.statusFilter === 'up' && btnUp) btnUp.className = `px-2 py-0.5 rounded text-xs transition ${activeClass}`;
        if (state.statusFilter === 'down' && btnDown) btnDown.className = `px-2 py-0.5 rounded text-xs transition ${activeClass}`;
        if (state.statusFilter === 'sw_only' && btnSw) btnSw.className = `px-2 py-0.5 rounded text-xs transition ${activeClass}`;
      };

      const setStatusFilter = (st) => {
        state.statusFilter = st;
        updateFilterBtnStyles();
        sortAndFilter();
      };

      this.tables[widget.id] = { setStatusFilter };

      const btnAll = document.getElementById(`sw_btn_all_${widget.id}`);
      const btnUp = document.getElementById(`sw_btn_up_${widget.id}`);
      const btnDown = document.getElementById(`sw_btn_down_${widget.id}`);
      const btnSw = document.getElementById(`sw_btn_swonly_${widget.id}`);

      if (btnAll) btnAll.onclick = () => setStatusFilter('all');
      if (btnUp) btnUp.onclick = () => setStatusFilter('up');
      if (btnDown) btnDown.onclick = () => setStatusFilter('down');
      if (btnSw) btnSw.onclick = () => setStatusFilter('sw_only');

      const headers = container.querySelectorAll('th[data-sort]');
      headers.forEach(th => {
        th.onclick = () => {
          const col = th.getAttribute('data-sort');
          if (state.sort.col === col) {
            state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sort.col = col;
            state.sort.dir = 'asc';
          }
          sortAndFilter();
        };
      });

      if (searchInput) {
        searchInput.oninput = () => sortAndFilter();
      }
    }

    const renderRows = (list) => {
      const tb = document.getElementById(`tbody_${widget.id}`);
      const cnt = document.getElementById(countId);
      if (!tb) return;
      if (cnt) cnt.textContent = `${list.length} Switches`;

      if (list.length === 0) {
        tb.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-500 font-medium">Nenhum switch correspondente encontrado com os filtros aplicados.</td></tr>`;
        return;
      }

      tb.innerHTML = list.map(sw => {
        const isUp = sw.ping === 1;
        
        let latBgClass = 'bg-[#15803d]/90 text-white font-bold';
        if (!isUp || sw.latency === 0) {
          latBgClass = 'bg-slate-800 text-slate-400';
        } else if (sw.latency > 30) {
          latBgClass = 'bg-[#b91c1c] text-white font-bold';
        } else if (sw.latency > 15) {
          latBgClass = 'bg-[#ea580c] text-white font-bold';
        }

        let tempBgClass = 'bg-[#15803d]/90 text-white font-bold';
        if (sw.temp === 0) {
          tempBgClass = 'bg-slate-800 text-slate-400';
        } else if (sw.temp > 65) {
          tempBgClass = 'bg-[#dc2626] text-white font-bold';
        } else if (sw.temp >= 40) {
          tempBgClass = 'bg-[#ea580c] text-white font-bold';
        }

        const cpuPct = Math.min(100, Math.max(0, sw.cpu));
        const memPct = Math.min(100, Math.max(0, sw.memory));

        let cpuBarColor = 'bg-emerald-500';
        if (cpuPct > 80) cpuBarColor = 'bg-rose-500';
        else if (cpuPct > 60) cpuBarColor = 'bg-amber-500';

        let memBarColor = 'bg-emerald-500';
        if (memPct > 80) memBarColor = 'bg-rose-500';
        else if (memPct > 50) memBarColor = 'bg-gradient-to-r from-emerald-500 to-amber-500';

        return `
          <tr class="hover:bg-white/[0.03] transition-colors group font-mono text-[11px]">
            <td class="py-2 px-3 font-semibold text-slate-200 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <span class="truncate max-w-[170px]" title="${sw.name}">${sw.name}</span>
                <span class="text-[9px] text-slate-500 font-normal">(${sw.ip})</span>
              </div>
            </td>
            <td class="py-1.5 px-2 text-center whitespace-nowrap">
              <span class="inline-block w-16 py-1 rounded text-[11px] font-bold tracking-wide uppercase ${isUp ? 'bg-[#15803d] text-white' : 'bg-[#b91c1c] text-white animate-pulse'}">
                ${isUp ? 'Up' : 'Down'}
              </span>
            </td>
            <td class="py-1.5 px-2 text-center whitespace-nowrap">
              <span class="inline-block px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700/60 font-mono text-[11px] text-cyan-300 font-semibold tracking-wider">
                ${sw.serial || '-'}
              </span>
            </td>
            <td class="py-1.5 px-2 text-center whitespace-nowrap">
              <span class="inline-block w-20 py-1 rounded text-[11px] ${latBgClass}">
                ${sw.latency > 0 ? sw.latency.toFixed(1) + ' ms' : '-'}
              </span>
            </td>
            <td class="py-2 px-3 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <div class="w-24 h-4 bg-slate-900 rounded overflow-hidden border border-white/5 p-0.5">
                  <div class="h-full ${cpuBarColor} rounded-sm transition-all duration-300" style="width: ${cpuPct}%"></div>
                </div>
                <span class="text-slate-300 font-bold w-10 text-right">${sw.cpu}%</span>
              </div>
            </td>
            <td class="py-2 px-3 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <div class="w-24 h-4 bg-slate-900 rounded overflow-hidden border border-white/5 p-0.5">
                  <div class="h-full ${memBarColor} rounded-sm transition-all duration-300" style="width: ${memPct}%"></div>
                </div>
                <span class="text-slate-300 font-bold w-12 text-right">${sw.memory > 0 ? sw.memory.toFixed(1) + '%' : '-'}</span>
              </div>
            </td>
            <td class="py-1.5 px-2 text-center whitespace-nowrap">
              <span class="inline-block w-20 py-1 rounded text-[11px] ${tempBgClass}">
                ${sw.temp > 0 ? sw.temp.toFixed(1) + ' °C' : '-'}
              </span>
            </td>
            <td class="py-1.5 px-2 text-center whitespace-nowrap">
              <span class="inline-block px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700/60 font-mono text-[11px] text-amber-300 font-semibold" title="${sw.os_version || '-'}">
                ${sw.os_version || '-'}
              </span>
            </td>
            <td class="py-2 px-3 text-right text-slate-300 font-medium whitespace-nowrap">
              ${sw.uptime}
            </td>
          </tr>
        `;
      }).join('');
    };

    const sortAndFilter = () => {
      const srch = document.getElementById(searchId);
      let filtered = [...state.switches];

      // Filtro de status (Todos, UP, DOWN, ou Apenas Switches)
      if (state.statusFilter === 'up') {
        filtered = filtered.filter(s => s.ping === 1);
      } else if (state.statusFilter === 'down') {
        filtered = filtered.filter(s => s.ping !== 1);
      } else if (state.statusFilter === 'sw_only') {
        filtered = filtered.filter(s => {
          const n = (s.name || '').toLowerCase();
          return n.startsWith('sw') || n.includes('switch') || n.includes('sw-') || n.includes('sw_');
        });
      }

      // Filtro por texto de busca
      const term = (srch?.value || '').toLowerCase().trim();
      if (term) {
        filtered = filtered.filter(s => 
          (s.name && s.name.toLowerCase().includes(term)) || 
          (s.ip && s.ip.includes(term)) ||
          (s.serial && s.serial.toLowerCase().includes(term)) ||
          (s.os_version && s.os_version.toLowerCase().includes(term))
        );
      }

      filtered.sort((a, b) => {
        let valA = a[state.sort.col];
        let valB = b[state.sort.col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return state.sort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return state.sort.dir === 'asc' ? 1 : -1;
        return 0;
      });

      renderRows(filtered);
    };

    // Busca dados em segundo plano sem destruir ou piscar a interface
    const activeGid = groupSelect?.value || widget.config?.group_id || null;
    const data = await window.zabbix.getSwitchesAnalysis(activeGid);
    state.switches = data.switches || [];
    sortAndFilter();

    if (window.app && data.summary) {
      window.app.updateStatCardsWithSummary(data.summary, activeGid);
    }
  }

  // Roteador de renderização
  render(widget, container) {
    switch (widget.type) {
      case 'clock':
        this.renderClock(widget, container);
        break;
      case 'brand_banner':
        this.renderBrandBanner(widget, container);
        break;
      case 'stat_card':
        this.renderStatCard(widget, container);
        break;
      case 'switches_table':
        this.renderSwitchesTable(widget, container);
        break;
      case 'problems_table':
        this.renderProblemsTable(widget, container);
        break;
      case 'host_status_grid':
        this.renderHostStatusGrid(widget, container);
        break;
      case 'top_n':
        this.renderTopN(widget, container);
        break;
      case 'gauge':
        this.renderGauge(widget, container);
        break;
      case 'graph':
        this.renderGraph(widget, container);
        break;
      default:
        container.innerHTML = `
          ${this.renderHeader(widget)}
          <div class="p-4 text-xs text-slate-400">Tipo de widget desconhecido: ${widget.type}</div>
        `;
        break;
    }
  }
}

window.widgetRegistry = new WidgetRegistry();
