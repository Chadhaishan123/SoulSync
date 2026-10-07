"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Calendar,
  Clock,
  Video,
  Phone,
  Building,
  CheckCircle2,
  AlertTriangle,
  User,
  Star,
  Award,
  ChevronRight,
  ShieldCheck,
  CalendarCheck,
  XCircle,
} from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import toast from "react-hot-toast"

interface Doctor {
  id: string
  name: string
  title: string
  specialty: string
  experienceYears: number
  rating: number
  reviewCount: number
  avatarColor: string
  bio: string
  availableDays: string[]
}

interface Appointment {
  id: string
  doctorId: string
  doctorName: string
  specialty: string
  date: string
  timeSlot: string
  type: "video" | "audio" | "in_person"
  reason?: string // Privacy: omitted from persistent storage
  shareTwinData: boolean
  status: "confirmed" | "completed" | "cancelled"
  bookedAt: string
}

const DOCTORS: Doctor[] = [
  {
    id: "doc-1",
    name: "Dr. Ananya Sen, MD",
    title: "Senior Consultant Psychiatrist",
    specialty: "Clinical Depression, Mood Disorders & Psychopharmacology",
    experienceYears: 14,
    rating: 4.9,
    reviewCount: 312,
    avatarColor: "from-purple-500 to-indigo-600",
    bio: "AIIMS graduate specializing in longitudinal mood disorders, emotional dysregulation, and neurochemical balance.",
    availableDays: ["Today", "Tomorrow", "Thursday", "Friday"],
  },
  {
    id: "doc-2",
    name: "Dr. Marcus Chen, PsyD",
    title: "Licensed Clinical Psychologist",
    specialty: "Cognitive Behavioral Therapy (CBT), Anxiety & Burnout",
    experienceYears: 10,
    rating: 4.8,
    reviewCount: 245,
    avatarColor: "from-blue-500 to-teal-500",
    bio: "Focuses on evidence-based cognitive restructuring, executive stress, panic attacks, and somatic regulation.",
    availableDays: ["Today", "Tomorrow", "Friday", "Saturday"],
  },
  {
    id: "doc-3",
    name: "Dr. Sarah Jenkins, PhD",
    title: "Neuropsychologist & Sleep Specialist",
    specialty: "Circadian Rhythm Disorders, Chronic Insomnia & ADHD",
    experienceYears: 16,
    rating: 5.0,
    reviewCount: 420,
    avatarColor: "from-teal-500 to-emerald-600",
    bio: "Pioneering researcher in sleep architecture, melatonin dysregulation, and neurological focus recovery.",
    availableDays: ["Tomorrow", "Wednesday", "Thursday"],
  },
  {
    id: "doc-4",
    name: "Dr. Rohan Mehta, MBBS, DPM",
    title: "Holistic Psychiatrist & Counselor",
    specialty: "Relationship Counseling, Grief & Trauma Recovery",
    experienceYears: 9,
    rating: 4.9,
    reviewCount: 188,
    avatarColor: "from-amber-500 to-rose-500",
    bio: "Integrates trauma-informed psychotherapy, mindfulness-based stress reduction (MBSR), and relational dynamics.",
    availableDays: ["Today", "Wednesday", "Thursday", "Saturday"],
  },
]

const TIME_SLOTS = [
  "09:30 AM",
  "11:00 AM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
]

