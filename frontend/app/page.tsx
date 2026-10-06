"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Brain,
  Sparkles,
  LineChart,
  Shield,
  MessageSquare,
  Moon,
  Activity,
  Zap,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import Button from "@/components/ui/Button"

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.12 } },
}

const features = [
  {
    icon: Brain,
    title: "Digital Twin",
    description: "K-Means clustering builds a dynamic behavioral profile — Balanced, High-Stress, Low-Energy, or Recovery — from your daily vectors.",
    color: "from-soul-purple to-purple-400",
    glow: "shadow-glow-sm",
  },
  {
    icon: Sparkles,
    title: "NLP Journal Analysis",
    description: "DistilBERT transformers classify emotion (Happy, Sad, Anxious, Angry, Calm) and score sentiment (-1.0 to +1.0) on every journal entry.",
    color: "from-soul-teal to-cyan-400",
    glow: "shadow-glow-accent",
  },
  {
    icon: LineChart,
    title: "Trend Prediction",
    description: "Random Forest classifies short-term wellness trends using 3-day and 7-day rolling averages to forecast your trajectory.",
    color: "from-blue-500 to-indigo-400",
    glow: "",
  },
  {
    icon: Shield,
    title: "Anomaly Detection",
    description: "Isolation Forest flags when metrics dramatically deviate from your baseline — triggering gentle check-in prompts.",
    color: "from-amber-500 to-orange-400",
    glow: "shadow-glow-warm",
  },
  {
    icon: MessageSquare,
    title: "AI Companion",
    description: "A FLAN-T5 grounded companion that reads your actual mood, sleep, and journal data to provide data-aware reflections.",
    color: "from-soul-coral to-pink-400",
    glow: "",
  },
  {
    icon: Moon,
    title: "Sleep & Environment",
    description: "Correlate sleep quality with live weather, AQI, and daily rhythms fetched from Open-Meteo and environmental APIs.",
    color: "from-indigo-500 to-violet-400",
    glow: "",
  },
]

const steps = [
  { step: "01", title: "Check In Daily", description: "Log mood, stress, energy, and sleep in under 30 seconds.", icon: Activity },
  { step: "02", title: "Write & Reflect", description: "Journal freely. NLP detects emotions and scores sentiment automatically.", icon: Sparkles },
  { step: "03", title: "Discover Patterns", description: "ML clusters your data into behavioral profiles and predicts trends.", icon: Brain },
  { step: "04", title: "Grow With Insights", description: "Get personalized recommendations and chat with your AI companion.", icon: Zap },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ──────────────── Hero ──────────────── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-soul-purple/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-soul-teal/6 rounded-full blur-[100px]" />
          <div className="absolute top-40 right-1/3 w-64 h-64 bg-soul-coral/5 rounded-full blur-[80px]" />
        </div>

        {/* Floating Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-32 left-[15%] w-3 h-3 rounded-full bg-soul-purple/40"
          />
          <motion.div
            animate={{ y: [0, 15, 0], x: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-48 right-[20%] w-2 h-2 rounded-full bg-soul-teal/50"
          />
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-32 left-[30%] w-2.5 h-2.5 rounded-full bg-soul-coral/40"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="max-w-3xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-soul-purple/10 border border-soul-purple/20 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-soul-purple" />
              <span className="text-xs font-semibold text-soul-purple-light">AI-Powered Mental Wellness Platform</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
              Understand your patterns.{" "}
              <span className="text-gradient-primary">
                Sync with yourself.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p variants={fadeInUp} className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
              SoulSync analyses your daily mood, sleep, stress, energy, and journal entries using
              deep learning NLP and machine learning to detect personal patterns, predict trends,
              and build a personalized behavioral Digital Twin.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                  Start Free Today
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="lg">
                  Explore Demo
                </Button>
              </Link>
            </motion.div>

            {/* Tech badges */}
            <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-3 mt-10">
              {["DistilBERT NLP", "K-Means", "Isolation Forest", "Random Forest", "FLAN-T5"].map((tech) => (
                <span key={tech} className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-md border border-border">
                  {tech}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────── Features ──────────────── */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-semibold text-soul-teal uppercase tracking-wider">Core Features</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-3 mb-4">
              AI, ML & NLP Working{" "}
              <span className="text-gradient-accent">For You</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every insight is computed from your own data. No guessing, no generic advice.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative bg-card border border-border rounded-2xl p-6 card-hover"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 ${feature.glow}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ──────────────── How It Works ──────────────── */}
      <section id="how-it-works" className="py-24 bg-card/30">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-semibold text-soul-purple uppercase tracking-wider">How It Works</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-3">
              Four Steps to{" "}
              <span className="text-gradient-primary">Self-Awareness</span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex items-start gap-5 bg-card border border-border rounded-xl p-6 card-hover"
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-soul-purple/10 flex items-center justify-center">
                    <span className="text-lg font-extrabold text-soul-purple">{step.step}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Icon className="w-5 h-5 text-soul-purple" />
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ──────────────── CTA ──────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-soul-purple/5 rounded-full blur-[150px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative max-w-3xl mx-auto px-6 text-center"
        >
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
            Ready to{" "}
            <span className="text-gradient-primary">Understand Yourself</span>?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Join SoulSync and start building your personal Digital Twin.
            No diagnostic labels — just actionable self-reflection powered by real AI.
          </p>
          <Link href="/register">
            <Button size="lg" icon={<ChevronRight className="w-5 h-5" />}>
              Get Started — It&apos;s Free
            </Button>
          </Link>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
