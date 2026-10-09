<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DTCEA-SJ NOC - Monitoramento</title>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#ecfeff',
              500: '#06b6d4',
              600: '#0891b2',
              900: '#164e63',
            }
          }
        }
      }
    }
  </script>

  <!-- GridStack CSS & JS -->
  <link href="https://cdn.jsdelivr.net/npm/gridstack@9.2.2/dist/gridstack.min.css" rel="stylesheet"/>
  <script src="https://cdn.jsdelivr.net/npm/gridstack@9.2.2/dist/gridstack-all.js"></script>

  <!-- ApexCharts -->
  <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>

  <!-- Custom CSS -->
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="icon" type="image/png" href="dtcea_sj_logo.png">
</head>
<body class="bg-[#0c1524] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">

  <!-- Floating NOC TV exit / status bar (only visible in kiosk mode) -->
  <div class="kiosk-bar hidden fixed top-2 right-3 z-50 flex items-center gap-2 bg-slate-800/95 border border-slate-600 px-3.5 py-1.5 rounded-full shadow-2xl backdrop-blur-md">
    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-active"></span>
    <span class="text-xs font-mono text-cyan-300 font-bold" id="kiosk-title">NOC TV</span>
    <span class="text-xs font-mono text-slate-400">|</span>
    <span class="text-xs font-mono text-slate-300 font-semibold" id="kiosk-refresh">40s</span>
    <button onclick="app.toggleKioskMode()" class="ml-1 text-slate-200 hover:text-white text-xs font-bold px-2.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 border border-slate-500 shadow-sm">
      Sair (ESC)
    </button>
  </div>

  <!-- Header / Navigation Bar -->
  <header class="border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-black/20">
    <div class="max-w-[1920px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
      
      <!-- Brand & Dashboard Title -->
      <div class="flex items-center gap-3 shrink-0">
        <div class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center shadow-lg shadow-cyan-500/10 p-1 shrink-0 overflow-hidden">
          <img src="dtcea_sj_logo.png" alt="DTCEA-SJ" class="w-full h-full object-contain">
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <span>DTCEA-SJ</span>
              <span class="text-cyan-400">NOC</span>
            </h1>
          </div>
          <div class="text-[12px] text-slate-300 font-semibold truncate max-w-[240px]" id="dash-header-title">
            Carregando...
          </div>
        </div>
      </div>

      <!-- Center: Dashboard Switcher -->
      <div class="flex items-center gap-2">
        <div class="relative">
          <select id="dashboard-select" onchange="app.loadDashboard(this.value)" 
                  class="bg-slate-800 border border-slate-600 hover:border-slate-500 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-cyan-400 pr-8 cursor-pointer transition shadow-sm">
          </select>
        </div>
        <button onclick="app.promptNewDashboard()" title="Criar Novo Dashboard" class="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-200 hover:text-white transition text-xs shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
        <button onclick="app.deleteCurrentDashboard()" title="Excluir Dashboard Atual" class="p-1.5 bg-slate-800 hover:bg-rose-950/60 border border-slate-600 hover:border-rose-500/60 rounded-lg text-slate-300 hover:text-rose-400 transition text-xs shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>

      <!-- Right Action Controls -->
      <div class="flex items-center gap-2.5">
        
        <!-- Auto Refresh Indicator -->
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 font-semibold shadow-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-active"></span>
          <span id="refresh-counter">40s</span>
          <button onclick="app.refreshDashboardData()" title="Atualizar agora" class="text-slate-400 hover:text-cyan-400 ml-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>

        <!-- Add Widget -->
        <button onclick="editor.openAddWidgetModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-md shadow-cyan-600/30">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
          <span>Widget</span>
        </button>

        <!-- Code Editor (JSON) -->
        <button onclick="editor.openCodeEditorModal()" title="Editar Layout em Código JSON" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs transition shadow-sm">
          <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
          <span>Código JSON</span>
        </button>

        <!-- Save Layout -->
        <button onclick="app.saveCurrentDashboard()" id="btn-save-dashboard" title="Gravar posições e tamanhos dos painéis" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-semibold text-xs transition hover:border-emerald-500/60 shadow-sm">
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
          <span>Salvar Layout</span>
        </button>

        <!-- NOC TV / Fullscreen -->
        <button onclick="app.toggleKioskMode()" title="Modo TV / NOC Fullscreen" class="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-200 hover:text-white transition shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
        </button>

        <!-- Settings (Zabbix API) -->
        <button onclick="editor.openSettingsModal()" title="Configurações do Zabbix 7.0" class="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-200 hover:text-white transition shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>

      </div>
    </div>
  </header>

  <!-- Main Dashboard Canvas Area -->
  <main id="main-container" class="flex-1 p-3 max-w-[1920px] w-full mx-auto">
    <div class="grid-stack min-h-[calc(100vh-80px)]"></div>
  </main>

  <!-- MODAL 1: Adicionar Widget -->
  <div id="modal-add-widget" class="modal-backdrop hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
      <div class="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <span class="text-cyan-400">➕</span> Adicionar Novo Widget
        </h3>
        <button onclick="editor.closeAllModals()" class="text-slate-400 hover:text-white text-sm">✕</button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Título do Widget</label>
          <input type="text" id="widget-title-input" value="Novo Painel" 
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Tipo de Widget</label>
          <select id="widget-type-select" onchange="editor.updateWidgetFormFields()"
                  class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
            <option value="switches_table">🔀 Tabela Análise de Switches / Servidores (Grafana Style)</option>
            <option value="brand_banner">🏷️ Banner de Marca / Logo (Ex: DTCEA-SJ)</option>
            <option value="problems_table">🚨 Tabela de Alarmes / Incidentes (Zabbix 7.0)</option>
            <option value="graph">📈 Gráfico Temporal de Métrica (ApexCharts)</option>
            <option value="gauge">🎯 Medidor Gauge (CPU, RAM, Disco %)</option>
            <option value="host_status_grid">🟢 Grid de Status de Hosts</option>
            <option value="top_n">🏆 Top N Recursos Consumidos</option>
            <option value="stat_card">📊 Cartão de Estatística Resumida</option>
            <option value="clock">🕒 Relógio Operacional NOC</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Largura (Colunas 1-12)</label>
            <select id="widget-width-select" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="3">3 colunas (1/4)</option>
              <option value="4">4 colunas (1/3)</option>
              <option value="6" selected>6 colunas (1/2)</option>
              <option value="8">8 colunas (2/3)</option>
              <option value="12">12 colunas (Total)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Altura</label>
            <select id="widget-height-select" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="2">2 linhas (Compacto)</option>
              <option value="3">3 linhas</option>
              <option value="4" selected>4 linhas (Padrão)</option>
              <option value="5">5 linhas (Amplo)</option>
            </select>
          </div>
        </div>

        <div id="widget-dynamic-fields" class="p-3 bg-slate-950/60 rounded-xl border border-white/5"></div>
      </div>
      <div class="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
        <button onclick="editor.closeAllModals()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">Cancelar</button>
        <button onclick="editor.submitAddWidget()" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">Adicionar ao Grid</button>
      </div>
    </div>
  </div>

  <!-- MODAL 2: Editor de Código JSON -->
  <div id="modal-code-editor" class="modal-backdrop hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-cyan-400"></div>
          <h3 class="text-sm font-bold text-white">Editor de Layout em Código (JSON)</h3>
          <span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">Edite, customize e salve o JSON diretamente</span>
        </div>
        <button onclick="editor.closeAllModals()" class="text-slate-400 hover:text-white text-sm">✕</button>
      </div>
      <div class="flex-1 p-4 flex flex-col bg-[#080d1a]">
        <div id="json-code-error" class="hidden mb-2 p-2.5 rounded bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs"></div>
        <textarea id="json-code-textarea" spellcheck="false" 
                  class="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"></textarea>
      </div>
      <div class="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
        <button onclick="editor.formatCodeEditorJson()" class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono">
          ✨ Formatar JSON
        </button>
        <div class="flex gap-2">
          <button onclick="editor.closeAllModals()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">Cancelar</button>
          <button onclick="editor.submitCodeEditor()" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">Aplicar e Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 3: Configurações do Zabbix 7.0 -->
  <div id="modal-settings" class="modal-backdrop hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
      <div class="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Configurações de Conexão com o Zabbix 7.0
        </h3>
        <button onclick="editor.closeAllModals()" class="text-slate-400 hover:text-white text-sm">✕</button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">URL do Servidor Zabbix</label>
          <input type="text" id="set-zabbix-url" placeholder="http://seu-servidor-zabbix ou http://192.168.1.100/zabbix" 
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
          <span class="text-[10px] text-slate-500">O endpoint <code class="text-cyan-400">/api_jsonrpc.php</code> é detectado automaticamente</span>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">API Token do Zabbix (Recomendado no Zabbix 7.0)</label>
          <input type="password" id="set-api-token" placeholder="Cole o token gerado em Administração -> API tokens" 
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono">
          <span class="text-[10px] text-slate-500">Gere em: <em>Administração &gt; Tokens de API &gt; Criar token de API</em></span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Intervalo de Refresh (segundos)</label>
            <input type="number" id="set-refresh-interval" value="40" min="5" max="300"
                   class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
          </div>
          <div class="flex items-center gap-2 pt-5">
            <input type="checkbox" id="set-verify-ssl" class="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0">
            <label for="set-verify-ssl" class="text-xs text-slate-300 cursor-pointer">Verificar Certificado SSL</label>
          </div>
        </div>

        <div id="conn-test-result" class="hidden"></div>
      </div>
      <div class="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
        <button id="btn-test-conn" onclick="editor.testZabbixConnection()" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700">
          🔌 Testar Conexão
        </button>
        <div class="flex gap-2">
          <button onclick="editor.closeAllModals()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">Cancelar</button>
          <button onclick="editor.submitSettings()" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">Salvar Configurações</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 4: Editar Widget / Configurar Painel -->
  <div id="modal-edit-widget" class="modal-backdrop hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
      <div class="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <span class="text-cyan-400">⚙️</span> Configurar Card / Painel
        </h3>
        <button onclick="editor.closeAllModals()" class="text-slate-400 hover:text-white text-sm">✕</button>
      </div>
      <div class="p-5 space-y-4">
        <input type="hidden" id="edit-widget-id">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Título do Painel</label>
          <input type="text" id="edit-widget-title" 
                 class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Filtrar por Grupo de Hosts do Zabbix</label>
          <select id="edit-widget-group" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
            <option value="">📁 Todos os Grupos (Zabbix)</option>
          </select>
          <span class="text-[10px] text-slate-500">Selecione o grupo (ex: Switches) para contabilizar apenas os equipamentos desse grupo</span>
        </div>
      </div>
      <div class="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
        <button onclick="editor.closeAllModals()" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium">Cancelar</button>
        <button onclick="editor.submitEditWidget()" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">Salvar Alterações</button>
      </div>
    </div>
  </div>

  <!-- App Scripts -->
  <script src="assets/js/zabbix-client.js"></script>
  <script src="assets/js/widgets/widget-registry.js"></script>
  <script src="assets/js/dashboard-editor.js"></script>
  <script src="assets/js/app.js"></script>
</body>
</html>
