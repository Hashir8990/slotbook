<?php
require_once __DIR__ . '/../config/db.php';

$date = $_GET['date'] ?? '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    jsonResponse(['success' => false, 'message' => 'Valid date (YYYY-MM-DD) required'], 400);
}

$allSlots = [
    '09:30 AM', '10:15 AM', '11:00 AM', '11:45 AM',
    '12:30 PM', '02:00 PM', '02:45 PM', '03:30 PM',
    '04:15 PM', '05:00 PM'
];

try {
    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT time_slot FROM bookings WHERE booking_date = ? AND status != 'cancelled'");
    $stmt->execute([$date]);
    $booked = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $slots = array_map(function ($slot) use ($booked) {
        return [
            'time' => $slot,
            'available' => !in_array($slot, $booked, true)
        ];
    }, $allSlots);

    jsonResponse(['success' => true, 'date' => $date, 'slots' => $slots]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Failed to check slots'], 500);
}