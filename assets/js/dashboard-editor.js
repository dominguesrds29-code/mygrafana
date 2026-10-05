/**
 * Dashboard Studio & Code Editor (Edição Visual e Programática em JSON)
 */

class DashboardEditor {
  constructor() {
    this.initModals();
  }

  initModals() {
    // Escuta teclas de atalho (ex: ESC para fechar modais)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.classList.add('hidden'));
  }

  // Abre modal de adicionar novo widget
  openAddWidgetModal() {
    const modal = document.getElementById('modal-add-widget');
    if (modal) {
      modal.classList.remove('hidden');
      this.updateWidgetFormFields();
    }
  }

  // Atualiza campos dinâmicos no formulário de adição de widget
  updateWidgetFormFields() {
    const type = document.getElementById('widget-type-select')?.value || 'stat_card';
    const dynamicFields = document.getElementById('widget-dynamic-fields');
    if (!dynamicFields) return;

    if (type === 'stat_card') {
      dynamicFields.innerHTML = `
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Métrica</label>
            <select id="wcfg-metric" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="switches_total">Total de Switches Monitorados</option>
              <option value="switches_up">Switches Online (UP)</option>
              <option value="switches_down">Switches Offline / Alerta (DOWN)</option>
              <option value="problems_count">Contador de Incidentes Ativos</option>
              <option value="problems_unack">Incidentes Não Reconhecidos</option>
              <option value="hosts_availability">Porcentagem de Hosts Disponíveis</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Estilo do Cartão</label>
            <select id="wcfg-cardstyle" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="glass">Padrão Glassmorphism (Translúcido)</option>
              <option value="solid_blue">Azul Sólido (Total Switches)</option>
              <option value="solid_green">Verde Sólido (Switches UP / OK)</option>
              <option value="solid_red">Vermelho Sólido (Switches DOWN / Crítico)</option>
              <option value="solid_amber">Laranja Sólido (Atenção)</option>
            </select>
          </div>
        </div>
      `;
    } else if (type === 'brand_banner') {
      dynamicFields.innerHTML = `
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nome da Empresa / Marca</label>
            <input type="text" id="wcfg-brand-name" value="BEE SOLUTIONS" 
                   class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Subtítulo / Descrição</label>
            <input type="text" id="wcfg-subtitle" value="Análise de Switches (TV)" 
                   class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
          </div>
        </div>
      `;
    } else if (type === 'switches_table') {
      dynamicFields.innerHTML = `
        <div class="text-xs text-slate-400">
          Exibe a tabela completa de switches estilo Grafana TV com status de Ping, Perdas %, Latência (ms), CPU, Memória, Temperatura e Uptime.
        </div>
      `;
    } else if (type === 'graph' || type === 'gauge' || type === 'top_n') {
      dynamicFields.innerHTML = `
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Buscar Item por Nome / Chave no Zabbix</label>
            <input type="text" id="wcfg-search" placeholder="Ex: CPU utilization, Memory, Network traffic" value="CPU" 
                   class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
            <span class="text-[10px] text-slate-500">Busca dinâmica em itens coletados pelo Zabbix</span>
          </div>
          ${type === 'graph' ? `
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Tipo de Gráfico</label>
                <select id="wcfg-charttype" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
                  <option value="area">Área com Gradiente</option>
                  <option value="line">Linha Suave</option>
                  <option value="bar">Barras</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Cor</label>
                <input type="color" id="wcfg-color" value="#06b6d4" class="w-full h-8 bg-slate-900 border border-slate-700 rounded-lg p-1 cursor-pointer">
              </div>
            </div>
          ` : ''}
          ${type === 'top_n' || type === 'gauge' ? `
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Unidade</label>
              <input type="text" id="wcfg-unit" value="%" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
            </div>
          ` : ''}
        </div>
      `;
    } else if (type === 'problems_table') {
      dynamicFields.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Limite Máximo de Linhas</label>
          <input type="number" id="wcfg-limit" value="15" min="5" max="100" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
        </div>
      `;
    } else {
      dynamicFields.innerHTML = '';
    }
  }

  // Cria o novo widget e adiciona ao grid
  submitAddWidget() {
    const title = document.getElementById('widget-title-input')?.value || 'Novo Widget';
    const type = document.getElementById('widget-type-select')?.value || 'stat_card';
    const width = parseInt(document.getElementById('widget-width-select')?.value || '4');
    const height = parseInt(document.getElementById('widget-height-select')?.value || '3');

    const config = {};
    if (type === 'stat_card') {
      config.metric_type = document.getElementById('wcfg-metric')?.value || 'switches_total';
      config.card_style = document.getElementById('wcfg-cardstyle')?.value || 'glass';
      if (config.card_style !== 'glass') {
        config.show_header = false;
      }
    } else if (type === 'brand_banner') {
      config.brand_name = document.getElementById('wcfg-brand-name')?.value || 'BEE SOLUTIONS';
      config.subtitle = document.getElementById('wcfg-subtitle')?.value || 'Análise de Switches (TV)';
    } else if (type === 'switches_table') {
      config.show_status = true;
    } else if (type === 'graph') {
      config.search_item = document.getElementById('wcfg-search')?.value || 'CPU';
      config.chart_type = document.getElementById('wcfg-charttype')?.value || 'area';
      config.color = document.getElementById('wcfg-color')?.value || '#06b6d4';
      config.history_limit = 50;
    } else if (type === 'gauge') {
      config.search_item = document.getElementById('wcfg-search')?.value || 'CPU';
      config.unit = document.getElementById('wcfg-unit')?.value || '%';
    } else if (type === 'top_n') {
      config.search_item = document.getElementById('wcfg-search')?.value || 'CPU';
      config.unit = document.getElementById('wcfg-unit')?.value || '%';
      config.limit = 5;
    } else if (type === 'problems_table') {
      config.limit = parseInt(document.getElementById('wcfg-limit')?.value || '15');
    }

    const newWidget = {
      id: 'w_' + Date.now(),
      type: type,
      title: title,
      x: 0,
      y: 0,
      w: width,
      h: height,
      config: config
    };

    window.app.addWidget(newWidget);
    this.closeAllModals();
  }

  // Abre modal do editor de código JSON
  openCodeEditorModal() {
    const modal = document.getElementById('modal-code-editor');
    const textarea = document.getElementById('json-code-textarea');
    if (modal && textarea && window.app.currentDashboard) {
      // Atualiza coordenadas atuais do grid antes de abrir
      window.app.syncGridToDashboardData();
      textarea.value = JSON.stringify(window.app.currentDashboard, null, 2);
      modal.classList.remove('hidden');
    }
  }

  // Salva e compila o JSON do editor de código
  submitCodeEditor() {
    const textarea = document.getElementById('json-code-textarea');
    const errorEl = document.getElementById('json-code-error');
    if (!textarea) return;

    try {
      const parsed = JSON.parse(textarea.value);
      if (!parsed.id || !parsed.title || !Array.isArray(parsed.widgets)) {
        throw new Error('O JSON precisa conter as propriedades "id", "title" e o array "widgets".');
      }
      
      window.app.currentDashboard = parsed;
      window.app.renderActiveDashboard();
      window.app.saveCurrentDashboard();
      this.closeAllModals();
      if (errorEl) errorEl.classList.add('hidden');
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Erro no JSON: ' + err.message;
        errorEl.classList.remove('hidden');
      }
    }
  }

  // Formata o JSON no editor de código
  formatCodeEditorJson() {
    const textarea = document.getElementById('json-code-textarea');
    if (!textarea) return;
    try {
      const parsed = JSON.parse(textarea.value);
      textarea.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      alert('JSON inválido para formatação!');
    }
  }

  // Abre modal de configurações do Zabbix
  async openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    try {
      const res = await fetch('api/config.php?action=get');
      const data = await res.json();
      if (data.success && data.settings) {
        document.getElementById('set-zabbix-url').value = data.settings.zabbix_url || '';
        document.getElementById('set-api-token').placeholder = data.settings.has_token ? `Token salvo (${data.settings.masked_token})` : 'Digite seu API Token do Zabbix 7.0';
        document.getElementById('set-verify-ssl').checked = !!data.settings.verify_ssl;
        document.getElementById('set-refresh-interval').value = data.settings.refresh_interval || 30;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Testa conexão com Zabbix
  async testZabbixConnection() {
    const btn = document.getElementById('btn-test-conn');
    const resultEl = document.getElementById('conn-test-result');
    const url = document.getElementById('set-zabbix-url').value;
    const token = document.getElementById('set-api-token').value;
    const verifySsl = document.getElementById('set-verify-ssl').checked;

    if (!url) {
      alert('Por favor informe a URL do seu Zabbix.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Testando...`;
    }

    const res = await window.zabbix.testConnection({
      zabbix_url: url,
      api_token: token,
      verify_ssl: verifySsl
    });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `🔌 Testar Conexão`;
    }

