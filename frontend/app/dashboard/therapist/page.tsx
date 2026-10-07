"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  HeartHandshake,
  Send,
  AlertTriangle,
  User,
  Shield,
  Stethoscope,
  Sparkles,
  Phone,
  RefreshCw,
  CalendarCheck,
  CheckCircle2,
} from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import toast from "react-hot-toast"

interface TherapistMessage {
  id: string
  role: "therapist" | "user"
  text: string
  distortionHint?: string
  toolSuggestion?: string
}

const CBT_DISTORTIONS: Record<string, { name: string; advice: string }> = {
  catastrophizing: {
    name: "Catastrophizing",
    advice: "Expecting the worst-case scenario. Ask yourself: 'What is the most realistic outcome?'",
  },
  allOrNothing: {
    name: "All-or-Nothing Thinking",
    advice: "Viewing situations in black-and-white. Notice shades of gray and partial successes.",
  },
  mindReading: {
    name: "Mind Reading",
    advice: "Assuming you know what others think without concrete evidence.",
  },
  emotionalReasoning: {
    name: "Emotional Reasoning",
    advice: "'I feel it, therefore it must be true.' Feelings are real, but they are not facts.",
  },
  shouldStatements: {
    name: "Should Statements",
    advice: "Rigid demands ('I should', 'I must') that create guilt. Replace with 'I would prefer to'.",
  },
}

