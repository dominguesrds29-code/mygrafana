/**
 * Widget Registry & Renderers for Zabbix Dashboards
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
    this.charts = {}; // Armazena instâncias de gráficos para destruir/atualizar
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
          <button onclick="app.removeWidget('${widget.id}')" class="widget-delete-btn p-1 hover:text-rose-400 text-slate-400 text-xs rounded" title="Remover Widget">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  // 1. Widget: Relógio NOC
  renderClock(widget, container) {
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
    if (!widget._clockInterval) {
      widget._clockInterval = setInterval(updateClock, 1000);
    }
  }

  // 2. Widget: Stat Card / Cartão de Estatística
  async renderStatCard(widget, container) {
    container.innerHTML = `
      ${this.renderHeader(widget)}
      <div class="flex-1 flex items-center justify-between p-4">
        <div>
          <div class="text-2xl font-extrabold font-mono text-slate-100" id="stat_val_${widget.id}">
            <span class="animate-pulse text-slate-500">...</span>
          </div>
          <div class="text-xs text-slate-400 mt-0.5" id="stat_sub_${widget.id}">
            Buscando dados...
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </div>
      </div>
    `;

    const summary = await window.zabbix.getSummary();
    const valEl = document.getElementById(`stat_val_${widget.id}`);
    const subEl = document.getElementById(`stat_sub_${widget.id}`);
    if (!valEl) return;

    const metric = widget.config?.metric_type || 'problems_count';
    if (summary && summary.result) {
      const data = summary.result;
      if (metric === 'hosts_availability') {
        const total = data.total_hosts || 0;
        const avail = data.available_hosts || 0;
        const pct = total > 0 ? ((avail / total) * 100).toFixed(1) : '100';
        valEl.innerHTML = `<span class="text-emerald-400">${pct}%</span> <span class="text-xs text-slate-400">(${avail}/${total})</span>`;
        subEl.textContent = 'Hosts operando normalmente';
      } else if (metric === 'problems_count') {
        const total = data.problems_total || 0;
        const color = total > 0 ? (data.by_severity[5] > 0 ? 'text-rose-500' : 'text-amber-400') : 'text-emerald-400';
        valEl.innerHTML = `<span class="${color}">${total}</span>`;
        subEl.textContent = total === 0 ? 'Tudo operando normalmente' : `${data.by_severity[5] || 0} Desastre(s), ${data.by_severity[4] || 0} Alto(s)`;
      } else if (metric === 'problems_unack') {
        const unack = data.problems_unack || 0;
        valEl.innerHTML = `<span class="${unack > 0 ? 'text-rose-400' : 'text-slate-200'}">${unack}</span>`;
        subEl.textContent = 'Alertas pendentes de reconhecimento';
      }
    } else {
      valEl.innerHTML = `<span class="text-slate-400 text-base">Sem Conexão</span>`;
      subEl.textContent = 'Configure o Zabbix na engrenagem ⚙️';
    }
  }

  // 3. Widget: Tabela de Problemas (Incidentes)
  async renderProblemsTable(widget, container) {
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

    const limit = widget.config?.limit || 20;
    const problems = await window.zabbix.getProblems(limit);
    const tbody = document.getElementById(`prob_body_${widget.id}`);
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

    const hosts = await window.zabbix.getHosts();
    const grid = document.getElementById(`host_grid_${widget.id}`);
    const searchInput = document.getElementById(`host_search_${widget.id}`);
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

    renderList();
    if (searchInput) {
      searchInput.oninput = (e) => renderList(e.target.value);
    }
  }

  // 5. Widget: Top N Recursos Consumidos
  async renderTopN(widget, container) {
    container.innerHTML = `
      ${this.renderHeader(widget)}
      <div class="flex-1 overflow-auto p-3" id="top_n_body_${widget.id}">
        <div class="py-6 text-center text-slate-500">Buscando itens e métricas...</div>
      </div>
    `;

    const searchKey = widget.config?.search_item || 'CPU';
    const unit = widget.config?.unit || '%';
    const limit = widget.config?.limit || 5;

    const items = await window.zabbix.getItems(null, searchKey);
    const body = document.getElementById(`top_n_body_${widget.id}`);
    if (!body) return;

    if (!items || items.length === 0) {
      body.innerHTML = `<div class="py-6 text-center text-slate-500">Nenhum item encontrado com o termo "${searchKey}".</div>`;
      return;
    }

    // Ordena pelo lastvalue decrescente
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
    container.innerHTML = `
      ${this.renderHeader(widget)}
      <div class="flex-1 flex flex-col items-center justify-center p-2 relative">
        <div id="chart_${widget.id}" class="w-full flex justify-center"></div>
        <div class="text-xs text-slate-400 font-medium mt-[-10px] text-center truncate max-w-[80%]" id="gauge_label_${widget.id}">
          Carregando...
        </div>
      </div>
    `;

    const searchKey = widget.config?.search_item || 'CPU utilization';
    const items = await window.zabbix.getItems(null, searchKey);
    const chartContainer = document.getElementById(`chart_${widget.id}`);
    const labelEl = document.getElementById(`gauge_label_${widget.id}`);
    if (!chartContainer) return;

    let value = 0;
    let label = searchKey;

    if (items && items.length > 0) {
      const topItem = items[0];
      value = parseFloat(topItem.lastvalue) || 0;
      label = `${topItem.hosts?.[0]?.name || ''} - ${topItem.name}`;
    }

    if (labelEl) labelEl.textContent = label;

    if (this.charts[widget.id]) {
      this.charts[widget.id].destroy();
    }

    const options = {
      series: [Math.min(100, Math.max(0, Math.round(value)))],
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
        colors: [value > 90 ? '#e11d48' : (value > 75 ? '#d97706' : '#06b6d4')]
      },
      stroke: { dashArray: 4 }
    };

    this.charts[widget.id] = new ApexCharts(chartContainer, options);
    this.charts[widget.id].render();
  }

  // 7. Widget: Gráfico Temporal de Histórico (ApexCharts)
  async renderGraph(widget, container) {
    container.innerHTML = `
      ${this.renderHeader(widget)}
      <div class="flex-1 flex flex-col p-2 relative">
        <div id="chart_${widget.id}" class="flex-1 w-full min-h-[160px]"></div>
      </div>
    `;

    const searchKey = widget.config?.search_item || 'CPU';
    const chartType = widget.config?.chart_type || 'area';
    const chartColor = widget.config?.color || '#38bdf8';
    const chartContainer = document.getElementById(`chart_${widget.id}`);
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

    // Se não tiver dados de histórico reais ainda, exibe placeholder suave
    if (seriesData.length === 0) {
      const now = Date.now();
      for (let i = 20; i >= 0; i--) {
        seriesData.push([now - (i * 60000), Math.floor(Math.random() * 25) + 15]);
      }
    }

    if (this.charts[widget.id]) {
      this.charts[widget.id].destroy();
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

  // Roteador de renderização
  render(widget, container) {
    switch (widget.type) {
      case 'clock':
        this.renderClock(widget, container);
        break;
      case 'stat_card':
        this.renderStatCard(widget, container);
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
