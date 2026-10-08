<?php
/**
 * Gerenciador de Configurações Gerais
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

$action = $_GET['action'] ?? 'get';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

switch ($action) {
    case 'get':
        $settings = get_app_settings();
        // Mascara o token para exibição segura, mas permite saber se existe
        $maskedToken = '';
        if (!empty($settings['api_token'])) {
            $len = strlen($settings['api_token']);
            if ($len > 8) {
                $maskedToken = substr($settings['api_token'], 0, 4) . '...' . substr($settings['api_token'], -4);
            } else {
                $maskedToken = '********';
            }
        }
        echo json_encode([
            'success' => true,
            'settings' => [
                'zabbix_url' => $settings['zabbix_url'],
                'has_token' => !empty($settings['api_token']),
                'masked_token' => $maskedToken,
                'verify_ssl' => !empty($settings['verify_ssl']),
                'refresh_interval' => intval($settings['refresh_interval'] ?? 40),
                'theme' => $settings['theme'] ?? 'dark'
            ]
        ]);
        break;

    case 'save':
        $current = get_app_settings();
        
        $newUrl = trim($input['zabbix_url'] ?? $current['zabbix_url']);
        $newToken = trim($input['api_token'] ?? '');
        
        // Se o token vier vazio e já tínhamos um token salvo, mantemos o anterior
        if (empty($newToken) && !empty($current['api_token']) && !isset($input['clear_token'])) {
            $newToken = $current['api_token'];
        }

        $newSettings = [
            'zabbix_url' => $newUrl,
            'api_token' => $newToken,
            'verify_ssl' => !empty($input['verify_ssl']),
            'refresh_interval' => intval($input['refresh_interval'] ?? 40),
            'theme' => $input['theme'] ?? 'dark'
        ];

        if (save_app_settings($newSettings)) {
            echo json_encode(['success' => true, 'message' => 'Configurações salvas com sucesso!']);
        } else {
            echo json_encode(['error' => 'Falha ao salvar o arquivo de configurações. Verifique permissões na pasta data/.']);
        }
        break;

    default:
        echo json_encode(['error' => 'Ação desconhecida.']);
        break;
}
