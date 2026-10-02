<?php
/**
 * Zabbix 7.0 JSON-RPC 2.0 API Proxy
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

$settings = get_app_settings();

function zabbix_rpc_request($method, $params = [], $auth = null) {
    global $settings;

    $url = rtrim($settings['zabbix_url'], '/');
    if (empty($url)) {
        return ['error' => ['message' => 'URL do Zabbix não configurada no painel de configurações.']];
    }

    // Se o endpoint não terminar com api_jsonrpc.php, adiciona automaticamente
    if (!str_ends_with($url, 'api_jsonrpc.php')) {
        $url .= '/api_jsonrpc.php';
    }

    $token = !empty($auth) ? $auth : $settings['api_token'];

    $payload = [
        'jsonrpc' => '2.0',
        'method' => $method,
        'params' => $params,
        'id' => time()
    ];

    // No Zabbix 7.0, o token pode ser enviado no cabeçalho Authorization Bearer ou no campo auth
    if (!empty($token)) {
        $payload['auth'] = $token;
    }

    $ch = curl_init($url);
    $headers = [
        'Content-Type: application/json-rpc',
        'Accept: application/json'
    ];
    if (!empty($token)) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);

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
        return ['error' => ['message' => 'Resposta inválida do Zabbix (HTTP ' . $httpCode . '): ' . substr($response, 0, 300)]];
    }

    return $json;
}

$action = $_GET['action'] ?? 'rpc';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

switch ($action) {
    case 'test_connection':
        // Testa a conexão usando apiinfo.version ou host.get com limit 1
        $testUrl = $input['zabbix_url'] ?? $settings['zabbix_url'];
        $testToken = $input['api_token'] ?? $settings['api_token'];
        
        $tempSettings = $settings;
        $tempSettings['zabbix_url'] = $testUrl;
        $tempSettings['api_token'] = $testToken;
        $tempSettings['verify_ssl'] = $input['verify_ssl'] ?? false;
        
        // Chamada apiinfo.version (não requer autenticação)
        $oldSettings = $settings;
        $settings = $tempSettings;
        $versionRes = zabbix_rpc_request('apiinfo.version', []);
        
        if (isset($versionRes['error'])) {
            $settings = $oldSettings;
            echo json_encode(['success' => false, 'error' => $versionRes['error']['message'] ?? 'Erro desconhecido']);
            exit;
        }

        $version = $versionRes['result'] ?? 'Desconhecida';
        
        // Se forneceu token, testa autenticação buscando contagem de hosts
        $authValid = false;
        $hostCount = 0;
        if (!empty($testToken)) {
            $authRes = zabbix_rpc_request('host.get', ['countOutput' => true], $testToken);
            if (!isset($authRes['error'])) {
                $authValid = true;
                $hostCount = intval($authRes['result'] ?? 0);
            }
        }

        $settings = $oldSettings;
        echo json_encode([
            'success' => true,
            'version' => $version,
            'authenticated' => $authValid,
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
        $res = zabbix_rpc_request('hostgroup.get', [
            'output' => ['groupid', 'name'],
            'sortfield' => 'name'
        ]);
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

    default:
        echo json_encode(['error' => ['message' => 'Ação não reconhecida.']]);
        break;
}
