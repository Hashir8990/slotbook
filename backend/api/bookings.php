<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    if ($method === 'GET') {
        if (!empty($_GET['code'])) {
            $code = strtoupper(trim($_GET['code']));
            $stmt = $pdo->prepare("
                SELECT b.*, s.name AS service_name, s.duration_min, s.price
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                WHERE b.booking_code = ?
            ");
            $stmt->execute([$code]);
            $booking = $stmt->fetch();

            if (!$booking) {
                jsonResponse(['success' => false, 'message' => 'Booking not found'], 404);
            }
            jsonResponse(['success' => true, 'booking' => $booking]);
        }

        $adminKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
        if ($adminKey !== ADMIN_KEY) {
            jsonResponse(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $stmt = $pdo->query("
            SELECT b.*, s.name AS service_name, s.duration_min, s.price
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            ORDER BY b.booking_date DESC, b.id DESC
        ");
        $bookings = $stmt->fetchAll();

        jsonResponse(['success' => true, 'bookings' => $bookings]);
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $serviceId = (int)($input['service_id'] ?? 0);
        $name      = trim($input['customer_name'] ?? '');
        $email     = trim($input['customer_email'] ?? '');
        $phone     = trim($input['customer_phone'] ?? '');
        $date      = trim($input['booking_date'] ?? '');
        $slot      = trim($input['time_slot'] ?? '');
        $notes     = trim($input['notes'] ?? '');

        if (!$serviceId || !$name || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$phone || !$date || !$slot) {
            jsonResponse(['success' => false, 'message' => 'Please fill all required fields correctly'], 400);
        }

        if ($date < date('Y-m-d')) {
            jsonResponse(['success' => false, 'message' => 'Cannot book a past date'], 400);
        }

        $pdo->beginTransaction();

        $check = $pdo->prepare("SELECT id FROM bookings WHERE booking_date = ? AND time_slot = ? AND status != 'cancelled' FOR UPDATE");
        $check->execute([$date, $slot]);
        if ($check->fetch()) {
            $pdo->rollBack();
            jsonResponse(['success' => false, 'message' => 'This time slot was just booked. Please pick another.'], 409);
        }

        $code = 'SB-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

        $insert = $pdo->prepare("
            INSERT INTO bookings (booking_code, service_id, customer_name, customer_email, customer_phone, booking_date, time_slot, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insert->execute([$code, $serviceId, $name, $email, $phone, $date, $slot, $notes]);
        $newId = (int)$pdo->lastInsertId();

        $pdo->commit();

        $fetch = $pdo->prepare("
            SELECT b.*, s.name AS service_name, s.duration_min, s.price
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.id = ?
        ");
        $fetch->execute([$newId]);

        jsonResponse(['success' => true, 'booking' => $fetch->fetch()], 201);
    }

    if ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id     = (int)($input['id'] ?? 0);
        $status = $input['status'] ?? '';

        if (!$id || !in_array($status, ['confirmed', 'completed', 'cancelled'], true)) {
            jsonResponse(['success' => false, 'message' => 'Invalid booking ID or status'], 400);
        }

        $adminKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
        if ($adminKey !== ADMIN_KEY) {
            jsonResponse(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $stmt = $pdo->prepare("UPDATE bookings SET status = ? WHERE id = ?");
        $stmt->execute([$status, $id]);

        jsonResponse(['success' => true, 'message' => 'Booking updated']);
    }

    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(['success' => false, 'message' => 'Server error occurred'], 500);
}