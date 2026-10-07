"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Settings as SettingsIcon,
  Download,
  Trash2,
  Shield,
  Palette,
  User,
  Save,
  Compass,
  Bell,
  Clock,
  Moon,
  CheckCircle2,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Toggle from "@/components/ui/Toggle"
import Modal from "@/components/ui/Modal"
import toast from "react-hot-toast"

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Profile Edit states
  const profile = user?.profile
  const [name, setName] = useState(user?.name || "")
  const [timezone, setTimezone] = useState(profile?.timezone || "")
  const [sleepGoalHours, setSleepGoalHours] = useState(
    profile?.sleep_goal_minutes ? (profile.sleep_goal_minutes / 60).toString() : "8"
  )
  const [reminderHour, setReminderHour] = useState(
    profile?.reminder_hour !== undefined && profile?.reminder_hour !== null
      ? profile.reminder_hour.toString()
      : "20"
  )
  const [profileSaving, setProfileSaving] = useState(false)

  // Consent states
  const [locationEnabled, setLocationEnabled] = useState(profile?.location_enabled ?? false)
  const [envEnabled, setEnvEnabled] = useState(profile?.environment_enabled ?? false)
  const [nlpEnabled, setNlpEnabled] = useState(profile?.nlp_analysis_enabled ?? true)
  const [notifEnabled, setNotifEnabled] = useState(profile?.notifications_enabled ?? true)

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      if (user.profile) {
        setTimezone(user.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "")
        setSleepGoalHours(
          user.profile.sleep_goal_minutes ? (user.profile.sleep_goal_minutes / 60).toString() : "8"
        )
        setReminderHour(
          user.profile.reminder_hour !== undefined && user.profile.reminder_hour !== null
            ? user.profile.reminder_hour.toString()
            : "20"
        )
        setLocationEnabled(user.profile.location_enabled ?? false)
        setEnvEnabled(user.profile.environment_enabled ?? false)
        setNlpEnabled(user.profile.nlp_analysis_enabled ?? true)
        setNotifEnabled(user.profile.notifications_enabled ?? true)
      }
    }
  }, [user])

  // Save editable profile details
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim()) {
      toast.error("Name cannot be empty")
      return
    }

    const sleepMin = Math.round(parseFloat(sleepGoalHours || "8") * 60)
    if (isNaN(sleepMin) || sleepMin < 180 || sleepMin > 780) {
      toast.error("Sleep goal must be between 3 and 13 hours")
      return
    }

    const remHour = parseInt(reminderHour, 10)
    if (isNaN(remHour) || remHour < 0 || remHour > 23) {
      toast.error("Reminder hour must be between 0 and 23")
      return
    }

    setProfileSaving(true)
    try {
      await api.user.updateProfile({
        name: name.trim(),
        timezone: timezone.trim() || undefined,
        sleep_goal_minutes: sleepMin,
        reminder_hour: remHour,
      })
      toast.success("Profile details saved! ✨")
      refreshUser()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const detectSystemTimezone = () => {
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (sysTz) {
      setTimezone(sysTz)
      toast.success(`Detected system timezone: ${sysTz}`)
    }
  }

  // Handle system-prompted location consent
  const handleLocationToggle = (turnOn: boolean) => {
    if (!turnOn) {
      // Disabling
      setLocationEnabled(false)
      setEnvEnabled(false)
      api.user
        .updateConsents({ location_enabled: false, environment_enabled: false })
        .then(() => {
          toast.success("Location tracking disabled")
          refreshUser()
        })
        .catch(() => setLocationEnabled(true))
      return
    }

    // Enabling: trigger system prompt!
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser")
      return
    }

    toast.loading("Requesting browser location access...", { id: "loc-prompt" })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss("loc-prompt")
        try {
          const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          await api.user.updateLocation(pos.coords.latitude, pos.coords.longitude, tz)
          await api.user.updateConsents({ location_enabled: true })
          setLocationEnabled(true)
          toast.success("System location permission granted & updated! 📍")
          refreshUser()
        } catch {
          toast.error("Failed to update location coordinates")
        }
      },
      (err) => {
        toast.dismiss("loc-prompt")
        toast.error(`System location permission denied: ${err.message}`)
        setLocationEnabled(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Handle system-prompted notification consent
  const handleNotificationToggle = async (turnOn: boolean) => {
    if (!turnOn) {
      setNotifEnabled(false)
      api.user
        .updateConsents({ notifications_enabled: false })
        .then(() => {
          toast.success("Notifications turned off")
          refreshUser()
        })
        .catch(() => setNotifEnabled(true))
      return
    }

    if (!("Notification" in window)) {
      toast.error("Browser notifications are not supported in this environment")
      return
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        await api.user.updateConsents({ notifications_enabled: true })
        setNotifEnabled(true)
        toast.success("System notifications granted! 🔔")
        refreshUser()
      } else {
        toast.error(`Notification permission was ${permission}`)
        setNotifEnabled(false)
      }
    } catch {
      toast.error("Failed to request notification permission")
    }
  }

  const handleSimpleConsentUpdate = async (field: "environment_enabled" | "nlp_analysis_enabled", value: boolean) => {
    if (field === "environment_enabled" && value && !locationEnabled) {
      toast.error("Please enable Location Sharing first to track local weather and AQI")
      return
    }

    const setter = field === "environment_enabled" ? setEnvEnabled : setNlpEnabled
    setter(value)

    try {
      await api.user.updateConsents({ [field]: value })
      toast.success("Consent updated")
      refreshUser()
    } catch (err: unknown) {
      setter(!value)
      toast.error(err instanceof Error ? err.message : "Failed to update consent")
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const data = await api.user.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `soulsync-export-${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Data exported!")
    } catch {
      toast.error("Export failed")
    } finally {
      setExportLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletePassword) {
      toast.error("Password required")
      return
    }
    setDeleting(true)
    try {
      await api.user.deleteAccount(deletePassword)
      toast.success("Account deleted")
      logout()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deletion failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-muted-foreground" />
          Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal details, device system permissions, and appearance.
        </p>
      </div>

      {/* Editable Profile Details */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-soul-purple" /> Edit Profile Details
        </h3>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Email Address
              </label>
              <input
                disabled
                value={user?.email || ""}
                className="w-full h-11 px-3.5 rounded-lg bg-secondary/50 border border-border text-muted-foreground text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Timezone (IANA)
              </label>
              <button
                type="button"
                onClick={detectSystemTimezone}
                className="text-xs text-soul-purple hover:underline flex items-center gap-1"
              >
                <Compass className="w-3 h-3" /> Auto-Detect
              </button>
            </div>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Asia/Kolkata or America/New_York"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" /> Sleep Goal (Hours)
              </label>
              <Input
                type="number"
                step="0.5"
                min="3"
                max="13"
                value={sleepGoalHours}
                onChange={(e) => setSleepGoalHours(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-soul-teal" /> Check-In Reminder (24h)
              </label>
              <Input
                type="number"
                min="0"
                max="23"
                value={reminderHour}
                onChange={(e) => setReminderHour(e.target.value)}
                placeholder="e.g. 20 (for 8:00 PM)"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={profileSaving}
              icon={<Save className="w-4 h-4" />}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Theme Appearance */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4" /> Appearance
        </h3>
        <div className="flex gap-3">
          {(["dark", "light", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all capitalize ${
                theme === t
                  ? "border-soul-purple bg-soul-purple/10 text-soul-purple font-bold shadow-sm"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* Consents with System Prompts */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-emerald-400" /> System Privacy & Consents
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Toggling these options will trigger the native device permission dialogs in your browser.
        </p>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <Toggle
              checked={locationEnabled}
              onChange={handleLocationToggle}
              label="Location Sharing (System GPS Prompt)"
              description="Triggers system location prompt to fetch real weather & environmental markers"
            />
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <Toggle
              checked={notifEnabled}
              onChange={handleNotificationToggle}
              label="Desktop & Mobile Notifications"
              description="Triggers system notification permissions for daily reflection reminders"
            />
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <Toggle
              checked={envEnabled}
              onChange={(v) => handleSimpleConsentUpdate("environment_enabled", v)}
              label="Live Environment Tracking"
              description="Sync real-time Open-Meteo temperature, AQI, and daylight status"
              disabled={!locationEnabled}
            />
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <Toggle
              checked={nlpEnabled}
              onChange={(v) => handleSimpleConsentUpdate("nlp_analysis_enabled", v)}
              label="Local NLP Emotion Analysis"
              description="Analyzes journal entries locally for sentiment & primary emotions"
            />
          </div>
        </div>
      </Card>

      {/* Data Rights */}
      <Card>
        <h3 className="text-sm font-bold text-foreground mb-4">Data Rights & Privacy</h3>
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleExport}
            isLoading={exportLoading}
            icon={<Download className="w-4 h-4" />}
          >
            Export All My Data (JSON)
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setDeleteModal(true)}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Delete My Account
          </Button>
        </div>
      </Card>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Account" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account and all associated check-ins, journals, and sleep history.
            This action cannot be undone.
          </p>
          <Input
            label="Confirm Password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter your password"
          />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting} className="flex-1">
              Delete Forever
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
