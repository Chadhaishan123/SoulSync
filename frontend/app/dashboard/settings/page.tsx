"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Settings as SettingsIcon, Download, Trash2, Shield, Palette, User } from "lucide-react"
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
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Consent states
  const profile = user?.profile
  const [locationEnabled, setLocationEnabled] = useState(profile?.location_enabled ?? false)
  const [envEnabled, setEnvEnabled] = useState(profile?.environment_enabled ?? false)
  const [nlpEnabled, setNlpEnabled] = useState(profile?.nlp_analysis_enabled ?? true)
  const [notifEnabled, setNotifEnabled] = useState(profile?.notifications_enabled ?? true)

  const handleConsentUpdate = async (field: string, value: boolean) => {
    const map: Record<string, (v: boolean) => void> = {
      location_enabled: setLocationEnabled,
      environment_enabled: setEnvEnabled,
      nlp_analysis_enabled: setNlpEnabled,
      notifications_enabled: setNotifEnabled,
    }
    map[field]?.(value)

    try {
      await api.user.updateConsents({ [field]: value })
      toast.success("Consent updated")
      refreshUser()
    } catch (err: unknown) {
      map[field]?.(!value) // revert
      toast.error(err instanceof Error ? err.message : "Failed to update")
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
      </div>

      {/* Profile */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <User className="w-4 h-4" /> Profile
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium text-foreground">{user?.name}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Timezone</span>
            <span className="font-medium text-foreground">{profile?.timezone || "Not set"}</span>
          </div>
        </div>
      </Card>

      {/* Theme */}
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
                  ? "border-soul-purple bg-soul-purple/10 text-soul-purple"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* Consents */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" /> Privacy & Consents
        </h3>
        <div className="space-y-4">
          <Toggle
            checked={locationEnabled}
            onChange={(v) => handleConsentUpdate("location_enabled", v)}
            label="Location Sharing"
            description="Share coordinates for live weather and environmental data"
          />
          <Toggle
            checked={envEnabled}
            onChange={(v) => handleConsentUpdate("environment_enabled", v)}
            label="Environment Tracking"
            description="Fetch weather, AQI, and pollen for your location"
            disabled={!locationEnabled}
          />
          <Toggle
            checked={nlpEnabled}
            onChange={(v) => handleConsentUpdate("nlp_analysis_enabled", v)}
            label="NLP Journal Analysis"
            description="Auto-analyze journal entries for emotion and sentiment"
          />
          <Toggle
            checked={notifEnabled}
            onChange={(v) => handleConsentUpdate("notifications_enabled", v)}
            label="Notifications"
            description="Receive check-in reminders and anomaly alerts"
          />
        </div>
      </Card>

      {/* Data Rights */}
      <Card>
        <h3 className="text-sm font-bold text-foreground mb-4">Data Rights</h3>
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
            This will permanently delete your account and all associated data.
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
