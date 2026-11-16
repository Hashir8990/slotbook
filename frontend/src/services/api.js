const API_BASE =
  import.meta.env.VITE_API_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost/slotbook/backend/api"
    : "");

const DEMO_KEY = "slotbook_demo_bookings_v1";

const DEFAULT_SERVICES = [
  {
    id: 1,
    name: "General Consultation",
    duration_min: 30,
    price: "2500.00",
    description: "1-on-1 discovery & assessment session",
  },
  {
    id: 2,
    name: "Technical Strategy Audit",
    duration_min: 60,
    price: "5000.00",
    description: "Deep-dive architecture, speed & UI review",
  },
  {
    id: 3,
    name: "Follow-up Check-in",
    duration_min: 20,
    price: "1500.00",
    description: "Quick progress review and next action items",
  },
];

const ALL_SLOTS = [
  "09:30 AM", "10:15 AM", "11:00 AM", "11:45 AM",
  "12:30 PM", "02:00 PM", "02:45 PM", "03:30 PM",
  "04:15 PM", "05:00 PM",
];

function getTodayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function getDemoBookings() {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) return JSON.parse(raw);

  const seeded = [
    {
      id: 1,
      booking_code: "SB-84A2K",
      service_id: 2,
      service_name: "Technical Strategy Audit",
      duration_min: 60,
      price: "5000.00",
      customer_name: "Bilal Ahmed",
      customer_email: "bilal@example.com",
      customer_phone: "+92 300 1234567",
      booking_date: getTodayStr(1),
      time_slot: "11:00 AM",
      notes: "Need speed optimization review for storefront.",
      status: "confirmed",
    },
    {
      id: 2,
      booking_code: "SB-31M9P",
      service_id: 1,
      service_name: "General Consultation",
      duration_min: 30,
      price: "2500.00",
      customer_name: "Sana Tariq",
      customer_email: "sana@example.com",
      customer_phone: "+92 321 9876543",
      booking_date: getTodayStr(0),
      time_slot: "02:00 PM",
      notes: "New web portal scope discussion.",
      status: "completed",
    },
  ];
  localStorage.setItem(DEMO_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveDemoBookings(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

export let dataSourceMode = API_BASE ? "php" : "demo";

async function tryFetch(url, options = {}) {
  if (!API_BASE) throw new Error("NO_API");
  const res = await fetch(`${API_BASE}${url}`, options);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.isServerResponse = true;
    throw err;
  }
  dataSourceMode = "php";
  return data;
}

export async function fetchServices() {
  try {
    const data = await tryFetch("/services.php");
    return { services: data.services, mode: "php" };
  } catch (err) {
    if (err.isServerResponse) throw err;
    dataSourceMode = "demo";
    return { services: DEFAULT_SERVICES, mode: "demo" };
  }
}

export async function fetchSlots(date) {
  try {
    const data = await tryFetch(`/slots.php?date=${encodeURIComponent(date)}`);
    return { slots: data.slots, mode: "php" };
  } catch (err) {
    if (err.isServerResponse) throw err;
    dataSourceMode = "demo";
    const bookings = getDemoBookings();
    const taken = bookings
      .filter((b) => b.booking_date === date && b.status !== "cancelled")
      .map((b) => b.time_slot);

    return {
      slots: ALL_SLOTS.map((t) => ({ time: t, available: !taken.includes(t) })),
      mode: "demo",
    };
  }
}

export async function createBooking(payload) {
  try {
    const data = await tryFetch("/bookings.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data.booking;
  } catch (err) {
    if (err.isServerResponse) throw err;
    const list = getDemoBookings();
    const conflict = list.find(
      (b) =>
        b.booking_date === payload.booking_date &&
        b.time_slot === payload.time_slot &&
        b.status !== "cancelled"
    );
    if (conflict) {
      throw new Error("This time slot was just booked. Please pick another.");
    }
    const svc = DEFAULT_SERVICES.find((s) => s.id === Number(payload.service_id));
    const newItem = {
      id: Date.now(),
      booking_code: "SB-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
      service_id: svc.id,
      service_name: svc.name,
      duration_min: svc.duration_min,
      price: svc.price,
      ...payload,
      status: "confirmed",
    };
    saveDemoBookings([newItem, ...list]);
    return newItem;
  }
}

export async function trackBookingByCode(code) {
  try {
    const data = await tryFetch(`/bookings.php?code=${encodeURIComponent(code)}`);
    return data.booking;
  } catch (err) {
    if (err.isServerResponse) throw err;
    const found = getDemoBookings().find(
      (b) => b.booking_code.toUpperCase() === code.trim().toUpperCase()
    );
    if (!found) throw new Error("Booking not found");
    return found;
  }
}

export async function fetchAdminBookings(adminKey) {
  try {
    const data = await tryFetch("/bookings.php", {
      headers: { "X-Admin-Key": adminKey },
    });
    return data.bookings;
  } catch (err) {
    if (err.isServerResponse) throw err;
    if (adminKey !== "slotbook-admin-2026") throw new Error("Unauthorized");
    return getDemoBookings();
  }
}

export async function updateBookingStatus(id, status, adminKey) {
  try {
    await tryFetch("/bookings.php", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
      },
      body: JSON.stringify({ id, status }),
    });
  } catch (err) {
    if (err.isServerResponse) throw err;
    const updated = getDemoBookings().map((b) =>
      b.id === id ? { ...b, status } : b
    );
    saveDemoBookings(updated);
  }
}