const STORAGE_KEY = "soulsync_doctor_appointments"

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [bookingModal, setBookingModal] = useState(false)

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedSlot, setSelectedSlot] = useState<string>("02:00 PM")
  const [consultType, setConsultType] = useState<"video" | "audio" | "in_person">("video")
  const [reason, setReason] = useState<string>("")
  const [shareTwin, setShareTwin] = useState<boolean>(true)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setAppointments(JSON.parse(stored))
      }
    } catch {
      // ignore
    }

    // Set default tomorrow date
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split("T")[0])
  }, [])

  const saveAppointments = (list: Appointment[]) => {
    setAppointments(list)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
      // ignore
    }
  }

  const openBooking = (doc: Doctor) => {
    setSelectedDoctor(doc)
    setBookingModal(true)
  }

  const confirmBooking = () => {
    if (!selectedDoctor) return
    if (!reason.trim()) {
      toast.error("Please describe your problem or concern to proceed with booking.")
      return
    }
    if (!selectedDate) {
      toast.error("Please pick a consultation date")
      return
    }

    setBookingLoading(true)

    setTimeout(() => {
      // PRIVACY SAFEGUARD: Under doctor booking policy, the patient's described problem
      // is processed ephemerally in-session and is strictly NEVER saved to database or persistent storage.
      const newAppt: Appointment = {
        id: "appt-" + Date.now(),
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        specialty: selectedDoctor.specialty,
        date: selectedDate,
        timeSlot: selectedSlot,
        type: consultType,
        shareTwinData: shareTwin,
        status: "confirmed",
        bookedAt: new Date().toISOString(),
      }

      const updated = [newAppt, ...appointments]
      saveAppointments(updated)
      setBookingLoading(false)
      setReason("") // Immediately clear problem text from memory
      setBookingModal(false)
      toast.success(
        `Appointment confirmed with ${selectedDoctor.name} for ${selectedDate} at ${selectedSlot}! 🎉`
      )
    }, 800)
  }

  const cancelAppointment = (id: string) => {
    if (confirm("Are you sure you want to cancel this appointment?")) {
      const updated = appointments.map((a) =>
        a.id === id ? { ...a, status: "cancelled" as const } : a
      )
      saveAppointments(updated)
      toast.success("Appointment cancelled")
    }
  }

  const activeAppts = appointments.filter((a) => a.status === "confirmed")

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-soul-purple" />
          Book a Consultation with a Doctor
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect directly with licensed psychiatrists, clinical psychologists, and therapists.
        </p>
      </div>

      {/* Emergency Hotline Alert */}
      <Card variant="interactive" className="bg-red-500/10 border-red-500/30 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-400">Immediate Crisis or Severe Distress?</p>
              <p className="text-xs text-muted-foreground">
                If you are in immediate danger or experiencing severe crisis, speak to a crisis doctor right now for free.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href="tel:14416"
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all"
            >
              Tele-MANAS: 14416
            </a>
            <a
              href="tel:988"
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
            >
              988 Lifeline
            </a>
          </div>
        </div>
      </Card>

      {/* Upcoming Bookings Section */}
      {activeAppts.length > 0 && (
        <Card variant="glow">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-soul-purple" /> Your Upcoming Appointments ({activeAppts.length})
          </h3>
          <div className="space-y-3">
            {activeAppts.map((appt) => (
              <div
                key={appt.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/40 border border-border"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">{appt.doctorName}</h4>
                    <Badge variant="success" size="sm">Confirmed</Badge>
                  </div>
                  <p className="text-xs text-soul-purple font-medium mt-0.5">{appt.specialty}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-foreground" /> {appt.date}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-foreground" /> {appt.timeSlot}
                    </span>
                    <span className="flex items-center gap-1 capitalize">
                      {appt.type === "video" && <Video className="w-3.5 h-3.5 text-blue-400" />}
                      {appt.type === "audio" && <Phone className="w-3.5 h-3.5 text-emerald-400" />}
                      {appt.type === "in_person" && <Building className="w-3.5 h-3.5 text-purple-400" />}
                      {appt.type.replace("_", " ")} Consultation
                    </span>
                    {appt.shareTwinData && (
                      <span className="text-[11px] text-soul-teal font-semibold">
                        ✓ Digital Twin Summary Shared
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1 sm:flex-none"
                    onClick={() => toast.success("Consultation link will activate 10 minutes prior to session.")}
                    icon={<Video className="w-3.5 h-3.5" />}
                  >
                    Join Room
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => cancelAppointment(appt.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Doctor Directory */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground">Available Licensed Doctors & Therapists</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCTORS.map((doc) => (
            <Card key={doc.id} variant="interactive" className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${doc.avatarColor} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md`}
                  >
                    {doc.name.split(" ")[1]?.charAt(0) || "D"}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">{doc.name}</h4>
                    <p className="text-xs text-soul-purple font-medium">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-current" /> {doc.rating}
                      </span>
                      <span>•</span>
                      <span>{doc.experienceYears} yrs experience</span>
                      <span>•</span>
                      <span>({doc.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  {doc.bio}
                </p>

                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-foreground/80 block mb-1">
                    Specializations:
                  </span>
                  <Badge variant="purple" size="sm">
                    {doc.specialty}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-semibold">
                  Next Available: {doc.availableDays[0]}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openBooking(doc)}
                  icon={<Calendar className="w-3.5 h-3.5" />}
                >
                  Book Session
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Booking Modal */}
      {selectedDoctor && (
        <Modal
          isOpen={bookingModal}
          onClose={() => setBookingModal(false)}
          title={`Book Consultation: ${selectedDoctor.name}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {selectedDoctor.title} · {selectedDoctor.specialty}
            </p>

            {/* Consultation Mode */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Consultation Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "video", label: "Video Call", icon: Video },
                  { id: "audio", label: "Audio Call", icon: Phone },
                  { id: "in_person", label: "Clinic Visit", icon: Building },
                ].map((mode) => {
                  const Icon = mode.icon
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setConsultType(mode.id as any)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        consultType === mode.id
                          ? "border-soul-purple bg-soul-purple/15 text-soul-purple font-bold"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{mode.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Pick Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Available Time Slots
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-medium border transition-all ${
                      selectedSlot === slot
                        ? "border-soul-purple bg-soul-purple/20 text-soul-purple font-bold shadow-sm"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Problem / Reason for Visit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Describe Your Problem / Concern <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-soul-teal font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-soul-teal" /> Zero-Knowledge (Never Stored)
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe what problem or symptoms you are experiencing (required before booking)..."
                rows={3}
                className={`w-full px-3 py-2 rounded-xl bg-input border text-foreground text-sm resize-none focus:outline-none focus:ring-1 ${
                  !reason.trim()
                    ? "border-amber-500/50 focus:ring-amber-500"
                    : "border-border focus:ring-soul-purple"
                }`}
              />
              {!reason.trim() ? (
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-medium">
                  ⚠️ You must describe your problem above before you can confirm booking.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  🔒 Your problem is processed ephemerally for your consult request and will NOT be stored in the database.
                </p>
              )}
            </div>

            {/* Share Digital Twin Data Consent */}
            <div className="p-3 rounded-xl bg-secondary/40 border border-border flex items-start gap-2.5">
              <input
                type="checkbox"
                id="shareTwin"
                checked={shareTwin}
                onChange={(e) => setShareTwin(e.target.checked)}
                className="mt-0.5 rounded border-border text-soul-purple focus:ring-soul-purple"
              />
              <label htmlFor="shareTwin" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                <strong className="text-foreground">Pre-session Clinical Summary:</strong> Authorize sharing your
                SoulSync Digital Twin longitudinal pattern summary and recent check-in stats with {selectedDoctor.name} to
                help them prepare for your session.
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setBookingModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmBooking}
                disabled={!reason.trim() || bookingLoading}
                isLoading={bookingLoading}
                className="flex-1 bg-soul-purple hover:bg-soul-purple/90 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm Booking
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  )
}
