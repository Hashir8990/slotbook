<?php
require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDB();
    $stmt = $pdo->query("SELECT id, name, duration_min, price, description FROM services ORDER BY id ASC");
    jsonResponse(['success' => true, 'services' => $stmt->fetchAll()]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Failed to load services'], 500);
}