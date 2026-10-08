<?php
/**
 * Gerenciador de Dashboards (CRUD em JSON)
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

$action = $_GET['action'] ?? 'list';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

function sanitize_id($id) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
}

switch ($action) {
    case 'list':
        $files = glob(DASHBOARDS_DIR . '/*.json');
        $dashboards = [];
        foreach ($files as $file) {
            $content = json_decode(file_get_contents($file), true);
            if ($content) {
                $dashboards[] = [
                    'id' => basename($file, '.json'),
                    'title' => $content['title'] ?? basename($file, '.json'),
                    'description' => $content['description'] ?? '',
                    'widget_count' => count($content['widgets'] ?? []),
                    'updated_at' => filemtime($file)
                ];
            }
        }
        echo json_encode(['success' => true, 'dashboards' => $dashboards]);
        break;

    case 'get':
        $id = sanitize_id($_GET['id'] ?? '');
        if (empty($id)) {
            echo json_encode(['error' => 'ID do dashboard não fornecido.']);
            exit;
        }
        $file = DASHBOARDS_DIR . '/' . $id . '.json';
        if (!file_exists($file)) {
            echo json_encode(['error' => 'Dashboard não encontrado.']);
            exit;
        }
        $content = json_decode(file_get_contents($file), true);
        echo json_encode(['success' => true, 'dashboard' => $content]);
        break;

    case 'save':
        $id = sanitize_id($input['id'] ?? '');
        if (empty($id)) {
            $id = 'dash_' . time();
        }
        $title = trim($input['title'] ?? 'Novo Dashboard');
        $dashboardData = [
            'id' => $id,
            'title' => $title,
            'description' => $input['description'] ?? '',
            'refresh_interval' => intval($input['refresh_interval'] ?? 40),
            'columns' => intval($input['columns'] ?? 12),
            'widgets' => $input['widgets'] ?? [],
            'created_at' => $input['created_at'] ?? time(),
            'updated_at' => time()
        ];
        
        $file = DASHBOARDS_DIR . '/' . $id . '.json';
        file_put_contents($file, json_encode($dashboardData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true, 'id' => $id, 'dashboard' => $dashboardData]);
        break;

    case 'delete':
        $id = sanitize_id($input['id'] ?? ($_GET['id'] ?? ''));
        if (empty($id)) {
            echo json_encode(['error' => 'ID do dashboard não fornecido.']);
            exit;
        }
        $file = DASHBOARDS_DIR . '/' . $id . '.json';
        if (file_exists($file)) {
            unlink($file);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Dashboard não encontrado.']);
        }
        break;

    case 'export':
        $id = sanitize_id($_GET['id'] ?? '');
        $file = DASHBOARDS_DIR . '/' . $id . '.json';
        if (!file_exists($file)) {
            echo json_encode(['error' => 'Dashboard não encontrado.']);
            exit;
        }
        header('Content-Disposition: attachment; filename="' . $id . '.json"');
        readfile($file);
        exit;

    default:
        echo json_encode(['error' => 'Ação desconhecida.']);
        break;
}
