/**
 * Zabbix API Client Wrapper (comunicação com backend PHP)
 */
class ZabbixClient {
  constructor() {
    this.baseUrl = 'api/zabbix.php';
  }

  async testConnection(data = {}) {
    try {
      const res = await fetch(`${this.baseUrl}?action=test_connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getSummary() {
    try {
      const res = await fetch(`${this.baseUrl}?action=summary`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar summary:', err);
      return { success: false, result: null };
    }
  }

  async getProblems(limit = 30, severities = null) {
    try {
      let url = `${this.baseUrl}?action=problems&limit=${limit}`;
      if (severities && severities.length > 0) {
        url += `&severities=${severities.join(',')}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.error('Erro ao buscar problemas:', err);
      return [];
    }
  }

  async getHosts(groupids = null) {
    try {
      let url = `${this.baseUrl}?action=hosts`;
      if (groupids) url += `&groupids=${groupids}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.error('Erro ao buscar hosts:', err);
      return [];
    }
  }

  async getHostGroups() {
    try {
      const res = await fetch(`${this.baseUrl}?action=hostgroups`);
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.error('Erro ao buscar hostgroups:', err);
      return [];
    }
  }

  async getItems(hostids = null, search = null) {
    try {
      let url = `${this.baseUrl}?action=items`;
      if (hostids) url += `&hostids=${hostids}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.error('Erro ao buscar items:', err);
      return [];
    }
  }

  async getHistory(itemids, historyType = 0, limit = 60, timeFrom = null) {
    try {
      const payload = {
        itemids: Array.isArray(itemids) ? itemids : [itemids],
        history: historyType,
        limit: limit,
        time_from: timeFrom || Math.floor(Date.now() / 1000) - 3600
      };
      const res = await fetch(`${this.baseUrl}?action=history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return [];
    }
  }

  async getSwitchesAnalysis(groupids = null, search = null) {
    try {
      let url = `${this.baseUrl}?action=switches_analysis`;
      if (groupids) url += `&groupids=${groupids}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar análise de switches:', err);
      return { success: false, switches: [], summary: { total: 0, up: 0, down: 0 } };
    }
  }

  async customRpc(method, params = {}) {
    try {
      const res = await fetch(`${this.baseUrl}?action=rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params })
      });
      return await res.json();
    } catch (err) {
      return { error: { message: err.message } };
    }
  }
}

window.zabbix = new ZabbixClient();