    if (resultEl) {
      resultEl.classList.remove('hidden');
      if (res.success) {
        resultEl.className = 'p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs';
        resultEl.innerHTML = `
          <strong> Conexão bem sucedida!</strong><br>
          Versão do Zabbix detectada: <span class="font-mono font-bold">${res.version}</span><br>
          Autenticação: ${res.authenticated ? `<span class="text-emerald-300 font-semibold">Válida (${res.host_count} hosts encontrados)</span>` : `<span class="text-amber-400">Token não fornecido ou inválido${res.auth_error ? ` (${res.auth_error})` : ''}</span>`}
        `;
      } else {
        resultEl.className = 'p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs';
        resultEl.innerHTML = `<strong>❌ Falha na conexão:</strong> ${res.error || 'Não foi possível conectar ao servidor'}`;
      }
    }
  }

  // Salva configurações do Zabbix
  async submitSettings() {
    const url = document.getElementById('set-zabbix-url').value;
    const token = document.getElementById('set-api-token').value;
    const verifySsl = document.getElementById('set-verify-ssl').checked;
    const interval = parseInt(document.getElementById('set-refresh-interval').value || '30');

    try {
      const res = await fetch('api/config.php?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zabbix_url: url,
          api_token: token,
          verify_ssl: verifySsl,
          refresh_interval: interval
        })
      });
      const data = await res.json();
      if (data.success) {
        this.closeAllModals();
        // Recarrega dashboard
        window.app.refreshDashboardData();
      } else {
        alert(data.error || 'Erro ao salvar.');
      }
    } catch (e) {
      alert('Erro de conexão com o servidor.');
    }
  }
}

window.editor = new DashboardEditor();
