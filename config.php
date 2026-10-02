<?php
/**
 * Configuração Geral e Inicialização
 */
define('ROOT_DIR', __DIR__);
define('DATA_DIR', ROOT_DIR . '/data');
define('DASHBOARDS_DIR', DATA_DIR . '/dashboards');
define('CONFIG_FILE', DATA_DIR . '/settings.json');

// Garante que os diretórios necessários existem
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0777, true);
}
if (!is_dir(DASHBOARDS_DIR)) {
    mkdir(DASHBOARDS_DIR, 0777, true);
}

// Configuração padrão
function get_app_settings() {
    if (file_exists(CONFIG_FILE)) {
        $data = json_decode(file_get_contents(CONFIG_FILE), true);
        if ($data) return $data;
    }
    return [
        'zabbix_url' => '',
        'api_token' => '',
        'verify_ssl' => false,
        'refresh_interval' => 30, // segundos
        'theme' => 'dark'
    ];
}

function save_app_settings($settings) {
    return file_put_contents(CONFIG_FILE, json_encode($settings, JSON_PRETTY_PRINT));
}
