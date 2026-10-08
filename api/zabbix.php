<?php
/**
 * Zabbix 7.0 JSON-RPC 2.0 API Proxy
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

$settings = get_app_settings();

function normalize_zabbix_url($rawUrl) {
    $url = trim($rawUrl ?? '');
    if (empty($url)) return '';
    
    // Remove query string e fragmentos
    $url = strtok($url, '?#');
    $url = rtrim($url, '/');
    
    // Se o usuário colocou index.php, zabbix.php, api_jsonrpc.php etc no final, limpa o arquivo php
    $url = preg_replace('/\/[a-zA-Z0-9_\-]+\.php$/i', '', $url);
    $url = rtrim($url, '/');
    
    return $url . '/api_jsonrpc.php';
}

function zabbix_rpc_request($method, $params = [], $auth = null) {
    global $settings;

    $url = normalize_zabbix_url($settings['zabbix_url'] ?? '');
    if (empty($url)) {
        return ['error' => ['message' => 'URL do Zabbix não configurada no painel de configurações.']];
    }

    $token = !empty($auth) ? $auth : ($settings['api_token'] ?? '');
    $isPublicMethod = in_array($method, ['apiinfo.version', 'user.login', 'user.checkAuthentication']);

    $payload = [
        'jsonrpc' => '2.0',
        'method' => $method,
        'params' => $params,
        'id' => time()
    ];

    // No Zabbix 7.0, o token pode ser enviado no cabeçalho Authorization Bearer ou no campo auth
    // Métodos públicos como apiinfo.version rejeitam o parâmetro 'auth' com "Invalid params."
    if (!empty($token) && !$isPublicMethod) {
        $payload['auth'] = $token;
    }

    $ch = curl_init($url);
    $headers = [
        'Content-Type: application/json-rpc',
        'Accept: application/json'
    ];
    if (!empty($token) && !$isPublicMethod) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

    // Ignora proxy de ambiente (Squid) para chamadas na rede local/interna
    curl_setopt($ch, CURLOPT_PROXY, '');
    curl_setopt($ch, CURLOPT_NOPROXY, '*');

    if (empty($settings['verify_ssl'])) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['error' => ['message' => 'Falha na conexão cURL: ' . $curlError]];
    }

    $json = json_decode($response, true);
    if ($json === null) {
        $cleanResp = trim(strip_tags(substr($response, 0, 150)));
        return ['error' => ['message' => 'Resposta inválida do Zabbix (HTTP ' . $httpCode . '): ' . ($cleanResp ?: 'Corpo não é um JSON válido')]];
    }

    return $json;
}

$action = $_GET['action'] ?? 'rpc';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

switch ($action) {
    case 'test_connection':
        // Testa a conexão usando apiinfo.version e host.get
        $testUrl = $input['zabbix_url'] ?? $settings['zabbix_url'];
        $testToken = $input['api_token'] ?? $settings['api_token'];
        
        $tempSettings = $settings;
        $tempSettings['zabbix_url'] = $testUrl;
        $tempSettings['api_token'] = $testToken;
        $tempSettings['verify_ssl'] = $input['verify_ssl'] ?? false;
        
        $oldSettings = $settings;
        $settings = $tempSettings;
        
        // Chamada apiinfo.version (pública, não requer autenticação)
        $versionRes = zabbix_rpc_request('apiinfo.version', []);
        
        if (isset($versionRes['error'])) {
            $settings = $oldSettings;
            $errMsg = $versionRes['error']['message'] ?? 'Erro desconhecido';
            if (!empty($versionRes['error']['data'])) {
                $errMsg .= ' (' . $versionRes['error']['data'] . ')';
            }
            echo json_encode(['success' => false, 'error' => $errMsg]);
            exit;
        }

        $version = $versionRes['result'] ?? 'Desconhecida';
        
        // Se forneceu token, testa autenticação buscando contagem de hosts
        $authValid = false;
        $hostCount = 0;
        $authError = null;
        if (!empty($testToken)) {
            $authRes = zabbix_rpc_request('host.get', ['countOutput' => true], $testToken);
            if (!isset($authRes['error'])) {
                $authValid = true;
                $hostCount = intval($authRes['result'] ?? 0);
            } else {
                $authError = $authRes['error']['message'] ?? 'Token inválido';
                if (!empty($authRes['error']['data'])) {
                    $authError .= ' (' . $authRes['error']['data'] . ')';
                }
            }
        }

        $settings = $oldSettings;
        echo json_encode([
            'success' => true,
            'version' => $version,
            'authenticated' => $authValid,
            'auth_error' => $authError,
            'host_count' => $hostCount
        ]);
        break;

    case 'rpc':
        // Proxy RPC genérico
        $method = $input['method'] ?? '';
        $params = $input['params'] ?? [];
        if (empty($method)) {
            echo json_encode(['error' => ['message' => 'Método RPC não especificado.']]);
            exit;
        }
        $res = zabbix_rpc_request($method, $params);
        echo json_encode($res);
        break;

    case 'hostgroups':
        // 1. Tenta buscar grupos de hosts diretamente pelo método padrão do Zabbix
        $res = zabbix_rpc_request('hostgroup.get', [
            'output' => ['groupid', 'name'],
            'real_hosts' => true,
            'sortfield' => 'name'
        ]);
        if (isset($res['error']) || empty($res['result'])) {
            $res = zabbix_rpc_request('hostgroup.get', [
                'output' => ['groupid', 'name'],
                'sortfield' => 'name'
            ]);
        }
        // 2. Fallback resiliente: se a API do Zabbix restringir hostgroup.get, extrai os grupos a partir dos hosts permitidos
        if (isset($res['error']) || empty($res['result'])) {
            $hRes = zabbix_rpc_request('host.get', [
                'output' => ['hostid'],
                'selectGroups' => ['groupid', 'name']
            ]);
            if (!empty($hRes['result']) && is_array($hRes['result'])) {
                $groupsMap = [];
                foreach ($hRes['result'] as $h) {
                    if (!empty($h['groups']) && is_array($h['groups'])) {
                        foreach ($h['groups'] as $g) {
                            $gid = (string)($g['groupid'] ?? '');
                            $gname = $g['name'] ?? '';
                            if (!empty($gid) && !empty($gname)) {
                                $groupsMap[$gid] = [
                                    'groupid' => $gid,
                                    'name' => $gname
                                ];
                            }
                        }
                    }
                }
                usort($groupsMap, fn($a, $b) => strcasecmp($a['name'], $b['name']));
                $res = ['result' => array_values($groupsMap)];
            }
        }
        echo json_encode($res);
        break;

    case 'hosts':
        $groupids = !empty($_GET['groupids']) ? explode(',', $_GET['groupids']) : null;
        $params = [
            'output' => ['hostid', 'host', 'name', 'status', 'available', 'error', 'description'],
            'selectInterfaces' => ['ip', 'dns', 'port', 'type', 'main', 'available', 'error'],
            'selectGroups' => ['groupid', 'name'],
            'sortfield' => 'name'
        ];
        if ($groupids) {
            $params['groupids'] = $groupids;
        }
        $res = zabbix_rpc_request('host.get', $params);
        echo json_encode($res);
        break;

    case 'items':
        $hostids = !empty($_GET['hostids']) ? explode(',', $_GET['hostids']) : null;
        $search = $_GET['search'] ?? null;
        $params = [
            'output' => ['itemid', 'name', 'key_', 'lastvalue', 'units', 'value_type', 'lastclock', 'prevvalue', 'status', 'state'],
            'selectHosts' => ['hostid', 'name', 'host'],
            'sortfield' => 'name',
            'limit' => 200
        ];
        if ($hostids) {
            $params['hostids'] = $hostids;
        }
        if ($search) {
            $params['search'] = ['name' => $search];
        }
        $res = zabbix_rpc_request('item.get', $params);
        echo json_encode($res);
        break;

    case 'history':
        // Busca histórico de itens para gráficos
        $itemids = !empty($input['itemids']) ? (array)$input['itemids'] : (!empty($_GET['itemids']) ? explode(',', $_GET['itemids']) : []);
        $historyType = isset($input['history']) ? intval($input['history']) : (isset($_GET['history']) ? intval($_GET['history']) : 0); // 0 = float, 3 = uint
        $limit = isset($input['limit']) ? intval($input['limit']) : (isset($_GET['limit']) ? intval($_GET['limit']) : 60);
        $timeFrom = isset($input['time_from']) ? intval($input['time_from']) : (isset($_GET['time_from']) ? intval($_GET['time_from']) : (time() - 3600));

        if (empty($itemids)) {
            echo json_encode(['result' => []]);
            exit;
        }

        $params = [
            'output' => 'extend',
            'history' => $historyType,
            'itemids' => $itemids,
            'time_from' => $timeFrom,
            'sortfield' => 'clock',
            'sortorder' => 'ASC',
            'limit' => $limit
        ];
        $res = zabbix_rpc_request('history.get', $params);
        echo json_encode($res);
        break;

    case 'problems':
        // Problemas ativos no Zabbix 7.0
        $severities = !empty($_GET['severities']) ? array_map('intval', explode(',', $_GET['severities'])) : null;
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;

        $params = [
            'output' => 'extend',
            'selectAcknowledges' => 'extend',
            'selectTags' => 'extend',
            'sortfield' => ['eventid'],
            'sortorder' => 'DESC',
            'limit' => $limit
        ];
        if ($severities !== null) {
            $params['severities'] = $severities;
        }
        $res = zabbix_rpc_request('problem.get', $params);
        echo json_encode($res);
        break;

    case 'summary':
        // Resumo geral para NOC: contagem de hosts ativos/inativos, problemas por severidade
        $hostsAll = zabbix_rpc_request('host.get', ['output' => ['hostid', 'status', 'available'], 'selectInterfaces' => ['available', 'type']]);
        $problems = zabbix_rpc_request('problem.get', ['output' => ['eventid', 'severity', 'acknowledged'], 'recent' => true]);

        $summary = [
            'total_hosts' => 0,
            'available_hosts' => 0,
            'unavailable_hosts' => 0,
            'unmonitored_hosts' => 0,
            'problems_total' => 0,
            'problems_unack' => 0,
            'by_severity' => [
                0 => 0, // Not classified
                1 => 0, // Information
                2 => 0, // Warning
                3 => 0, // Average
                4 => 0, // High
                5 => 0  // Disaster
            ]
        ];

        if (!empty($hostsAll['result']) && is_array($hostsAll['result'])) {
            $summary['total_hosts'] = count($hostsAll['result']);
            foreach ($hostsAll['result'] as $h) {
                if ($h['status'] == '1') {
                    $summary['unmonitored_hosts']++;
                } else {
                    // Verifica disponibilidade
                    $avail = intval($h['available'] ?? 0);
                    if ($avail === 1) {
                        $summary['available_hosts']++;
                    } elseif ($avail === 2) {
                        $summary['unavailable_hosts']++;
                    } else {
                        $summary['available_hosts']++; // default monitored
                    }
                }
            }
        }

        if (!empty($problems['result']) && is_array($problems['result'])) {
            $summary['problems_total'] = count($problems['result']);
            foreach ($problems['result'] as $p) {
                $sev = intval($p['severity'] ?? 0);
                if (isset($summary['by_severity'][$sev])) {
                    $summary['by_severity'][$sev]++;
                }
                if (empty($p['acknowledged'])) {
                    $summary['problems_unack']++;
                }
            }
        }

        echo json_encode(['success' => true, 'result' => $summary]);
        break;

    case 'switches_analysis':
        // Endpoint especializado para tabela de Switches (NOC TV)
        $groupids = !empty($_GET['groupids']) ? explode(',', $_GET['groupids']) : null;
        $search = $_GET['search'] ?? null;
        
        $hostsParams = [
            'output' => ['hostid', 'host', 'name', 'status', 'available', 'error', 'description'],
            'selectInterfaces' => ['ip', 'dns', 'port', 'type', 'main', 'available'],
            'selectInventory' => ['serialno_a', 'serialno_b', 'software', 'software_app_a', 'software_app_b', 'os', 'os_full', 'hardware', 'model', 'vendor'],
            'sortfield' => 'name'
        ];
        if ($groupids) {
            $hostsParams['groupids'] = $groupids;
        }
        if ($search) {
            $hostsParams['search'] = ['name' => $search];
        }

        $hostsRes = zabbix_rpc_request('host.get', $hostsParams);
        
        // Se a API Zabbix retornar erro ou nenhum host configurado, fornecemos dados de demonstração idênticos ao dashboard de referência
        if (isset($hostsRes['error']) || empty($hostsRes['result'])) {
            $demoSwitches = [
                ['name' => 'SW-DM4380-MPLS-01', 'ip' => '10.200.1.1', 'ping' => 1, 'serial' => 'FOC2145X01A', 'latency' => 12.0, 'cpu' => 36, 'memory' => 42.8, 'temp' => 55.0, 'os_version' => '15.2(2)E9', 'uptime' => '17 d 01:14:49', 'status' => 'up'],
                ['name' => 'SW-DM4380-MPLS-02', 'ip' => '10.200.1.2', 'ping' => 1, 'serial' => 'FOC2145X02B', 'latency' => 16.7, 'cpu' => 30, 'memory' => 43.6, 'temp' => 43.8, 'os_version' => '15.2(2)E9', 'uptime' => '110 d 08:48:04', 'status' => 'up'],
                ['name' => 'SW-DM4380-MPLS-03', 'ip' => '10.200.1.3', 'ping' => 1, 'serial' => 'FOC2145X03C', 'latency' => 12.4, 'cpu' => 31, 'memory' => 43.8, 'temp' => 54.0, 'os_version' => '15.2(4)E7', 'uptime' => '129 d 16:16:27', 'status' => 'up'],
                ['name' => 'SW-DM4380-MPLS-04', 'ip' => '10.200.1.4', 'ping' => 1, 'serial' => 'FOC2145X04D', 'latency' => 11.6, 'cpu' => 28, 'memory' => 42.2, 'temp' => 40.0, 'os_version' => '15.2(2)E9', 'uptime' => '22:53:23', 'status' => 'up'],
                ['name' => 'SW-DM4380-MPLS-05', 'ip' => '10.200.1.5', 'ping' => 1, 'serial' => 'FOC2145X05E', 'latency' => 16.9, 'cpu' => 31, 'memory' => 41.4, 'temp' => 58.1, 'os_version' => '15.2(2)E9', 'uptime' => '122 d 17:36:26', 'status' => 'up'],
                ['name' => 'SW-DM4380-MPLS-06', 'ip' => '10.200.1.6', 'ping' => 1, 'serial' => 'FOC2145X06F', 'latency' => 12.2, 'cpu' => 27, 'memory' => 60.7, 'temp' => 66.0, 'os_version' => '15.2(4)E8', 'uptime' => '262 d 01:54:38', 'status' => 'up'],
                ['name' => 'SW-CORE-DIST-01', 'ip' => '10.200.0.1', 'ping' => 1, 'serial' => 'FCW2210G08A', 'latency' => 4.2, 'cpu' => 19, 'memory' => 38.4, 'temp' => 39.5, 'os_version' => '15.2(7)E1', 'uptime' => '412 d 06:12:10', 'status' => 'up'],
                ['name' => 'SW-CORE-DIST-02', 'ip' => '10.200.0.2', 'ping' => 1, 'serial' => 'FCW2210G09B', 'latency' => 4.5, 'cpu' => 22, 'memory' => 39.1, 'temp' => 41.0, 'os_version' => '15.2(7)E1', 'uptime' => '412 d 06:10:05', 'status' => 'up'],
                ['name' => 'SW-ACCESS-BLOCO-A', 'ip' => '10.200.3.1', 'ping' => 1, 'serial' => 'FCW2145A09J', 'latency' => 15.2, 'cpu' => 12, 'memory' => 28.0, 'temp' => 33.0, 'os_version' => '15.2(2)E9', 'uptime' => '94 d 11:22:01', 'status' => 'up'],
                ['name' => 'SW-ACCESS-BLOCO-B', 'ip' => '10.200.3.2', 'ping' => 0, 'serial' => 'FCW2145A10K', 'latency' => 0, 'cpu' => 0, 'memory' => 0, 'temp' => 0, 'os_version' => '15.2(2)E9', 'uptime' => '00:00:00', 'status' => 'down']
            ];

            // Preenche até 17 switches
            for ($i = count($demoSwitches) + 1; $i <= 17; $i++) {
                $cpuVal = rand(4, 38);
                $memVal = rand(15, 52);
                $tempVal = rand(26, 60);
                $latVal = round(rand(80, 180) / 10, 1);
                $upDays = rand(5, 300);
                $demoSwitches[] = [
                    'name' => sprintf('SW-DISTRIB-SEC-%02d', $i),
                    'ip' => sprintf('10.200.4.%d', $i),
                    'ping' => 1,
                    'serial' => sprintf('FCW%04dK%02d', rand(1000, 9999), $i),
                    'latency' => $latVal,
                    'cpu' => $cpuVal,
                    'memory' => $memVal,
                    'temp' => $tempVal,
                    'os_version' => '15.2(2)E9',
                    'uptime' => sprintf('%d d %02d:%02d:%02d', $upDays, rand(0, 23), rand(0, 59), rand(0, 59)),
                    'status' => 'up'
                ];
            }

            $total = count($demoSwitches);
            $upCount = count(array_filter($demoSwitches, fn($s) => $s['ping'] === 1));
            $downCount = $total - $upCount;

            echo json_encode([
                'success' => true,
                'is_demo' => true,
                'summary' => [
                    'total' => $total,
                    'up' => $upCount,
                    'down' => $downCount
                ],
                'switches' => $demoSwitches
            ]);
            exit;
        }

        // Caso tenha hosts reais do Zabbix, buscamos métricas reais
        $rawHosts = $hostsRes['result'];
        $hostIds = array_column($rawHosts, 'hostid');

        // Busca itens relevantes em batch
        $itemsRes = zabbix_rpc_request('item.get', [
            'output' => ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units', 'value_type'],
            'hostids' => $hostIds,
            'filter' => [
                'status' => 0
            ]
        ]);

        $itemsByHost = [];
        if (!empty($itemsRes['result'])) {
            foreach ($itemsRes['result'] as $item) {
                $hid = $item['hostid'];
                if (!isset($itemsByHost[$hid])) $itemsByHost[$hid] = [];
                $itemsByHost[$hid][] = $item;
            }
        }

        $switchesData = [];
        $totalUp = 0;
        $totalDown = 0;

        foreach ($rawHosts as $h) {
            $hid = $h['hostid'];
            $hItems = $itemsByHost[$hid] ?? [];
            $ip = $h['interfaces'][0]['ip'] ?? 'N/A';
            $inventory = $h['inventory'] ?? [];

            $ping = 1;
            $latency = 0;
            $cpu = 0;
            $memory = 0;
            $temp = 0;
            $uptimeSeconds = 0;
            $uptimeStr = '-';
            
            $serial = !empty($inventory['serialno_a']) ? $inventory['serialno_a'] : (!empty($inventory['serialno_b']) ? $inventory['serialno_b'] : '-');
            $osVersion = !empty($inventory['os']) ? $inventory['os'] : (!empty($inventory['software']) ? $inventory['software'] : (!empty($inventory['os_full']) ? $inventory['os_full'] : '-'));

            // Avalia itens do host
            foreach ($hItems as $it) {
                $nameLower = strtolower($it['name']);
                $keyLower = strtolower($it['key_']);
                $valRaw = trim((string)($it['lastvalue'] ?? ''));
                $val = floatval($it['lastvalue']);

                // Ping ICMP
                if (str_contains($keyLower, 'icmpping') && !str_contains($keyLower, 'sec') && !str_contains($keyLower, 'loss')) {
                    $ping = intval($val);
                } elseif (str_contains($nameLower, 'ping') && !str_contains($nameLower, 'loss') && !str_contains($nameLower, 'response')) {
                    $ping = intval($val) > 0 ? 1 : 0;
                }

                // Latency (RTT)
                if (str_contains($keyLower, 'icmppingsec') || str_contains($nameLower, 'response time') || str_contains($nameLower, 'latência') || str_contains($nameLower, 'latencia')) {
                    // Se o valor estiver em segundos (ex: 0.012), converte para ms
                    $latency = ($val < 1 && $val > 0) ? round($val * 1000, 1) : round($val, 1);
                }

                // CPU
                if (str_contains($nameLower, 'cpu') && (str_contains($nameLower, 'util') || str_contains($nameLower, '%') || str_contains($keyLower, 'cpu.util'))) {
                    $cpu = round($val, 1);
                }

                // Memory
                if ((str_contains($nameLower, 'memory') || str_contains($nameLower, 'memória')) && (str_contains($nameLower, 'util') || str_contains($nameLower, '%') || str_contains($keyLower, 'memory.util'))) {
                    $memory = round($val, 1);
                }

                // Temperature
                if (str_contains($nameLower, 'temperature') || str_contains($nameLower, 'temperatura') || str_contains($keyLower, 'temp')) {
                    $temp = round($val, 1);
                }

                // Uptime
                if (str_contains($keyLower, 'system.uptime') || str_contains($nameLower, 'uptime')) {
                    $uptimeSeconds = intval($val);
                }

                // Serial Number a partir dos itens SNMP caso não esteja preenchido no inventário
                if ($serial === '-' || empty($serial)) {
                    if (str_contains($keyLower, 'serial') || str_contains($nameLower, 'serial number') || str_contains($nameLower, 'serial no') || str_contains($keyLower, 'entphysicalserialnum')) {
                        if (!empty($valRaw) && strlen($valRaw) >= 3 && !is_numeric($valRaw)) {
                            $serial = $valRaw;
                        }
                    }
                }

                // Versão do SO / Firmware a partir dos itens SNMP caso não esteja no inventário
                if ($osVersion === '-' || empty($osVersion)) {
                    if (str_contains($keyLower, 'system.sw.os') || str_contains($keyLower, 'system.hw.firmware') || str_contains($nameLower, 'software version') || str_contains($nameLower, 'firmware version') || str_contains($nameLower, 'operating system') || str_contains($keyLower, 'system.descr') || str_contains($nameLower, 'system description')) {
                        if (!empty($valRaw) && strlen($valRaw) >= 2) {
                            $osVersion = $valRaw;
                        }
                    }
                }
            }

            // Normaliza a versão do SO (extrai versão limpa como 15.2(2)E9 se for texto longo do Cisco/Huawei)
            if (!empty($osVersion) && $osVersion !== '-') {
                if (preg_match('/Version\s+([0-9a-zA-Z\.\(\)\-_]+)/i', $osVersion, $m)) {
                    $osVersion = $m[1];
                } elseif (preg_match('/(?:VRP|Release|SW Version|IOS)\s*([0-9a-zA-Z\.\(\)\-_]+)/i', $osVersion, $m)) {
                    $osVersion = $m[1];
                } elseif (strlen($osVersion) > 22) {
                    $osVersion = substr($osVersion, 0, 22);
                }
            } else {
                $osVersion = '-';
            }

            // Formata Uptime
            if ($uptimeSeconds > 0) {
                $days = floor($uptimeSeconds / 86400);
                $rem = $uptimeSeconds % 86400;
                $hours = floor($rem / 3600);
                $rem = $rem % 3600;
                $mins = floor($rem / 60);
                $secs = $rem % 60;
                if ($days > 0) {
                    $uptimeStr = sprintf('%d d %02d:%02d:%02d', $days, $hours, $mins, $secs);
                } else {
                    $uptimeStr = sprintf('%02d:%02d:%02d', $hours, $mins, $secs);
                }
            }

            $isUp = ($ping === 1 && $h['status'] === '0');
            if ($isUp) $totalUp++;
            else $totalDown++;

            $switchesData[] = [
                'hostid' => $hid,
                'name' => $h['name'],
                'ip' => $ip,
                'ping' => $isUp ? 1 : 0,
                'serial' => $serial,
                'latency' => $latency,
                'cpu' => $cpu,
                'memory' => $memory,
                'temp' => $temp,
                'os_version' => $osVersion,
                'uptime' => $uptimeStr,
                'status' => $isUp ? 'up' : 'down'
            ];
        }

        echo json_encode([
            'success' => true,
            'is_demo' => false,
            'summary' => [
                'total' => count($switchesData),
                'up' => $totalUp,
                'down' => $totalDown
            ],
            'switches' => $switchesData
        ]);
        break;

    default:
        echo json_encode(['error' => ['message' => 'Ação não reconhecida.']]);
        break;
}