export default function DigitalTherapistPage() {
  const [messages, setMessages] = useState<TherapistMessage[]>([
    {
      id: "intro",
      role: "therapist",
      text: "Welcome to your Digital Therapy space. I practice Cognitive Behavioral Therapy (CBT) and somatic regulation. This is a non-judgmental environment to unpack difficult emotions, deconstruct cognitive distortions, and regulate your nervous system. What situation or thought is feeling heaviest right now?",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const handleSend = (textOverride?: string) => {
    const text = (textOverride || input).trim()
    if (!text) return

    const userMsg: TherapistMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setTyping(true)

    setTimeout(() => {
      const lower = text.toLowerCase()
      let reply = ""
      let distortion: string | undefined = undefined
      let tool: string | undefined = undefined

      // Crisis check
      if (
        lower.includes("suicid") ||
        lower.includes("kill myself") ||
        lower.includes("end my life") ||
        lower.includes("hurt myself") ||
        lower.includes("want to die")
      ) {
        reply =
          "I hear how much pain you are holding right now, but please know that you do not have to carry this alone. Your life is irreplaceable. " +
          "Please reach out immediately to a human professional. You can call the free, confidential 24/7 lifeline right now at 14416 (Tele-MANAS) or 988. " +
          "Click the emergency buttons above to connect immediately."
      }
      // Greetings
      else if (
        lower === "hi" ||
        lower === "hello" ||
        lower === "hey" ||
        lower.startsWith("hi ") ||
        lower.startsWith("hello ") ||
        lower.startsWith("hey ") ||
        lower.includes("good morning") ||
        lower.includes("good evening")
      ) {
        tool = "Mindful Check-in"
        reply =
          "Welcome to your safe reflection space. I'm glad you're here today. " +
          "Before we dive into any thoughts, take a slow breath and notice: where is your body holding tension right now (jaw, shoulders, chest)? " +
          "What is the most prominent feeling or situation that brought you to session today?"
      }
      // All-or-nothing
      else if (
        lower.includes("always") ||
        lower.includes("never") ||
        lower.includes("completely failed") ||
        lower.includes("total failure") ||
        lower.includes("ruined everything") ||
        lower.includes("worthless")
      ) {
        distortion = "allOrNothing"
        reply =
          "I notice words like 'always', 'never', or 'total failure'. In CBT, this is known as All-or-Nothing Thinking. " +
          "When we are emotionally overwhelmed, our brain collapses nuanced reality into black-and-white absolutes. " +
          "Let's test this: Can you identify even one small factor in this situation that didn't go completely wrong, or a previous time when this wasn't true?"
      }
      // Catastrophizing
      else if (
        lower.includes("worst") ||
        lower.includes("disaster") ||
        lower.includes("horrible") ||
        lower.includes("doomed") ||
        lower.includes("end of the world") ||
        lower.includes("catastrophe")
      ) {
        distortion = "catastrophizing"
        reply =
          "Your mind is jumping directly to the catastrophe. Catastrophizing is our amygdala's attempt to brace for danger, but it traps us in severe panic. " +
          "Let's reality-test this thought: On a scale of 1 to 100%, what is the realistic likelihood of that worst-case outcome? " +
          "What is the most probable middle-ground outcome, and how could you handle that step-by-step?"
      }
      // Mind Reading
      else if (
        lower.includes("they hate me") ||
        lower.includes("they think i'm") ||
        lower.includes("everyone thinks") ||
        lower.includes("judging me") ||
        lower.includes("laughing at me")
      ) {
        distortion = "mindReading"
        reply =
          "You may be experiencing Mind Reading — assuming you know other people's unspoken critical opinions. " +
          "We often project our own internal self-doubt onto the silence or expressions of others. " +
          "Do you have concrete, spoken facts that they think this, or is this your inner critic filling in the blanks?"
      }
      // Should statements
      else if (
        lower.includes("i should") ||
        lower.includes("i shouldn't") ||
        lower.includes("i must") ||
        lower.includes("i ought to") ||
        lower.includes("i have to be perfect")
      ) {
        distortion = "shouldStatements"
        reply =
          "Notice the word 'should' or 'must'. In cognitive therapy, 'Should Statements' impose tyrannical, rigid rules on ourselves that generate guilt and shame. " +
          "What happens if you replace 'I should' with 'I would prefer to, but it is okay that I am human'? " +
          "How does that shift the pressure in your chest?"
      }
      // Panic / Somatic overload
      else if (
        lower.includes("panic") ||
        lower.includes("can't breathe") ||
        lower.includes("cant breathe") ||
        lower.includes("chest tight") ||
        lower.includes("racing heart") ||
        lower.includes("shaking")
      ) {
        tool = "Somatic Reset"
        reply =
          "Let's step out of your racing thoughts and anchor immediately into your physical senses. " +
          "1. Place one hand flat over your heart, and one on your stomach.\n" +
          "2. Inhale gently for 4 counts, feel your belly expand.\n" +
          "3. Exhale slowly through your mouth for 6 counts with a soft sigh.\n\n" +
          "Feel your feet resting on the floor. You are in a safe room right now. What are two physical objects you see around you?"
      }
      // Sadness / Grief / Emptiness
      else if (
        lower.includes("sad") ||
        lower.includes("depress") ||
        lower.includes("empty") ||
        lower.includes("numb") ||
        lower.includes("crying") ||
        lower.includes("lost") ||
        lower.includes("grief") ||
        lower.includes("hurting")
      ) {
        tool = "Compassionate Inquiry"
        reply =
          "I want to validate how heavy and exhausting sadness feels. It is completely natural to feel down, and you do not have to force yourself to 'fix' it this second. " +
          "Often, sadness is our body's way of asking for quiet, tender space. " +
          "Can you treat yourself with the gentle care you'd offer a young child who is feeling sad? What is one comforting thing you can do for yourself today?"
      }
      // Work / Burnout / Imposter Syndrome
      else if (
        lower.includes("work") ||
        lower.includes("job") ||
        lower.includes("boss") ||
        lower.includes("exam") ||
        lower.includes("burnout") ||
        lower.includes("imposter") ||
        lower.includes("fraud") ||
        lower.includes("deadline")
      ) {
        tool = "Cognitive Restructuring"
        reply =
          "Work anxiety and imposter feelings usually stem from tying our fundamental self-worth to perfection and external productivity. " +
          "Remember: feeling like an imposter doesn't mean you are incompetent — it usually means you care deeply about doing well. " +
          "What is the actual, objective evidence of your capabilities and accomplishments that your anxious brain is ignoring right now?"
      }
      // Interpersonal / Breakup / Relationship
      else if (
        lower.includes("relationship") ||
        lower.includes("partner") ||
        lower.includes("breakup") ||
        lower.includes("fight") ||
        lower.includes("argued") ||
        lower.includes("ex") ||
        lower.includes("lonely") ||
        lower.includes("alone")
      ) {
        tool = "Relational Decentering"
        reply =
          "Relational friction and heartbreak trigger our deepest evolutionary fears of abandonment and disconnection. " +
          "When someone close to us acts in a hurtful way, our immediate instinct is to ask: 'What did I do wrong?' " +
          "Try to decenter: their behavior is a reflection of their own emotional maturity and stress triggers, not your worth. " +
          "What boundary or emotional need do you need to honor for yourself in this relationship?"
      }
      // Sleep & Racing thoughts
      else if (
        lower.includes("sleep") ||
        lower.includes("insomnia") ||
        lower.includes("cant sleep") ||
        lower.includes("night") ||
        lower.includes("bed")
      ) {
        tool = "CBT-I Thought Diffusing"
        reply =
          "When the room goes dark and quiet, the mind often takes that silence as an opportunity to review every unsolved worry. " +
          "In CBT-I, we don't try to force sleep. Instead, tell your mind: 'Thank you for trying to solve problems, but right now is for resting.' " +
          "If you've been lying in bed awake for over 20 minutes, get up, sit in dim light, and write your worries on paper so your brain knows they won't be forgotten."
      }
      // Affirmative / Socratic continuity
      else if (
        lower === "yes" ||
        lower === "yeah" ||
        lower === "okay" ||
        lower === "sure" ||
        lower === "that makes sense" ||
        lower.includes("i will try") ||
        lower.includes("i agree")
      ) {
        reply =
          "That insight is a significant breakthrough. In CBT, the goal isn't just seeing the pattern, but practicing a balanced alternative thought. " +
          "Let's put this into action: write down one sentence that summarizes a fairer, more compassionate perspective on this situation. " +
          "What would that new statement look like?"
      }
      // Hesitation / Stuck
      else if (
        lower.includes("i don't know") ||
        lower.includes("not sure") ||
        lower.includes("hard to say") ||
        lower.includes("maybe")
      ) {
        reply =
          "It is completely okay not to have all the answers. Uncertainty itself can feel uncomfortable, but you don't need to resolve everything all at once. " +
          "If we strip away all the 'what-ifs' and look only at today, what is the single smallest step you can take in the next hour to care for yourself?"
      }
      // Dynamic Socratic Clinician Reflection (Customized to user text)
      else {
        reply =
          `I hear you reflecting on "${text.length > 60 ? text.slice(0, 60) + '...' : text}". ` +
          "In our therapeutic exploration, every belief carries an underlying emotional core. " +
          "When this thought comes up for you, what core emotion is beneath it — fear of failure, sadness, feeling unseen, or needing control? " +
          "If we approached this situation with unconditional self-compassion, what would change?"
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "th-" + Date.now(),
          role: "therapist",
          text: reply,
          distortionHint: distortion,
          toolSuggestion: tool,
        },
      ])
      setTyping(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-soul-teal" />
          Digital Therapist (CBT Clinical Mode)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Evidence-based Cognitive Behavioral Therapy, distortion reframing, and immediate human escalation.
        </p>
      </div>

      {/* Escalation & Doctor Connection Banner */}
      <Card variant="interactive" className="p-4 bg-gradient-to-r from-soul-purple/10 to-soul-teal/10 border-soul-purple/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soul-purple/20 flex items-center justify-center text-soul-purple shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                Need Human Medical or Clinical Care?
                <Badge variant="purple" size="sm">Licensed Doctors</Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                The digital therapist does not replace psychiatric care. You can consult with verified doctors anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href="/dashboard/appointments" className="flex-1 md:flex-none">
              <Button
                size="sm"
                variant="primary"
                className="w-full bg-soul-purple hover:bg-soul-purple/90 text-white font-bold"
                icon={<CalendarCheck className="w-4 h-4" />}
              >
                Book a Real Doctor
              </Button>
            </Link>
            <a
              href="tel:14416"
              className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1 transition-all shrink-0"
              title="Emergency Mental Health Helpline"
            >
              <Phone className="w-3.5 h-3.5" /> Emergency SOS (14416)
            </a>
          </div>
        </div>
      </Card>

      {/* Chat Container */}
      <Card padding="none" className="h-[620px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soul-teal to-emerald-500 flex items-center justify-center text-white">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">CBT Clinical Assistant</p>
              <p className="text-[10px] text-muted-foreground">Cognitive Restructuring & Somatic Regulation</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setMessages([
                {
                  id: "intro",
                  role: "therapist",
                  text: "Resetting session. I'm listening. What would you like to explore or reframe right now?",
                },
              ])
            }
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                  m.role === "user"
                    ? "bg-soul-purple/20 text-soul-purple"
                    : "bg-soul-teal/20 text-soul-teal"
                }`}
              >
                {m.role === "user" ? <User className="w-4 h-4" /> : <HeartHandshake className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-soul-purple text-white rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md border border-border/60"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.distortionHint && CBT_DISTORTIONS[m.distortionHint] && (
                  <div className="mt-3 pt-2.5 border-t border-border/80 text-xs">
                    <span className="font-bold text-amber-400 block mb-0.5">
                      💡 Cognitive Distortion Identified: {CBT_DISTORTIONS[m.distortionHint].name}
                    </span>
                    <span className="text-muted-foreground">
                      {CBT_DISTORTIONS[m.distortionHint].advice}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-soul-teal/20 text-soul-teal flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-300" />
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Therapy Starters */}
        <div className="px-4 py-2 border-t border-border/50 bg-secondary/20 flex flex-wrap gap-2">
          {[
            "I'm catastrophizing about an outcome",
            "I feel like a complete failure",
            "I feel panic in my chest right now",
            "I'm worried everyone is judging me",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-soul-teal transition-all"
            >
              💭 {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what's weighing on you or what thought you want to reframe..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-soul-teal/50 resize-none text-sm"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || typing}
              className="bg-soul-teal hover:bg-soul-teal/90 text-white font-bold"
              icon={<Send className="w-4 h-4" />}
            >
              Reflect
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
