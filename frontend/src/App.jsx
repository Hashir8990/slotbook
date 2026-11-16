import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Search,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
  User,
  Mail,
  Phone,
  FileText,
  Database,
  RefreshCw,
} from "lucide-react";
import {
  fetchServices,
  fetchSlots,
  createBooking,
  trackBookingByCode,
  fetchAdminBookings,
  updateBookingStatus,
} from "./services/api";

function getUpcomingDays(count = 14) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return days;
}

const STATUS_BADGE = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-300",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function App() {
  const [view, setView] = useState("book");
  const [mode, setMode] = useState("php");

  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const days = useMemo(() => getUpcomingDays(14), []);
  const [selectedDate, setSelectedDate] = useState(days[0].iso);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [trackCode, setTrackCode] = useState("");
  const [tracked, setTracked] = useState(null);
  const [trackError, setTrackError] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);

  const [adminKey, setAdminKey] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminFilter, setAdminFilter] = useState("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    fetchServices().then(({ services: list, mode: m }) => {
      setServices(list);
      setMode(m);
      if (list.length) setSelectedService(list[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot("");
    fetchSlots(selectedDate)
      .then(({ slots: list, mode: m }) => {
        setSlots(list);
        setMode(m);
      })
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

  async function handleBookSubmit(e) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) {
      setBookingError("Please select a service and an available time slot.");
      return;
    }
    setBookingError("");
    setSubmitting(true);
    try {
      const booking = await createBooking({
        service_id: selectedService.id,
        booking_date: selectedDate,
        time_slot: selectedSlot,
        ...form,
      });
      setConfirmedBooking(booking);
      setForm({ customer_name: "", customer_email: "", customer_phone: "", notes: "" });
      const refreshed = await fetchSlots(selectedDate);
      setSlots(refreshed.slots);
    } catch (err) {
      setBookingError(err.message || "Could not complete booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTrack(e) {
    e.preventDefault();
    if (!trackCode.trim()) return;
    setTrackLoading(true);
    setTrackError("");
    setTracked(null);
    try {
      const b = await trackBookingByCode(trackCode);
      setTracked(b);
    } catch (err) {
      setTrackError(err.message || "Booking not found");
    } finally {
      setTrackLoading(false);
    }
  }

  async function loadAdmin(keyToUse = adminKey) {
    setAdminLoading(true);
    setAdminError("");
    try {
      const list = await fetchAdminBookings(keyToUse);
      setAdminBookings(list);
      setAdminAuthed(true);
    } catch (err) {
      setAdminError(err.message || "Invalid passcode");
      setAdminAuthed(false);
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleStatusChange(id, status) {
    await updateBookingStatus(id, status, adminKey);
    await loadAdmin(adminKey);
    if (selectedDate) {
      const refreshed = await fetchSlots(selectedDate);
      setSlots(refreshed.slots);
    }
  }

  const adminStats = useMemo(() => {
    const confirmed = adminBookings.filter((b) => b.status === "confirmed").length;
    const completed = adminBookings.filter((b) => b.status === "completed").length;
    const revenue = adminBookings
      .filter((b) => b.status !== "cancelled")
      .reduce((acc, b) => acc + Number(b.price || 0), 0);
    return { total: adminBookings.length, confirmed, completed, revenue };
  }, [adminBookings]);

  const filteredAdmin = useMemo(() => {
    return adminBookings.filter((b) => {
      const matchStatus = adminFilter === "all" || b.status === adminFilter;
      const q = adminSearch.toLowerCase();
      const matchQuery =
        !q ||
        b.customer_name.toLowerCase().includes(q) ||
        b.booking_code.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [adminBookings, adminFilter, adminSearch]);

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white grid place-items-center font-bold text-sm">
              SB
            </div>
            <span className="font-semibold tracking-tight text-slate-900">SlotBook</span>
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border ${
                mode === "php"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <Database className="w-3 h-3" />
              {mode === "php" ? "PHP + MySQL Live" : "Interactive Demo Mode"}
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "book", label: "Book" },
              { id: "track", label: "Track" },
              { id: "admin", label: "Admin" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  view === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* VIEW 1: BOOKING FLOW */}
        {view === "book" && (
          <>
            {confirmedBooking ? (
              <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Booking Confirmed</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Save your booking code below to check your appointment status anytime.
                </p>

                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                      Booking Code
                    </div>
                    <div className="text-xl font-mono font-bold text-slate-900">
                      {confirmedBooking.booking_code}
                    </div>
                  </div>
                  <button
                    onClick={() => copyCode(confirmedBooking.booking_code)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium hover:bg-slate-100 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="mt-5 text-left text-sm space-y-2 border-t border-slate-100 pt-5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service</span>
                    <span className="font-medium text-slate-900">{confirmedBooking.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date &amp; Time</span>
                    <span className="font-medium text-slate-900">
                      {confirmedBooking.booking_date} at {confirmedBooking.time_slot}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fee</span>
                    <span className="font-medium text-slate-900">
                      PKR {Number(confirmedBooking.price).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-7 flex gap-3 justify-center">
                  <button
                    onClick={() => setConfirmedBooking(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
                  >
                    Book Another Slot
                  </button>
                  <button
                    onClick={() => {
                      setTrackCode(confirmedBooking.booking_code);
                      setConfirmedBooking(null);
                      setView("track");
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Track Status
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Service Selection */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Step 1 of 3
                  </span>
                  <h1 className="text-xl font-bold text-slate-900 mt-1">Select a Session</h1>
                  <p className="text-sm text-slate-500 mt-1 mb-5">
                    Choose a consultation type to view available time slots.
                  </p>

                  <div className="space-y-3">
                    {services.map((svc) => {
                      const active = selectedService?.id === svc.id;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => setSelectedService(svc)}
                          className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm">{svc.name}</span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                                active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              PKR {Number(svc.price).toLocaleString()}
                            </span>
                          </div>
                          <p className={`text-xs mt-1 ${active ? "text-slate-300" : "text-slate-500"}`}>
                            {svc.description}
                          </p>
                          <div className={`flex items-center gap-1.5 text-xs mt-3 ${active ? "text-slate-200" : "text-slate-500"}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{svc.duration_min} mins</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Date, Slot & Form */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Date Strip */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        Select Date
                      </span>
                      <span className="text-xs text-slate-400">Next 14 days</span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {days.map((d) => {
                        const active = selectedDate === d.iso;
                        return (
                          <button
                            key={d.iso}
                            type="button"
                            onClick={() => setSelectedDate(d.iso)}
                            className={`shrink-0 w-16 py-2.5 rounded-xl border text-center transition cursor-pointer ${
                              active
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            <div className={`text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                              {d.dayName}
                            </div>
                            <div className="text-base font-bold leading-tight">{d.dayNum}</div>
                            <div className={`text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                              {d.month}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      Available Slots ({selectedDate})
                    </div>

                    {slotsLoading ? (
                      <div className="text-sm text-slate-400 py-4">Checking live availability...</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {slots.map((s) => {
                          const active = selectedSlot === s.time;
                          return (
                            <button
                              key={s.time}
                              type="button"
                              disabled={!s.available}
                              onClick={() => setSelectedSlot(s.time)}
                              className={`py-2 px-2 rounded-xl border text-xs font-medium transition ${
                                !s.available
                                  ? "bg-slate-50 text-slate-300 border-slate-100 line-through cursor-not-allowed"
                                  : active
                                  ? "bg-emerald-600 text-white border-emerald-600 cursor-pointer"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 cursor-pointer"
                              }`}
                            >
                              {s.time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Customer Details Form */}
                  <form onSubmit={handleBookSubmit} className="border-t border-slate-100 pt-5 space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Your Details</div>

                    {bookingError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                        {bookingError}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> Full Name
                        </span>
                        <input
                          type="text"
                          required
                          value={form.customer_name}
                          onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                          placeholder="Ali Raza"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> Email
                        </span>
                        <input
                          type="email"
                          required
                          value={form.customer_email}
                          onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                          placeholder="ali@example.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> Phone / WhatsApp
                        </span>
                        <input
                          type="tel"
                          required
                          value={form.customer_phone}
                          onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                          placeholder="+92 300 1234567"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Notes (Optional)
                        </span>
                        <input
                          type="text"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          placeholder="Topic or agenda..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !selectedSlot}
                      className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? "Confirming..." : "Confirm Appointment"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: TRACK BOOKING */}
        {view === "track" && (
          <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Track Appointment</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Enter your booking reference code (e.g. <code className="font-mono text-slate-700">SB-84A2K</code>).
            </p>

            <form onSubmit={handleTrack} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  placeholder="SB-XXXXX"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:border-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={trackLoading}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
              >
                {trackLoading ? "Finding..." : "Lookup"}
              </button>
            </form>

            {trackError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {trackError}
              </div>
            )}

            {tracked && (
              <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{tracked.booking_code}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_BADGE[tracked.status]}`}>
                    {tracked.status}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client</span>
                    <span className="font-medium">{tracked.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service</span>
                    <span className="font-medium">{tracked.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Schedule</span>
                    <span className="font-medium">{tracked.booking_date} • {tracked.time_slot}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ADMIN SCHEDULE DASHBOARD */}
        {view === "admin" && (
          <>
            {!adminAuthed ? (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 grid place-items-center mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Admin Schedule</h2>
                <p className="text-sm text-slate-500 mt-1 mb-5">
                  Enter admin passcode to manage bookings and time slots.
                </p>

                {adminError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {adminError}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadAdmin(adminKey);
                  }}
                  className="space-y-3"
                >
                  <input
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Admin passcode"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={adminLoading}
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
                    >
                      {adminLoading ? "Checking..." : "Unlock Dashboard"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminKey("slotbook-admin-2026");
                        loadAdmin("slotbook-admin-2026");
                      }}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Demo Key
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Bookings", val: adminStats.total },
                    { label: "Confirmed", val: adminStats.confirmed },
                    { label: "Completed", val: adminStats.completed },
                    { label: "Revenue (PKR)", val: adminStats.revenue.toLocaleString() },
                  ].map((item) => (
                    <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">{item.val}</div>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {["all", "confirmed", "completed", "cancelled"].map((st) => (
                      <button
                        key={st}
                        onClick={() => setAdminFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                          adminFilter === st
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Search name or code..."
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                    />
                    <button
                      onClick={() => loadAdmin(adminKey)}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Client</th>
                          <th className="px-4 py-3">Service</th>
                          <th className="px-4 py-3">Schedule</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAdmin.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                              No bookings found.
                            </td>
                          </tr>
                        ) : (
                          filteredAdmin.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                {b.booking_code}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">{b.customer_name}</div>
                                <div className="text-xs text-slate-400">{b.customer_phone}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{b.service_name}</td>
                              <td className="px-4 py-3 text-slate-700">
                                {b.booking_date}
                                <div className="text-xs text-slate-400">{b.time_slot}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                                    STATUS_BADGE[b.status]
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                                {b.status === "confirmed" && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(b.id, "completed")}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 cursor-pointer"
                                    >
                                      Complete
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(b.id, "cancelled")}
                                      className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {b.status !== "confirmed" && (
                                  <button
                                    onClick={() => handleStatusChange(b.id, "confirmed")}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 cursor-pointer"
                                  >
                                    Restore
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">
        SlotBook • Built with React, Tailwind CSS, PHP 8 &amp; MySQL
      </footer>
    </div>
  );
}